import { env } from "cloudflare:workers";
import { expect, it } from "vitest";

it("enforces unique registration endpoints and event-device pairs", async () => {
  await env.DB.prepare("INSERT INTO partners VALUES (1,'schema-a','Ana',1),(2,'schema-b','Bea',1)").run();
  await env.DB.prepare("INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('r1','schema-a','https://example.test/push','key','auth','now','now')").run();
  await expect(env.DB.prepare("INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('r2','schema-b','https://example.test/push','key','auth','now','now')").run()).rejects.toThrow();
  await env.DB.prepare("INSERT INTO notification_events (id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('e1','task','created',1,'schema-a','{}','now')").run();
  await env.DB.prepare("INSERT INTO notification_deliveries (event_id,registration_id,next_attempt_at) VALUES ('e1','r1','now')").run();
  await expect(env.DB.prepare("INSERT INTO notification_deliveries (event_id,registration_id,next_attempt_at) VALUES ('e1','r1','now')").run()).rejects.toThrow();
  await expect(env.DB.prepare("INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('r3','schema-a','http://example.test/push','key','auth','now','now')").run()).rejects.toThrow();
  await expect(env.DB.prepare("INSERT INTO notification_events (id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('e2','task','created',1,'schema-a','{}','now')").run()).rejects.toThrow();
  await env.DB.prepare("INSERT INTO notification_events (id,task_id,type,cycle_id,recipient_uid,payload,created_at) VALUES ('e3','task','overdue','cycle','schema-a','{}','now')").run();
  await expect(env.DB.prepare("INSERT INTO notification_events (id,task_id,type,cycle_id,recipient_uid,payload,created_at) VALUES ('e4','task','overdue','cycle','schema-a','{}','now')").run()).rejects.toThrow();
});
