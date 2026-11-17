import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../src/worker/local";

const encode = (data: unknown) =>
  btoa(JSON.stringify(data))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const token = (uid: string) => {
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none" })}.${encode({ sub: uid, aud: "demo-shared-task-board", iss: "https://securetoken.google.com/demo-shared-task-board", iat: now, auth_time: now, exp: now + 3600 })}.`;
};
const local = {
  ...env,
  AUTH_MODE: "emulator" as const,
  ENVIRONMENT: "local",
  FIREBASE_PROJECT_ID: "demo-shared-task-board",
};
const request = (path: string, uid = "a", init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (uid) headers.set("Authorization", `Bearer ${token(uid)}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return worker.fetch(
    new Request(`https://example.test${path}`, { ...init, headers }),
    local,
  );
};
const body = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device",
  expirationTime: null,
  keys: {
    p256dh:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
  },
};
const post = (value: unknown, uid = "a") =>
  request("/api/notifications/subscriptions", uid, {
    method: "POST",
    body: JSON.stringify(value),
  });

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
  ]);
});
describe("notification subscriptions", () => {
  it("authenticates all routes and reports configuration without caching", async () => {
    expect((await request("/api/notifications/config", "")).status).toBe(401);
    expect(
      (await request("/api/notifications/config", "outsider")).status,
    ).toBe(403);
    const config = await request("/api/notifications/config");
    expect(config.status).toBe(200);
    expect(config.headers.get("Cache-Control")).toBe("no-store");
    expect(await config.json()).toEqual({
      available: false,
      publicKey: null,
      problem: "El servicio de notificaciones no está disponible.",
    });
  });
  it("creates, refreshes, isolates and disables registrations", async () => {
    const created = await post(body);
    expect(created.status).toBe(201);
    expect(created.headers.get("Cache-Control")).toBe("no-store");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Response.json is unknown under typecheck.
    const { id } = (await created.json()) as { id: string };
    expect((await post(body)).status).toBe(200);
    expect((await post(body, "b")).status).toBe(409);
    expect(
      (await request(`/api/notifications/subscriptions/${id}`, "b")).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/notifications/subscriptions/${id}`, "b", {
          method: "DELETE",
        })
      ).status,
    ).toBe(404);
    expect(
      await (await request(`/api/notifications/subscriptions/${id}`)).json(),
    ).toEqual({ id, active: true, lastOutcome: null });
    await env.DB.prepare(
      "INSERT INTO notification_events (id,task_id,type,revision,recipient_uid,payload,created_at) VALUES ('e','t','created',1,'a','{}','now')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO notification_deliveries (event_id,registration_id,next_attempt_at) VALUES ('e',?,'now')",
    )
      .bind(id)
      .run();
    expect(
      (
        await request(`/api/notifications/subscriptions/${id}`, "a", {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await env.DB.prepare(
          "SELECT state FROM notification_deliveries WHERE event_id='e'",
        ).first()
      )?.state,
    ).toBe("abandoned");
    expect(
      await (await request(`/api/notifications/subscriptions/${id}`)).json(),
    ).toEqual({ id, active: false, lastOutcome: null });
  });
  it("keeps multiple devices independent and protects every route", async () => {
    const first = await post(body);
    const second = await post({
      ...body,
      endpoint: "https://fcm.googleapis.com/fcm/send/other",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Response.json is unknown under typecheck.
    const { id } = (await first.json()) as { id: string };
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Response.json is unknown under typecheck.
    const other = (await second.json()) as { id: string };
    for (const [path, method] of [
      ["/api/notifications/config", "GET"],
      ["/api/notifications/subscriptions", "POST"],
      [`/api/notifications/subscriptions/${id}`, "GET"],
      [`/api/notifications/subscriptions/${id}`, "DELETE"],
    ]) {
      const response = await request(path, "", { method });
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect((await request(path, "outsider", { method })).status).toBe(403);
    }
    await request(`/api/notifications/subscriptions/${id}`, "a", {
      method: "DELETE",
    });
    expect(
      await (
        await request(`/api/notifications/subscriptions/${other.id}`)
      ).json(),
    ).toEqual({ id: other.id, active: true, lastOutcome: null });
    expect(
      (
        await request(`/api/notifications/subscriptions/${id}`, "a", {
          method: "POST",
        })
      ).status,
    ).toBe(405);
  });
  it("rejects invalid endpoints, keys, expiry and oversized bodies", async () => {
    for (const value of [
      { ...body, endpoint: "https://evil.example/push" },
      { ...body, endpoint: "http://fcm.googleapis.com/x" },
      { ...body, keys: { ...body.keys, auth: "bad" } },
      { ...body, keys: { ...body.keys, p256dh: "B" + "A".repeat(86) } },
      { ...body, expirationTime: -1 },
      { ...body, expirationTime: "tomorrow" },
    ])
      expect((await post(value)).status).toBe(400);
    expect((await post({ ...body, padding: "x".repeat(8192) })).status).toBe(
      413,
    );
  });
});
