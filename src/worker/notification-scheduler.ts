/** Generate a bounded batch of overdue events. Each candidate is rechecked in its transaction. */
export async function processOverdue(
  db: D1Database,
  clock: Date,
  limit = 20,
): Promise<void> {
  const now = clock.toISOString();
  const batchSize = Math.max(1, Math.min(100, Math.floor(limit)));
  const due = await db
    .prepare(
      `SELECT n.task_id, n.cycle_id FROM notification_deadlines n JOIN tasks t ON t.id=n.task_id
    WHERE n.deadline<=? AND t.status<>'completed' AND EXISTS (SELECT 1 FROM partners p WHERE p.enabled=1 AND (t.visibility='shared' OR p.uid=t.creator_uid) AND NOT EXISTS (SELECT 1 FROM notification_overdue_dedup d WHERE d.task_id=n.task_id AND d.cycle_id=n.cycle_id AND d.recipient_uid=p.uid))
    ORDER BY n.deadline,n.task_id LIMIT ?`,
    )
    .bind(now, batchSize)
    .all<{ task_id: string; cycle_id: string }>();
  for (const candidate of due.results) {
    const prefix = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO notification_events(id,task_id,type,recipient_uid,cycle_id,payload,created_at)
        SELECT ? || '-' || p.uid,t.id,'overdue',p.uid,n.cycle_id,
          json_object('version',1,'eventId',? || '-' || p.uid,'title','Tarea vencida','body','La fecha límite de la tarea ha llegado: ' || t.title,'url','/'), ?
        FROM notification_deadlines n JOIN tasks t ON t.id=n.task_id JOIN partners p ON p.enabled=1 AND (t.visibility='shared' OR p.uid=t.creator_uid)
        WHERE n.task_id=? AND n.cycle_id=? AND n.deadline<=? AND t.status<>'completed'
        AND NOT EXISTS (SELECT 1 FROM notification_overdue_dedup d WHERE d.task_id=n.task_id AND d.cycle_id=n.cycle_id AND d.recipient_uid=p.uid)`,
        )
        .bind(prefix, prefix, now, candidate.task_id, candidate.cycle_id, now),
      db
        .prepare(
          `INSERT OR IGNORE INTO notification_overdue_dedup(task_id,cycle_id,recipient_uid) SELECT task_id,cycle_id,recipient_uid FROM notification_events WHERE id LIKE ?`,
        )
        .bind(prefix + "-%"),
      db
        .prepare(
          `INSERT OR IGNORE INTO notification_deliveries(event_id,registration_id,next_attempt_at) SELECT e.id,r.id,? FROM notification_events e JOIN notification_registrations r ON r.partner_uid=e.recipient_uid WHERE e.id LIKE ? AND r.active=1 AND (r.expiration_time IS NULL OR r.expiration_time>?)`,
        )
        .bind(now, prefix + "-%", clock.getTime()),
    ]);
  }
}
