/** Remove bounded operational history while keeping the current deadline cycle. */
export async function cleanupNotifications(
  db: D1Database,
  now: Date,
  limit = 100,
): Promise<void> {
  const batchSize = Math.max(1, Math.min(100, Math.floor(limit)));
  const cutoff = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db.batch([
    db
      .prepare(
        `DELETE FROM notification_events WHERE id IN (
      SELECT id FROM notification_events WHERE created_at < ?
      ORDER BY created_at, id LIMIT ?
    )`,
      )
      .bind(cutoff, batchSize),
    db
      .prepare(
        `DELETE FROM notification_overdue_dedup WHERE rowid IN (
      SELECT d.rowid FROM notification_overdue_dedup d
      WHERE NOT EXISTS (SELECT 1 FROM notification_deadlines n WHERE n.task_id=d.task_id AND n.cycle_id=d.cycle_id)
      LIMIT ?
    )`,
      )
      .bind(batchSize),
  ]);
}
