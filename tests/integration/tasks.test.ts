import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTask,
  deleteTask,
  replaceTask,
  readBoard,
} from "../../src/worker/tasks";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries"),
    env.DB.prepare("DELETE FROM notification_events"),
    env.DB.prepare("DELETE FROM notification_registrations"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM partners"),
    env.DB.prepare(
      "UPDATE board_metadata SET revision=0, slot_1_revision=0, slot_2_revision=0 WHERE id=1",
    ),
  ]);
});

it("deletes for either partner without advancing revision for rejected attempts", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
  ).run();
  const first = await createTask(env.DB, "a", {
    title: "Uno",
    assigneeUid: "a",
    deadline: null,
  });
  await expect(
    deleteTask(env.DB, "outsider", first.task.id),
  ).rejects.toMatchObject({ status: 403 });
  expect(await deleteTask(env.DB, "b", first.task.id)).toEqual({ revision: 2 });
  await expect(deleteTask(env.DB, "a", first.task.id)).rejects.toMatchObject({
    status: 404,
  });
  const second = await createTask(env.DB, "b", {
    title: "Dos",
    assigneeUid: "b",
    deadline: null,
  });
  expect(await deleteTask(env.DB, "a", second.task.id)).toEqual({
    revision: 4,
  });
  expect(await readBoard(env.DB, "a")).toEqual({ revision: 4, tasks: [] });
  const third = await createTask(env.DB, "a", {
    title: "Tres",
    assigneeUid: "a",
    deadline: null,
  });
  await env.DB.prepare(
    "UPDATE board_metadata SET revision=9007199254740991, slot_1_revision=9007199254740991, slot_2_revision=9007199254740991 WHERE id=1",
  ).run();
  await expect(deleteTask(env.DB, "a", third.task.id)).rejects.toMatchObject({
    status: 503,
  });
  expect((await readBoard(env.DB, "a")).tasks).toEqual([third.task]);
});

describe("atomic board saves", () => {
  it("returns consistent snapshots, increments on every successful save, and leaves rejected saves unchanged", async () => {
    await env.DB.prepare(
      "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
    ).run();
    const first = await createTask(env.DB, "a", {
      title: "Comprar",
      assigneeUid: "b",
      deadline: null,
    });
    expect(first.revision).toBe(1);
    expect(first.task.status).toBe("todo");
    const next = await replaceTask(env.DB, "b", first.task.id, {
      title: "Comprar",
      assigneeUid: "a",
      status: "completed",
      deadline: null,
    });
    expect(next.revision).toBe(2);
    expect(next.task.createdAt).toBe(first.task.createdAt);
    expect(await readBoard(env.DB, "a")).toEqual({
      revision: 2,
      tasks: [next.task],
    });
    await expect(
      replaceTask(env.DB, "a", "missing", {
        title: "x",
        assigneeUid: "a",
        status: "todo",
        deadline: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createTask(env.DB, "a", {
        title: "x",
        assigneeUid: "outsider",
        deadline: null,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await (await readBoard(env.DB, "a")).revision).toBe(2);
  });
});

it("serializes concurrent full replacements and increments even for same values", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a2','Ana',1),(2,'b2','Bea',1)",
  ).run();
  const initial = await createTask(env.DB, "a2", {
    title: "Original",
    assigneeUid: "a2",
    deadline: null,
  });
  const [first, second] = await Promise.all([
    replaceTask(env.DB, "a2", initial.task.id, {
      title: "Primero",
      assigneeUid: "a2",
      status: "in_progress",
      deadline: null,
    }),
    replaceTask(env.DB, "b2", initial.task.id, {
      title: "Segundo",
      assigneeUid: "b2",
      status: "blocked",
      deadline: null,
    }),
  ]);
  expect([first.revision, second.revision].sort()).toEqual([2, 3]);
  const winner = first.revision > second.revision ? first : second;
  expect((await readBoard(env.DB, "a2")).tasks[0]).toEqual(winner.task);
  const same = await replaceTask(env.DB, "a2", winner.task.id, {
    title: winner.task.title,
    assigneeUid: winner.task.assigneeUid,
    status: winner.task.status,
    deadline: winner.task.deadline,
  });
  expect(same.revision).toBe(4);
});
it("rejects a save at revision overflow without changing the board", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a3','Ana',1),(2,'b3','Bea',1)",
  ).run();
  await env.DB.prepare(
    "UPDATE board_metadata SET revision=9007199254740991, slot_1_revision=9007199254740991, slot_2_revision=9007199254740991 WHERE id=1",
  ).run();
  await expect(
    createTask(env.DB, "a3", {
      title: "No guardar",
      assigneeUid: "a3",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(await readBoard(env.DB, "a3")).toEqual({
    revision: 9007199254740991,
    tasks: [],
  });
});

it("rolls back the task and revision when a batch statement fails", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a4','Ana',1),(2,'b4','Bea',1)",
  ).run();
  const failing = {
    prepare: env.DB.prepare.bind(env.DB),
    batch: (statements: D1PreparedStatement[]) =>
      env.DB.batch([
        ...statements,
        env.DB.prepare("SELECT * FROM nonexistent_failure_table"),
      ]),
  } as unknown as D1Database;
  await expect(
    createTask(failing, "a4", {
      title: "No guardar",
      assigneeUid: "a4",
      deadline: null,
    }),
  ).rejects.toThrow();
  expect(await readBoard(env.DB, "a4")).toEqual({ revision: 0, tasks: [] });
});

it("rejects a mutation if the assignee is disabled immediately before its batch", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a5','Ana',1),(2,'b5','Bea',1)",
  ).run();
  const guarded = {
    prepare: env.DB.prepare.bind(env.DB),
    async batch(statements: D1PreparedStatement[]) {
      await env.DB.prepare(
        "UPDATE partners SET enabled=0 WHERE uid='b5'",
      ).run();
      return env.DB.batch(statements);
    },
  } as unknown as D1Database;
  await expect(
    createTask(guarded, "a5", {
      title: "No guardar",
      assigneeUid: "b5",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(await readBoard(env.DB, "a5")).toEqual({ revision: 1, tasks: [] });
});

it("classifies a rejected write using the state seen in its transaction", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a6','Ana',1),(2,'b6','Bea',0)",
  ).run();
  const changing = {
    prepare: env.DB.prepare.bind(env.DB),
    async batch(statements: D1PreparedStatement[]) {
      const result = await env.DB.batch(statements);
      await env.DB.prepare(
        "UPDATE partners SET enabled=1 WHERE uid='b6'",
      ).run();
      return result;
    },
  } as unknown as D1Database;
  await expect(
    createTask(changing, "a6", {
      title: "No guardar",
      assigneeUid: "b6",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it("permits every status transition including reopening a completed task", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a7','Ana',1),(2,'b7','Bea',1)",
  ).run();
  const created = await createTask(env.DB, "a7", {
    title: "Tarea",
    assigneeUid: "b7",
    deadline: null,
  });
  for (const status of [
    "in_progress",
    "blocked",
    "completed",
    "todo",
  ] as const) {
    const result = await replaceTask(env.DB, "b7", created.task.id, {
      title: "Tarea",
      assigneeUid: "a7",
      status,
      deadline: null,
    });
    expect(result.task.status).toBe(status);
  }
  expect((await readBoard(env.DB, "a7")).revision).toBe(5);
});

it("rejects a mutation if the caller is disabled immediately before its batch", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a8','Ana',1),(2,'b8','Bea',1)",
  ).run();
  const guarded = {
    prepare: env.DB.prepare.bind(env.DB),
    async batch(statements: D1PreparedStatement[]) {
      await env.DB.prepare(
        "UPDATE partners SET enabled=0 WHERE uid='a8'",
      ).run();
      return env.DB.batch(statements);
    },
  } as unknown as D1Database;
  await expect(
    createTask(guarded, "a8", {
      title: "No guardar",
      assigneeUid: "b8",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(await readBoard(env.DB, "b8")).toEqual({ revision: 1, tasks: [] });
});

it("returns all statuses ordered by creation time and ID", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a9','Ana',1),(2,'b9','Bea',1)",
  ).run();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO tasks (id,title,assignee_uid,status,deadline,created_at,updated_at) VALUES ('z','Última','a9','completed',NULL,'2026-01-02T00:00:00Z','2026-01-02T00:00:00Z')",
    ),
    env.DB.prepare(
      "INSERT INTO tasks (id,title,assignee_uid,status,deadline,created_at,updated_at) VALUES ('b','Segunda','a9','blocked',NULL,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
    ),
    env.DB.prepare(
      "INSERT INTO tasks (id,title,assignee_uid,status,deadline,created_at,updated_at) VALUES ('a','Primera','b9','todo',NULL,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
    ),
  ]);
  expect((await readBoard(env.DB, "a9")).tasks.map((task) => task.id)).toEqual([
    "a",
    "b",
    "z",
  ]);
});

it("rolls back deletion when a batch statement fails", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
  ).run();
  const created = await createTask(env.DB, "a", {
    title: "Conservar",
    assigneeUid: "a",
    deadline: null,
  });
  const failing = {
    prepare: env.DB.prepare.bind(env.DB),
    batch: (statements: D1PreparedStatement[]) =>
      env.DB.batch([
        ...statements,
        env.DB.prepare("SELECT * FROM nonexistent_failure_table"),
      ]),
  } as unknown as D1Database;
  await expect(deleteTask(failing, "a", created.task.id)).rejects.toThrow();
  expect(await readBoard(env.DB, "a")).toEqual({
    revision: 1,
    tasks: [created.task],
  });
});

it("creates private tasks with the authenticated partner as owner and assignee", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'private-a','Ana',1),(2,'private-b','Bea',1)",
  ).run();
  const saved = await createTask(env.DB, "private-a", {
    title: "Personal",
    visibility: "private",
    deadline: null,
  });
  expect(saved.task).toMatchObject({
    visibility: "private",
    assigneeUid: "private-a",
  });
  expect(
    await env.DB.prepare("SELECT creator_uid FROM tasks WHERE id=?")
      .bind(saved.task.id)
      .first(),
  ).toMatchObject({ creator_uid: "private-a" });
  await expect(
    createTask(env.DB, "private-a", {
      title: "Otra",
      visibility: "private",
      assigneeUid: "private-b",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it.each(["private-a", "private-b"])(
  "lets %s edit their private task while retaining ownership",
  async (uid) => {
    await env.DB.prepare(
      "INSERT INTO partners VALUES (1,'private-a','Ana',1),(2,'private-b','Bea',1)",
    ).run();
    const created = await createTask(env.DB, uid, {
      title: "Personal",
      visibility: "private",
      deadline: null,
    });
    const edited = await replaceTask(env.DB, uid, created.task.id, {
      title: "Editada",
      assigneeUid: uid,
      status: "completed",
      deadline: null,
    });
    expect(edited.task).toMatchObject({
      title: "Editada",
      visibility: "private",
      assigneeUid: uid,
      status: "completed",
    });
  },
);

it("denies another partner's private mutation without side effects", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'private-a','Ana',1),(2,'private-b','Bea',1)",
  ).run();
  const task = await createTask(env.DB, "private-a", {
    title: "Personal",
    visibility: "private",
    deadline: null,
  });
  const before = await env.DB.prepare(
    "SELECT count(*) AS count FROM notification_events",
  ).first();
  await expect(
    replaceTask(env.DB, "private-b", task.task.id, {
      title: "Changed",
      assigneeUid: "private-b",
      status: "completed",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    deleteTask(env.DB, "private-b", task.task.id),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    await env.DB.prepare(
      "SELECT count(*) AS count FROM notification_events",
    ).first(),
  ).toEqual(before);
  await expect(
    replaceTask(env.DB, "private-a", task.task.id, {
      title: "Personal",
      assigneeUid: "private-b",
      status: "todo",
      deadline: null,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it("isolates board revisions and tasks by partner", async () => {
  await env.DB.prepare(
    "INSERT INTO partners VALUES (1,'aud-a','Ana',1),(2,'aud-b','Bea',1)",
  ).run();
  const privateTask = await createTask(env.DB, "aud-a", {
    title: "Privada",
    visibility: "private",
    deadline: null,
  });
  const a = await readBoard(env.DB, "aud-a");
  const b = await readBoard(env.DB, "aud-b");
  expect(a.tasks.map((task) => task.id)).toContain(privateTask.task.id);
  expect(b.tasks).toEqual([]);
  expect(a.revision).toBe(1);
  expect(b.revision).toBe(0);
  const shared = await createTask(env.DB, "aud-b", {
    title: "Compartida",
    assigneeUid: "aud-a",
    deadline: null,
  });
  expect(shared.revision).toBe(1);
  expect((await readBoard(env.DB, "aud-a")).revision).toBe(2);
  await deleteTask(env.DB, "aud-a", privateTask.task.id);
  expect((await readBoard(env.DB, "aud-a")).revision).toBe(3);
  expect((await readBoard(env.DB, "aud-b")).revision).toBe(1);
});
