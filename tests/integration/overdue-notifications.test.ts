import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import { createTask, replaceTask, deleteTask } from "../../src/worker/tasks";
import { processOverdue } from "../../src/worker/notification-scheduler";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries"),
    env.DB.prepare("DELETE FROM notification_events"),
    env.DB.prepare("DELETE FROM notification_overdue_dedup"),
    env.DB.prepare("DELETE FROM notification_deadlines"),
    env.DB.prepare("DELETE FROM notification_registrations"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM partners"),
    env.DB.prepare("UPDATE board_metadata SET revision=0 WHERE id=1"),
    env.DB.prepare(
      "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
    ),
    env.DB.prepare(
      "INSERT INTO notification_registrations(id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('ra','a','https://fcm.googleapis.com/a','k','a','2026-01-01','2026-01-01'),('rb','b','https://fcm.googleapis.com/b','k','a','2026-01-01','2026-01-01')",
    ),
  ]);
});
const now = new Date("2030-01-01T00:00:00.000Z");
const past = "2029-01-01T00:00:00.000Z";
async function overdue() {
  return (
    await env.DB.prepare(
      "SELECT recipient_uid,cycle_id FROM notification_events WHERE type='overdue' ORDER BY recipient_uid",
    ).all()
  ).results;
}
it("generates once per partner for eligible cycles, including after repeated and concurrent checks", async () => {
  const task = await createTask(env.DB, "a", {
    title: "Pan",
    assigneeUid: "a",
    deadline: past,
  });
  await createTask(env.DB, "a", {
    title: "Sin fecha",
    assigneeUid: "a",
    deadline: null,
  });
  const completed = await createTask(env.DB, "a", {
    title: "Lista",
    assigneeUid: "a",
    deadline: past,
  });
  await replaceTask(env.DB, "a", completed.task.id, {
    title: "Lista",
    assigneeUid: "a",
    status: "completed",
    deadline: past,
  });
  await Promise.all([processOverdue(env.DB, now), processOverdue(env.DB, now)]);
  await processOverdue(env.DB, now);
  expect(await overdue()).toHaveLength(2);
  await replaceTask(env.DB, "a", task.task.id, {
    title: "Pan",
    assigneeUid: "a",
    status: "completed",
    deadline: past,
  });
  await replaceTask(env.DB, "a", task.task.id, {
    title: "Pan",
    assigneeUid: "a",
    status: "todo",
    deadline: past,
  });
  await processOverdue(env.DB, now);
  expect(await overdue()).toHaveLength(2);
  await replaceTask(env.DB, "a", task.task.id, {
    title: "Pan",
    assigneeUid: "a",
    status: "todo",
    deadline: "2029-02-01T00:00:00.000Z",
  });
  await processOverdue(env.DB, now);
  expect(await overdue()).toHaveLength(4);
  await deleteTask(env.DB, "a", task.task.id);
  const pending = await env.DB.prepare(
    "SELECT count(*) n FROM notification_deliveries d JOIN notification_events e ON e.id=d.event_id WHERE e.type='overdue' AND d.state IN ('pending','leased')",
  ).first<{ n: number }>();
  expect(pending?.n).toBe(0);
});

it("cancels obsolete deliveries on completion or deadline replacement and processes backlog in bounded batches", async () => {
  const first = await createTask(env.DB, "a", {
    title: "Uno",
    assigneeUid: "a",
    deadline: past,
  });
  const second = await createTask(env.DB, "a", {
    title: "Dos",
    assigneeUid: "b",
    deadline: past,
  });
  await processOverdue(env.DB, now, 1);
  expect(await overdue()).toHaveLength(2);
  await processOverdue(env.DB, now, 1);
  expect(await overdue()).toHaveLength(4);
  await replaceTask(env.DB, "a", first.task.id, {
    title: "Uno",
    assigneeUid: "a",
    status: "completed",
    deadline: past,
  });
  await replaceTask(env.DB, "a", second.task.id, {
    title: "Dos",
    assigneeUid: "b",
    status: "todo",
    deadline: "2031-01-01T00:00:00.000Z",
  });
  const pending = await env.DB.prepare(
    "SELECT count(*) n FROM notification_deliveries d JOIN notification_events e ON e.id=d.event_id WHERE e.type='overdue' AND d.state IN ('pending','leased')",
  ).first<{ n: number }>();
  expect(pending?.n).toBe(0);
  await processOverdue(env.DB, now);
  expect(await overdue()).toHaveLength(4);
});

it("generates and submits an already overdue task during the scheduled check", async () => {
  const { createWorker } = await import("../../src/worker/index");
  await createTask(env.DB, "a", {
    title: "Pendiente",
    assigneeUid: "a",
    deadline: past,
  });
  const submissions: string[] = [];
  const worker = createWorker(true, (delivery) => {
    submissions.push(delivery.eventId);
    return Promise.resolve({ outcome: "accepted" });
  });
  await worker.scheduled(
    { scheduledTime: now.getTime() },
    {
      ...env,
      VAPID_PUBLIC_KEY: "public",
      VAPID_PRIVATE_KEY: "private",
      VAPID_SUBJECT: "mailto:test@example.test",
    },
  );
  expect(await overdue()).toHaveLength(2);
  expect(submissions).toHaveLength(2);
});

it("preserves cycles across unrelated changes and reopening, and replaces them when a deadline is removed and re-added", async () => {
  const task = await createTask(env.DB, "a", {
    title: "Ciclo",
    assigneeUid: "a",
    deadline: null,
  });
  const cycle = async () =>
    (
      await env.DB.prepare(
        "SELECT cycle_id FROM notification_deadlines WHERE task_id=?",
      )
        .bind(task.task.id)
        .first<{ cycle_id: string }>()
    )?.cycle_id;
  expect(await cycle()).toBeUndefined();
  const save = (
    title: string,
    status: "todo" | "completed",
    deadline: string | null,
  ) =>
    replaceTask(env.DB, "a", task.task.id, {
      title,
      assigneeUid: "a",
      status,
      deadline,
    });
  await save("Ciclo", "todo", past);
  const first = await cycle();
  expect(first).toBeTruthy();
  await save("Ciclo nuevo", "completed", past);
  await save("Ciclo nuevo", "todo", past);
  expect(await cycle()).toBe(first);
  await save("Ciclo nuevo", "todo", null);
  expect(await cycle()).toBeUndefined();
  await save("Ciclo nuevo", "todo", past);
  expect(await cycle()).not.toBe(first);
});

it("submits a newly due event on the next minute check and retries after configuration returns", async () => {
  const { createWorker } = await import("../../src/worker/index");
  const deadline = new Date(now.getTime() - 30_000).toISOString();
  await createTask(env.DB, "a", {
    title: "A tiempo",
    assigneeUid: "a",
    deadline,
  });
  const submissions: string[] = [];
  const worker = createWorker(true, (delivery) => {
    submissions.push(delivery.eventId);
    return Promise.resolve({ outcome: "accepted" });
  });
  await worker.scheduled({ scheduledTime: now.getTime() }, env);
  expect(await overdue()).toHaveLength(2);
  expect(submissions).toHaveLength(0);
  await worker.scheduled(
    { scheduledTime: now.getTime() + 60_000 },
    {
      ...env,
      VAPID_PUBLIC_KEY: "public",
      VAPID_PRIVATE_KEY: "private",
      VAPID_SUBJECT: "mailto:test@example.test",
    },
  );
  expect(submissions).toHaveLength(2);
});

it("submits both devices 30 seconds after the deadline under normal fake transport", async () => {
  const { createWorker } = await import("../../src/worker/index");
  await createTask(env.DB, "a", {
    title: "Ahora",
    assigneeUid: "a",
    deadline: new Date(now.getTime() - 30_000).toISOString(),
  });
  const submissions: string[] = [];
  const worker = createWorker(true, (delivery) => {
    submissions.push(delivery.registrationId);
    return Promise.resolve({ outcome: "accepted" });
  });
  await worker.scheduled(
    { scheduledTime: now.getTime() },
    {
      ...env,
      VAPID_PUBLIC_KEY: "public",
      VAPID_PRIVATE_KEY: "private",
      VAPID_SUBJECT: "mailto:test@example.test",
    },
  );
  expect(submissions.sort()).toEqual(["ra", "rb"]);
});
