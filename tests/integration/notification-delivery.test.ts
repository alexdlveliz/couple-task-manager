import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryOutcome } from "../../src/shared/notifications";

type Transport = (delivery: {
  eventId: string;
  registrationId: string;
}) => Promise<{ outcome: DeliveryOutcome; retryAfter?: string | null }>;
type Dispatcher = (
  db: D1Database,
  options: { now: Date; transport: Transport; limit?: number },
) => Promise<void>;
const modulePath = "../../src/worker/notification-delivery";
async function dispatch(now: string, transport: Transport): Promise<void> {
  const delivery = (await import(modulePath)) as {
    dispatchDeliveries: Dispatcher;
  };
  await delivery.dispatchDeliveries(env.DB, {
    now: new Date(now),
    transport,
    limit: 10,
  });
}
const start = "2026-01-01T12:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries"),
    env.DB.prepare("DELETE FROM notification_events"),
    env.DB.prepare("DELETE FROM notification_registrations"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM partners"),
    env.DB.prepare(
      "INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)",
    ),
    env.DB.prepare(
      "INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('r1','a','https://fcm.googleapis.com/1','key','auth',?,?),('r2','a','https://fcm.googleapis.com/2','key','auth',?,?)",
    ).bind(start, start, start, start),
    env.DB.prepare(
      "INSERT INTO notification_events (id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('event','task','created',1,'a','{}',?)",
    ).bind(start),
    env.DB.prepare(
      "INSERT INTO notification_deliveries (event_id,registration_id,next_attempt_at) VALUES ('event','r1',?),('event','r2',?)",
    ).bind(start, start),
  ]);
});

async function rows() {
  return (
    await env.DB.prepare(
      "SELECT registration_id, state, attempt_count, next_attempt_at, lease_expires_at, last_error FROM notification_deliveries ORDER BY registration_id",
    ).all()
  ).results;
}

describe("notification delivery", () => {
  it("claims each device once across concurrent dispatchers", async () => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ outcome: "accepted" });
    await Promise.all([dispatch(start, transport), dispatch(start, transport)]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect((await rows()).map((row) => row.state)).toEqual([
      "accepted",
      "accepted",
    ]);
  });

  it("retries an expired lease after ambiguous acceptance", async () => {
    await env.DB.prepare(
      "UPDATE notification_deliveries SET state='leased',lease_expires_at=? WHERE registration_id='r1'",
    )
      .bind("2026-01-01T11:59:00.000Z")
      .run();
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ outcome: "accepted" });
    await dispatch(start, transport);
    expect(
      transport.mock.calls.map((call) => call[0].registrationId).sort(),
    ).toEqual(["r1", "r2"]);
    expect((await rows()).map((row) => row.state)).toEqual([
      "accepted",
      "accepted",
    ]);
  });

  it("disables an invalid registration without blocking another device", async () => {
    const transport = vi
      .fn<Transport>()
      .mockImplementation(async ({ registrationId }) => ({
        outcome: registrationId === "r1" ? "invalid_registration" : "accepted",
      }));
    await dispatch(start, transport);
    expect((await rows()).map((row) => row.state)).toEqual([
      "abandoned",
      "accepted",
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT active FROM notification_registrations WHERE id='r1'",
        ).first()
      )?.active,
    ).toBe(0);
  });

  it("honors Retry-After and retries temporary errors without recording sensitive details", async () => {
    const transport = vi
      .fn<Transport>()
      .mockImplementation(async ({ registrationId }) =>
        registrationId === "r1"
          ? { outcome: "rate_limited", retryAfter: "120" }
          : { outcome: "temporary_failure" },
      );
    await dispatch(start, transport);
    const result = await rows();
    expect(result.map((row) => row.state)).toEqual(["pending", "pending"]);
    expect(result[0].next_attempt_at).toBe("2026-01-01T12:02:00.000Z");
    expect(result.map((row) => row.last_error)).toEqual([
      "rate_limited",
      "temporary_failure",
    ]);
    expect(result.map((row) => row.attempt_count)).toEqual([1, 1]);
  });

  it("abandons deliveries after the 24-hour retry ceiling", async () => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ outcome: "accepted" });
    await dispatch("2026-01-02T12:00:00.000Z", transport);
    expect(transport).not.toHaveBeenCalled();
    expect((await rows()).map((row) => row.state)).toEqual([
      "abandoned",
      "abandoned",
    ]);
  });

  it("retries a thrown network error and continues sending other devices", async () => {
    const transport = vi
      .fn<Transport>()
      .mockImplementation(async ({ registrationId }) => {
        if (registrationId === "r1")
          throw new Error("private endpoint details");
        return { outcome: "accepted" };
      });
    await dispatch(start, transport);
    const result = await rows();
    expect(result.map((row) => row.state)).toEqual(["pending", "accepted"]);
    expect(result[0].last_error).toBe("temporary_failure");
  });

  it("does not replay an event to a registration added after event creation", async () => {
    await env.DB.prepare(
      "INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,created_at,updated_at) VALUES ('late','a','https://fcm.googleapis.com/late','key','auth',?,?)",
    )
      .bind(start, start)
      .run();
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ outcome: "accepted" });
    await dispatch(start, transport);
    expect(
      transport.mock.calls.map((call) => call[0].registrationId).sort(),
    ).toEqual(["r1", "r2"]);
    expect(
      await env.DB.prepare(
        "SELECT * FROM notification_deliveries WHERE registration_id='late'",
      ).first(),
    ).toBeNull();
  });

  it("does not send a registration whose subscription has expired", async () => {
    await env.DB.prepare(
      "UPDATE notification_registrations SET expiration_time=? WHERE id='r1'",
    )
      .bind(new Date(start).getTime() - 1)
      .run();
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ outcome: "accepted" });
    await dispatch(start, transport);
    expect(transport.mock.calls.map((call) => call[0].registrationId)).toEqual([
      "r2",
    ]);
    expect((await rows())[0].state).toBe("abandoned");
  });

  it("snapshots only active registrations in the event creation batch", async () => {
    const delivery = (await import(modulePath)) as {
      snapshotEventDeliveries: (db: D1Database, id: string, now: string) => D1PreparedStatement;
    };
    await env.DB.prepare("UPDATE notification_registrations SET active=0 WHERE id='r2'").run();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO notification_events (id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('new-event','task','created',2,'a','{}',?)").bind(start),
      delivery.snapshotEventDeliveries(env.DB, "new-event", start),
    ]);
    const result = await env.DB.prepare("SELECT registration_id FROM notification_deliveries WHERE event_id='new-event'").all();
    expect(result.results).toEqual([{ registration_id: "r1" }]);
  });
});
