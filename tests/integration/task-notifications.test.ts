import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import { createTask, replaceTask, readBoard } from "../../src/worker/tasks";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries"),
    env.DB.prepare("DELETE FROM notification_events"),
    env.DB.prepare("DELETE FROM notification_registrations"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM partners"),
    env.DB.prepare("UPDATE board_metadata SET revision=0 WHERE id=1"),
    env.DB.prepare(
      "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
    ),
    env.DB.prepare(
      "INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('ra','a','https://fcm.googleapis.com/a','key','auth','2026-01-01','2026-01-01'),('rb','b','https://fcm.googleapis.com/b','key','auth','2026-01-01','2026-01-01')",
    ),
  ]);
});
async function events() {
  return (
    await env.DB.prepare(
      "SELECT type,revision,recipient_uid,changed_fields,payload FROM notification_events ORDER BY revision,recipient_uid",
    ).all<{
      type: string;
      revision: number;
      recipient_uid: string;
      changed_fields: string;
      payload: string;
    }>()
  ).results;
}
it("captures both recipients, mixed completion and device snapshots atomically", async () => {
  const created = await createTask(env.DB, "a", {
    title: "Comprar",
    assigneeUid: "a",
    deadline: null,
  });
  await replaceTask(env.DB, "a", created.task.id, {
    title: "Comprar pan",
    assigneeUid: "b",
    status: "completed",
    deadline: null,
  });
  const result = await events();
  expect(
    result.map(({ type, revision, recipient_uid }) => [
      type,
      revision,
      recipient_uid,
    ]),
  ).toEqual([
    ["created", 1, "a"],
    ["created", 1, "b"],
    ["completed", 2, "a"],
    ["completed", 2, "b"],
  ]);
  expect(
    (JSON.parse(result[2].payload) as { body: string }).body,
  ).not.toContain("título");
  expect((JSON.parse(result[3].payload) as { body: string }).body).toContain(
    "título",
  );
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS count FROM notification_deliveries",
      ).first<{ count: number }>()
    )?.count,
  ).toBe(4);
});
it("suppresses unchanged and rejected saves while preserving revisions", async () => {
  const created = await createTask(env.DB, "a", {
    title: "Tarea",
    assigneeUid: "a",
    deadline: null,
  });
  await replaceTask(env.DB, "a", created.task.id, {
    title: "Tarea",
    assigneeUid: "a",
    status: "todo",
    deadline: null,
  });
  await expect(
    replaceTask(env.DB, "a", created.task.id, {
      title: "No",
      assigneeUid: "bad",
      status: "todo",
      deadline: null,
    }),
  ).rejects.toThrow();
  expect((await events()).length).toBe(2);
  expect((await readBoard(env.DB)).revision).toBe(2);
});
it("compares simultaneous replacements against their serialized predecessors", async () => {
  const created = await createTask(env.DB, "a", {
    title: "Original",
    assigneeUid: "a",
    deadline: null,
  });
  const values = {
    title: "Nuevo",
    assigneeUid: "a",
    status: "todo" as const,
    deadline: null,
  };
  const saves = await Promise.all([
    replaceTask(env.DB, "a", created.task.id, values),
    replaceTask(env.DB, "a", created.task.id, values),
  ]);
  expect(saves.map((s) => s.revision).sort()).toEqual([2, 3]);
  expect((await events()).map((e) => e.type)).toEqual([
    "created",
    "created",
    "changed",
  ]);
});

it("schedules dispatch after a successful API save and preserves the response when transport fails", async () => {
  const { createWorker } = await import("../../src/worker/index");
  const enc = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const token = `${enc({ alg: "none" })}.${enc({ sub: "a", aud: "demo-shared-task-board", iss: "https://securetoken.google.com/demo-shared-task-board", iat: now, auth_time: now, exp: now + 3600 })}.`;
  const waits: Promise<unknown>[] = [];
  const worker = createWorker(true, () =>
    Promise.reject(new Error("transport failure")),
  );
  const response = await worker.fetch(
    new Request("https://example.test/api/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Nueva", assigneeUid: "a" }),
    }),
    {
      ...env,
      AUTH_MODE: "emulator",
      ENVIRONMENT: "local",
      FIREBASE_PROJECT_ID: "demo-shared-task-board",
      VAPID_PUBLIC_KEY: "configured",
      VAPID_PRIVATE_KEY: "configured",
      VAPID_SUBJECT: "mailto:test@example.test",
    },
    {
      waitUntil(promise: Promise<unknown>) {
        waits.push(promise);
      },
    },
  );
  expect(response.status).toBe(201);
  expect(waits).toHaveLength(1);
  await Promise.all(waits);
  expect((await readBoard(env.DB)).tasks).toHaveLength(1);
  expect(
    (
      await env.DB.prepare(
        "SELECT state FROM notification_deliveries ORDER BY registration_id",
      ).all()
    ).results,
  ).toEqual([{ state: "pending" }, { state: "pending" }]);
});

it("rolls back events and snapshots when a later batch statement fails", async () => {
  const failing = {
    prepare: env.DB.prepare.bind(env.DB),
    batch: (statements: D1PreparedStatement[]) =>
      env.DB.batch([
        ...statements,
        env.DB.prepare("SELECT * FROM nonexistent_failure_table"),
      ]),
  } as unknown as D1Database;
  await expect(
    createTask(failing, "a", {
      title: "Revertida",
      assigneeUid: "a",
      deadline: null,
    }),
  ).rejects.toThrow();
  expect(await events()).toEqual([]);
  expect((await readBoard(env.DB)).revision).toBe(0);
  expect(
    (
      await env.DB.prepare(
        "SELECT count(*) AS count FROM notification_deliveries",
      ).first<{ count: number }>()
    )?.count,
  ).toBe(0);
});

it("does not replay events to devices registered after a save", async () => {
  await createTask(env.DB, "a", {
    title: "Tarea",
    assigneeUid: "a",
    deadline: null,
  });
  await env.DB.prepare(
    "INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('late','a','https://fcm.googleapis.com/late','key','auth','2026-01-01','2026-01-01')",
  ).run();
  expect(
    await env.DB.prepare(
      "SELECT * FROM notification_deliveries WHERE registration_id='late'",
    ).first(),
  ).toBeNull();
});

it("submits each saved event to its eligible device using a fake transport", async () => {
  const { dispatchDeliveries } =
    await import("../../src/worker/notification-delivery");
  const task = await createTask(env.DB, "b", {
    title: "Pan",
    assigneeUid: "a",
    deadline: null,
  });
  await replaceTask(env.DB, "b", task.task.id, {
    title: "Pan fresco",
    assigneeUid: "a",
    status: "todo",
    deadline: null,
  });
  const submissions: { registrationId: string; title: string }[] = [];
  await dispatchDeliveries(env.DB, {
    now: new Date(),
    transport: (delivery) => {
      const payload = JSON.parse(delivery.payload) as { title: string };
      submissions.push({
        registrationId: delivery.registrationId,
        title: payload.title,
      });
      return Promise.resolve({ outcome: "accepted" });
    },
  });
  expect(
    submissions.sort(
      (a, b) =>
        a.title.localeCompare(b.title) ||
        a.registrationId.localeCompare(b.registrationId),
    ),
  ).toEqual([
    { registrationId: "ra", title: "Tarea actualizada" },
    { registrationId: "ra", title: "Tarea creada" },
    { registrationId: "rb", title: "Tarea creada" },
  ]);
});
