import { env } from "cloudflare:workers";
import { expect, it } from "vitest";

const modulePath = "../../src/worker/notification-maintenance";
it("removes old operational records in bounded batches while retaining current-cycle deduplication", async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries"),
    env.DB.prepare("DELETE FROM notification_events"),
    env.DB.prepare("DELETE FROM notification_overdue_dedup"),
    env.DB.prepare("DELETE FROM notification_deadlines"),
    env.DB.prepare("DELETE FROM notification_registrations"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM partners"),
    env.DB.prepare(
      "INSERT INTO partners VALUES (1,'ret-a','Ana',1),(2,'ret-b','Bea',1)",
    ),
    env.DB.prepare(
      "INSERT INTO tasks VALUES ('ret-task','Tarea','ret-a','todo','2026-01-01','2025-01-01','2025-01-01')",
    ),
    env.DB.prepare(
      "INSERT INTO notification_deadlines VALUES ('ret-task','current','2026-01-01')",
    ),
    env.DB.prepare(
      "INSERT INTO notification_overdue_dedup VALUES ('ret-task','current','ret-a'),('ret-task','old','ret-a')",
    ),
    env.DB.prepare(
      "INSERT INTO notification_registrations(id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('ret-device','ret-a','https://fcm.googleapis.com/ret','k','a','2026-01-01','2026-01-01')",
    ),
    env.DB.prepare(
      "INSERT INTO notification_events(id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('old1','ret-task','created',1,'ret-a','{}','2026-01-01T00:00:00.000Z'),('old2','ret-task','created',2,'ret-a','{}','2026-01-02T00:00:00.000Z'),('new','ret-task','created',3,'ret-a','{}','2026-01-09T00:00:00.000Z')",
    ),
    env.DB.prepare(
      "INSERT INTO notification_deliveries(event_id,registration_id,state,next_attempt_at) VALUES ('old1','ret-device','accepted','2026-01-01'),('old2','ret-device','abandoned','2026-01-01'),('new','ret-device','pending','2026-01-09')",
    ),
  ]);
  const maintenance = (await import(modulePath)) as {
    cleanupNotifications: (
      db: D1Database,
      now: Date,
      limit: number,
    ) => Promise<void>;
  };
  await maintenance.cleanupNotifications(
    env.DB,
    new Date("2026-01-10T00:00:00.000Z"),
    1,
  );
  const first = await env.DB.prepare(
    "SELECT id FROM notification_events ORDER BY id",
  ).all();
  expect(first.results).toHaveLength(2);
  await maintenance.cleanupNotifications(
    env.DB,
    new Date("2026-01-10T00:00:00.000Z"),
    10,
  );
  expect(
    (await env.DB.prepare("SELECT id FROM notification_events").all()).results,
  ).toEqual([{ id: "new" }]);
  expect(
    (await env.DB.prepare("SELECT event_id FROM notification_deliveries").all())
      .results,
  ).toEqual([{ event_id: "new" }]);
  expect(
    (
      await env.DB.prepare(
        "SELECT cycle_id FROM notification_overdue_dedup",
      ).all()
    ).results,
  ).toEqual([{ cycle_id: "current" }]);
});
