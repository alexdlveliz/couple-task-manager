// Select from the current task inside the mutation batch: no stale pre-read can
// influence classification. Inputs are bound as one JSON value.
export const eventSelectionSql = `
WITH input AS (SELECT json_extract(value,'$.id') id, json_extract(value,'$.actor') actor,
 json_extract(value,'$.title') title, json_extract(value,'$.assigneeUid') assignee,
 json_extract(value,'$.status') status, json_extract(value,'$.deadline') deadline,
 json_extract(value,'$.now') now, json_extract(value,'$.eventId') event_id,
 json_extract(value,'$.creating') creating FROM (SELECT ? value)),
 changes AS (
 SELECT i.*, t.title IS NOT i.title AS title_changed,
 t.assignee_uid IS NOT i.assignee AS assignee_changed,
 t.deadline IS NOT i.deadline AS deadline_changed,
 t.status IS NOT i.status AS status_changed,
 (t.status <> 'completed' AND i.status = 'completed') AS completion
 FROM input i LEFT JOIN tasks t ON t.id=i.id
 WHERE (i.creating OR t.id IS NOT NULL)
 AND EXISTS (SELECT 1 FROM partners WHERE uid=i.actor AND enabled=1)
 AND EXISTS (SELECT 1 FROM partners WHERE uid=i.assignee AND enabled=1)
 AND (SELECT count(*) FROM partners)=2
 AND EXISTS (SELECT 1 FROM board_metadata WHERE id=1 AND revision<9007199254740991)
), chosen AS (
 SELECT c.*, p.uid recipient_uid, c.event_id || '-' || p.uid AS notification_id,
 CASE WHEN c.creating THEN 'created' WHEN c.completion THEN 'completed' ELSE 'changed' END type,
 trim((CASE WHEN c.title_changed THEN 'título, ' ELSE '' END) ||
 (CASE WHEN c.assignee_changed THEN 'asignación, ' ELSE '' END) ||
 (CASE WHEN c.deadline_changed THEN 'fecha límite, ' ELSE '' END) ||
 (CASE WHEN c.status_changed AND NOT c.completion THEN 'estado, ' ELSE '' END), ', ') AS fields
 FROM changes c JOIN partners p ON p.enabled=1
 WHERE c.creating OR c.completion OR (p.uid<>c.actor AND (c.title_changed OR c.assignee_changed OR c.deadline_changed OR c.status_changed))
)
SELECT notification_id id, id task_id, type, (SELECT revision+1 FROM board_metadata WHERE id=1) revision,
 recipient_uid, CASE WHEN creating OR (completion AND recipient_uid=actor) THEN '' ELSE fields END changed_fields,
 json_object('version',1,'eventId',notification_id,'title',
 CASE type WHEN 'created' THEN 'Tarea creada' WHEN 'completed' THEN 'Tarea completada' ELSE 'Tarea actualizada' END,
 'body', CASE type WHEN 'created' THEN 'Se creó la tarea: ' || title WHEN 'completed' THEN 'Se completó la tarea: ' || title ELSE 'Se actualizó la tarea: ' || title END ||
 CASE WHEN NOT creating AND recipient_uid<>actor AND fields<>'' THEN '. Cambios: ' || fields ELSE '' END,
 'url','/') payload, now created_at FROM chosen ORDER BY recipient_uid`;

export function taskEventStatements(
  db: D1Database,
  input: {
    id: string;
    actor: string;
    title: string;
    assigneeUid: string;
    status: string;
    deadline: string | null;
    now: string;
    creating: boolean;
  },
): D1PreparedStatement[] {
  const eventId = crypto.randomUUID();
  const json = JSON.stringify({ ...input, eventId });
  return [
    db
      .prepare(
        `INSERT INTO notification_events(id,task_id,type,revision,recipient_uid,changed_fields,payload,created_at) ${eventSelectionSql}`,
      )
      .bind(json),
    db
      .prepare(
        `INSERT INTO notification_deliveries(event_id,registration_id,next_attempt_at)
      SELECT e.id,r.id,? FROM notification_events e JOIN notification_registrations r ON r.partner_uid=e.recipient_uid
      WHERE e.id = ? || '-' || r.partner_uid
      AND r.active=1 AND (r.expiration_time IS NULL OR r.expiration_time>?)`,
      )
      .bind(input.now, eventId, Date.parse(input.now)),
  ];
}
