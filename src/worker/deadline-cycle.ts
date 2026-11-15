export function deadlineTransition(
  oldDeadline: string | null,
  newDeadline: string | null,
): "new" | "remove" | "preserve" {
  if (oldDeadline === newDeadline) return "preserve";
  return newDeadline === null ? "remove" : "new";
}

// Called immediately after the guarded revision update in the same D1 batch.
export function deadlineCycleStatements(
  db: D1Database,
  taskId: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT INTO notification_deadlines(task_id,cycle_id,deadline)
      SELECT id,lower(hex(randomblob(16))),deadline FROM tasks WHERE id=? AND deadline IS NOT NULL AND changes()=1
      ON CONFLICT(task_id) DO UPDATE SET cycle_id=CASE WHEN notification_deadlines.deadline IS NOT excluded.deadline THEN excluded.cycle_id ELSE notification_deadlines.cycle_id END, deadline=excluded.deadline`,
      )
      .bind(taskId),
    db
      .prepare(
        `DELETE FROM notification_deadlines WHERE task_id=? AND EXISTS (SELECT 1 FROM tasks WHERE id=? AND deadline IS NULL)`,
      )
      .bind(taskId, taskId),
    db
      .prepare(
        `UPDATE notification_deliveries SET state='abandoned',lease_expires_at=NULL,last_error='obsolete' WHERE state IN ('pending','leased') AND event_id IN (SELECT e.id FROM notification_events e WHERE e.task_id=? AND e.type='overdue' AND NOT EXISTS (SELECT 1 FROM tasks t JOIN notification_deadlines n ON n.task_id=t.id WHERE t.id=e.task_id AND t.status<>'completed' AND n.cycle_id=e.cycle_id))`,
      )
      .bind(taskId),
  ];
}
