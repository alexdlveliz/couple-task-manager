import { ApiFailure } from "./errors";
import {
  createVapidAuthorization,
  isAllowedPushEndpoint,
  validatePushInputs,
} from "./web-push";
import type { Env } from "./env";

const invalid = () =>
  new ApiFailure(
    400,
    "VALIDATION_ERROR",
    "Revisa los datos de notificaciones.",
  );
const missing = () =>
  new ApiFailure(404, "NOT_FOUND", "No se encontró la suscripción.");
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export async function notificationConfig(env: Env) {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT)
      throw new Error();
    await createVapidAuthorization(
      "https://fcm.googleapis.com/",
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_SUBJECT,
    );
    return { available: true, publicKey: env.VAPID_PUBLIC_KEY, problem: null };
  } catch {
    return {
      available: false,
      publicKey: null,
      problem: "El servicio de notificaciones no está disponible.",
    };
  }
}

export async function saveSubscription(
  db: D1Database,
  uid: string,
  value: unknown,
) {
  if (
    !object(value) ||
    typeof value.endpoint !== "string" ||
    !isAllowedPushEndpoint(value.endpoint) ||
    !object(value.keys) ||
    typeof value.keys.p256dh !== "string" ||
    typeof value.keys.auth !== "string" ||
    !(
      value.expirationTime === undefined ||
      value.expirationTime === null ||
      (typeof value.expirationTime === "number" &&
        Number.isSafeInteger(value.expirationTime) &&
        value.expirationTime > Date.now())
    )
  )
    throw invalid();
  const { endpoint, keys } = value;
  const expirationTime = value.expirationTime ?? null;
  const p256dh = keys.p256dh as string,
    auth = keys.auth as string;
  try {
    validatePushInputs(p256dh, auth, "{}");
    const raw = Uint8Array.from(
      atob(p256dh.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
  } catch {
    throw invalid();
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO notification_registrations (id,partner_uid,endpoint,p256dh,auth,expiration_time,created_at,updated_at,active,last_outcome)
    VALUES (?,?,?,?,?,?,?,?,1,NULL)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, expiration_time=excluded.expiration_time, updated_at=excluded.updated_at, active=1, last_outcome=NULL
    WHERE notification_registrations.partner_uid=excluded.partner_uid RETURNING id`,
    )
    .bind(id, uid, endpoint, p256dh, auth, expirationTime, now, now)
    .first<{ id: string }>();
  if (!result)
    throw new ApiFailure(
      409,
      "SUBSCRIPTION_CONFLICT",
      "Esta suscripción pertenece a otra cuenta.",
    );
  return { id: result.id, active: true as const, created: result.id === id };
}

export async function subscriptionStatus(
  db: D1Database,
  uid: string,
  id: string,
) {
  const row = await db
    .prepare(
      "SELECT id, active, last_outcome FROM notification_registrations WHERE id=? AND partner_uid=?",
    )
    .bind(id, uid)
    .first<{ id: string; active: number; last_outcome: string | null }>();
  if (!row) throw missing();
  return {
    id: row.id,
    active: row.active === 1,
    lastOutcome: row.last_outcome,
  };
}

export async function removeSubscription(
  db: D1Database,
  uid: string,
  id: string,
) {
  const result = await db.batch([
    db
      .prepare(
        "UPDATE notification_registrations SET active=0, updated_at=? WHERE id=? AND partner_uid=? RETURNING id",
      )
      .bind(new Date().toISOString(), id, uid),
    db
      .prepare(
        "UPDATE notification_deliveries SET state='abandoned', lease_expires_at=NULL WHERE registration_id=? AND state IN ('pending','leased') AND EXISTS (SELECT 1 FROM notification_registrations WHERE id=? AND partner_uid=?)",
      )
      .bind(id, id, uid),
  ]);
  if (!result[0].results.length) throw missing();
}
