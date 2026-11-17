import type { DeliveryOutcome } from "../shared/notifications";

export interface ClaimedDelivery {
  eventId: string;
  registrationId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
  attemptCount: number;
  createdAt: string;
}
export type DeliveryTransport = (
  delivery: ClaimedDelivery,
) => Promise<{ outcome: DeliveryOutcome; retryAfter?: string | null }>;

// Include this statement in the same D1 batch that creates the event.
export function snapshotEventDeliveries(
  db: D1Database,
  eventId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO notification_deliveries(event_id, registration_id, next_attempt_at)
    SELECT e.id, r.id, ? FROM notification_events e JOIN notification_registrations r ON r.partner_uid=e.recipient_uid
    WHERE e.id=? AND r.active=1 AND (r.expiration_time IS NULL OR r.expiration_time>?)`,
    )
    .bind(now, eventId, Date.parse(now));
}

function retryDelay(
  attempt: number,
  retryAfter: string | null | undefined,
  now: number,
): number {
  let delay = Math.min(3600, 30 * 2 ** Math.min(attempt - 1, 7));
  if (retryAfter) {
    const seconds = /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : (Date.parse(retryAfter) - now) / 1000;
    if (Number.isFinite(seconds)) delay = Math.max(delay, seconds);
  }
  return Math.min(86400, Math.max(0, delay));
}

export async function dispatchDeliveries(
  db: D1Database,
  options: { now: Date; transport: DeliveryTransport; limit?: number },
): Promise<void> {
  const now = options.now.toISOString();
  const nowMs = options.now.getTime();
  const cutoff = new Date(nowMs - 86400000).toISOString();
  const limit = Math.max(1, Math.min(20, Math.floor(options.limit ?? 10)));
  await db.batch([
    db
      .prepare(
        `UPDATE notification_deliveries SET state='abandoned',lease_expires_at=NULL,last_error='expired' WHERE state IN ('pending','leased') AND event_id IN (SELECT id FROM notification_events WHERE created_at<=?)`,
      )
      .bind(cutoff),
    db
      .prepare(
        `UPDATE notification_deliveries SET state='abandoned',lease_expires_at=NULL,last_error='invalid_registration' WHERE state IN ('pending','leased') AND registration_id IN (SELECT id FROM notification_registrations WHERE active=0 OR (expiration_time IS NOT NULL AND expiration_time<=?))`,
      )
      .bind(nowMs),
  ]);
  const candidates = await db
    .prepare(
      `SELECT event_id, registration_id FROM notification_deliveries WHERE (state='pending' AND next_attempt_at<=?) OR (state='leased' AND lease_expires_at<=?) ORDER BY next_attempt_at,event_id,registration_id LIMIT ?`,
    )
    .bind(now, now, limit)
    .all<{ event_id: string; registration_id: string }>();
  await Promise.all(
    candidates.results.map(async ({ event_id, registration_id }) => {
      const leaseUntil = new Date(nowMs + 60000).toISOString();
      const claim = await db
        .prepare(
          `UPDATE notification_deliveries SET state='leased',lease_expires_at=?,attempt_count=attempt_count+1 WHERE event_id=? AND registration_id=? AND ((state='pending' AND next_attempt_at<=?) OR (state='leased' AND lease_expires_at<=?)) RETURNING attempt_count`,
        )
        .bind(leaseUntil, event_id, registration_id, now, now)
        .first<{ attempt_count: number }>();
      if (!claim) return;
      const row = await db
        .prepare(
          `SELECT r.endpoint,r.p256dh,r.auth,e.payload,e.created_at FROM notification_registrations r JOIN notification_events e ON e.id=? WHERE r.id=? AND r.active=1 AND (r.expiration_time IS NULL OR r.expiration_time>?)`,
        )
        .bind(event_id, registration_id, nowMs)
        .first<{
          endpoint: string;
          p256dh: string;
          auth: string;
          payload: string;
          created_at: string;
        }>();
      if (!row) return;
      let result: { outcome: DeliveryOutcome; retryAfter?: string | null };
      try {
        result = await options.transport({
          eventId: event_id,
          registrationId: registration_id,
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          payload: row.payload,
          attemptCount: claim.attempt_count,
          createdAt: row.created_at,
        });
      } catch {
        result = { outcome: "temporary_failure" };
      }
      const outcome = result.outcome;
      const state =
        outcome === "accepted"
          ? "accepted"
          : outcome === "invalid_registration" ||
              outcome === "permanent_failure"
            ? "abandoned"
            : "pending";
      const retry = new Date(
        nowMs +
          retryDelay(claim.attempt_count, result.retryAfter, nowMs) * 1000,
      ).toISOString();
      const updated = await db
        .prepare(
          `UPDATE notification_deliveries SET state=?,lease_expires_at=NULL,next_attempt_at=?,last_error=?,accepted_at=? WHERE event_id=? AND registration_id=? AND state='leased' AND attempt_count=? AND lease_expires_at=?`,
        )
        .bind(
          state,
          retry,
          outcome === "accepted" ? null : outcome,
          outcome === "accepted" ? now : null,
          event_id,
          registration_id,
          claim.attempt_count,
          leaseUntil,
        )
        .run();
      if (updated.meta.changes === 1) {
        await db
          .prepare(
            "UPDATE notification_registrations SET last_outcome=?,active=CASE WHEN ?='invalid_registration' THEN 0 ELSE active END WHERE id=?",
          )
          .bind(outcome, outcome, registration_id)
          .run();
      }
    }),
  );
}
