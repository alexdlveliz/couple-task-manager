import type {
  BoardSnapshot,
  CreateTask,
  ReplaceTask,
  SaveResult,
  Task,
} from "../shared/contracts";
import { ApiFailure } from "./errors";
import { deadlineCycleStatements } from "./deadline-cycle";
import { taskEventStatements } from "./task-notification-events";

const columns =
  "id, title, assignee_uid AS assigneeUid, status, deadline, created_at AS createdAt, updated_at AS updatedAt, visibility";
const maxRevision = 9007199254740991;
const callerRevision =
  "CASE p.slot WHEN 1 THEN m.slot_1_revision ELSE m.slot_2_revision END";
export async function readRevision(
  db: D1Database,
  uid: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT ${callerRevision} AS revision FROM board_metadata m JOIN partners p ON p.uid=? AND p.enabled=1 WHERE m.id=1`,
    )
    .bind(uid)
    .first<{ revision: number }>();
  if (!row)
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  return row.revision;
}
export async function readBoard(
  db: D1Database,
  uid: string,
): Promise<BoardSnapshot> {
  const [rows, metadata] = await db.batch([
    db
      .prepare(
        `SELECT ${columns} FROM tasks WHERE visibility='shared' OR creator_uid=? ORDER BY created_at, id`,
      )
      .bind(uid),
    db
      .prepare(
        `SELECT ${callerRevision} AS revision FROM board_metadata m JOIN partners p ON p.uid=? AND p.enabled=1 WHERE m.id=1`,
      )
      .bind(uid),
  ]);
  const revision = (metadata.results[0] as { revision: number } | undefined)
    ?.revision;
  if (revision === undefined)
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  return { tasks: rows.results as unknown as Task[], revision };
}
interface MutationState {
  partnerCount: number;
  callerEnabled: number;
  assigneeEnabled: number;
  taskExists: number;
  privateReassignment: number;
}
function failMutation(
  state: MutationState | undefined,
  creating: boolean,
): never {
  if (!state || state.partnerCount !== 2)
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  if (!state.callerEnabled)
    throw new ApiFailure(
      403,
      "PARTNER_FORBIDDEN",
      "Esta cuenta no tiene acceso al tablero.",
    );
  if (!creating && !state.taskExists)
    throw new ApiFailure(404, "TASK_NOT_FOUND", "No se encontró la tarea.");
  if (state.privateReassignment)
    throw new ApiFailure(
      400,
      "VALIDATION_ERROR",
      "Revisa los datos de la tarea.",
      { assigneeUid: "La tarea privada debe estar asignada a ti." },
    );
  if (!state.assigneeEnabled)
    throw new ApiFailure(
      400,
      "VALIDATION_ERROR",
      "Revisa los datos de la tarea.",
      { assigneeUid: "Selecciona una persona autorizada." },
    );
  throw new ApiFailure(
    503,
    "SERVICE_UNAVAILABLE",
    "El servicio no está disponible. Inténtalo de nuevo.",
  );
}
async function save(
  db: D1Database,
  uid: string,
  data: CreateTask | ReplaceTask,
  id: string,
  creating: boolean,
): Promise<SaveResult> {
  const now = new Date().toISOString();
  const mutationToken = crypto.randomUUID();
  const visibility = creating
    ? ((data as CreateTask).visibility ?? "shared")
    : "shared";
  if (
    creating &&
    visibility === "private" &&
    data.assigneeUid &&
    data.assigneeUid !== uid
  )
    throw new ApiFailure(
      400,
      "VALIDATION_ERROR",
      "Revisa los datos de la tarea.",
      { assigneeUid: "La tarea privada debe estar asignada a ti." },
    );
  const assigneeUid = visibility === "private" ? uid : (data.assigneeUid ?? "");
  const guard = `EXISTS (SELECT 1 FROM partners WHERE uid=? AND enabled=1) AND EXISTS (SELECT 1 FROM partners WHERE uid=? AND enabled=1) AND EXISTS (SELECT 1 FROM board_metadata WHERE id=1 AND revision < ${String(maxRevision)}) AND (SELECT count(*) FROM partners)=2`;
  const mutation = creating
    ? db
        .prepare(
          `INSERT INTO tasks (id,title,assignee_uid,status,deadline,created_at,updated_at,visibility,creator_uid) SELECT ?,?,?,'todo',?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          id,
          data.title,
          assigneeUid,
          data.deadline,
          now,
          now,
          visibility,
          visibility === "private" ? uid : null,
          uid,
          assigneeUid,
        )
    : db
        .prepare(
          `UPDATE tasks SET title=?,assignee_uid=?,status=?,deadline=?,updated_at=? WHERE id=? AND (visibility='shared' OR creator_uid=?) AND (visibility='shared' OR assignee_uid=?) AND ${guard}`,
        )
        .bind(
          data.title,
          assigneeUid,
          (data as ReplaceTask).status,
          data.deadline,
          now,
          id,
          uid,
          assigneeUid,
          uid,
          assigneeUid,
        );
  const result = await db.batch([
    ...taskEventStatements(db, {
      id,
      actor: uid,
      title: data.title,
      assigneeUid,
      status: creating ? "todo" : (data as ReplaceTask).status,
      deadline: data.deadline,
      now,
      creating,
      visibility,
    }),
    mutation,
    db
      .prepare(
        `UPDATE board_metadata SET revision=revision+1, mutation_token=?,
      slot_1_revision=slot_1_revision + CASE WHEN (SELECT visibility FROM tasks WHERE id=?)='shared' OR (SELECT slot FROM partners WHERE uid=?)=1 THEN 1 ELSE 0 END,
      slot_2_revision=slot_2_revision + CASE WHEN (SELECT visibility FROM tasks WHERE id=?)='shared' OR (SELECT slot FROM partners WHERE uid=?)=2 THEN 1 ELSE 0 END
      WHERE id=1 AND changes()=1`,
      )
      .bind(mutationToken, id, uid, id, uid),
    ...deadlineCycleStatements(db, id, uid, assigneeUid, mutationToken),
    db
      .prepare(
        `SELECT ${columns}, (SELECT ${callerRevision} FROM board_metadata m JOIN partners p ON p.uid=? WHERE m.id=1) AS revision FROM tasks WHERE id=? AND (visibility='shared' OR creator_uid=?)`,
      )
      .bind(uid, id, uid),
    db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM partners) AS partnerCount, EXISTS(SELECT 1 FROM partners WHERE uid=? AND enabled=1) AS callerEnabled, EXISTS(SELECT 1 FROM partners WHERE uid=? AND enabled=1) AS assigneeEnabled, EXISTS(SELECT 1 FROM tasks WHERE id=? AND (visibility='shared' OR creator_uid=?)) AS taskExists, EXISTS(SELECT 1 FROM tasks WHERE id=? AND visibility='private' AND creator_uid=? AND assignee_uid<>?) AS privateReassignment",
      )
      .bind(uid, assigneeUid, id, uid, id, uid, assigneeUid),
  ]);
  if (result[2].meta.changes !== 1)
    return failMutation(
      result[8].results[0] as MutationState | undefined,
      creating,
    );
  const row = result[7].results[0] as (Task & { revision: number }) | undefined;
  if (!row || result[3].meta.changes !== 1)
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  const { revision, ...task } = row;
  return { task, revision };
}
export function createTask(
  db: D1Database,
  uid: string,
  data: CreateTask,
): Promise<SaveResult> {
  return save(db, uid, data, crypto.randomUUID(), true);
}
export function replaceTask(
  db: D1Database,
  uid: string,
  id: string,
  data: ReplaceTask,
): Promise<SaveResult> {
  return save(db, uid, data, id, false);
}
export async function deleteTask(
  db: D1Database,
  uid: string,
  id: string,
): Promise<{ revision: number }> {
  const result = await db.batch([
    db
      .prepare(
        `UPDATE board_metadata SET revision=revision+1,
      slot_1_revision=slot_1_revision + CASE WHEN (SELECT visibility FROM tasks WHERE id=?)='shared' OR (SELECT slot FROM partners WHERE uid=?)=1 THEN 1 ELSE 0 END,
      slot_2_revision=slot_2_revision + CASE WHEN (SELECT visibility FROM tasks WHERE id=?)='shared' OR (SELECT slot FROM partners WHERE uid=?)=2 THEN 1 ELSE 0 END
      WHERE id=1 AND revision < ${String(maxRevision)} AND (SELECT count(*) FROM partners)=2
      AND EXISTS (SELECT 1 FROM partners WHERE uid=? AND enabled=1)
      AND EXISTS (SELECT 1 FROM tasks WHERE id=? AND (visibility='shared' OR creator_uid=?))`,
      )
      .bind(id, uid, id, uid, uid, id, uid),
    db
      .prepare(
        `DELETE FROM tasks WHERE id=? AND (visibility='shared' OR creator_uid=?) AND changes()=1 RETURNING id`,
      )
      .bind(id, uid),
    db
      .prepare(
        `UPDATE notification_deliveries SET state='abandoned',lease_expires_at=NULL,last_error='obsolete' WHERE state IN ('pending','leased') AND event_id IN (SELECT id FROM notification_events WHERE task_id=? AND type='overdue') AND changes()=1`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM partners) AS partnerCount, EXISTS(SELECT 1 FROM partners WHERE uid=? AND enabled=1) AS callerEnabled, EXISTS(SELECT 1 FROM tasks WHERE id=? AND (visibility='shared' OR creator_uid=?)) AS taskExists, (SELECT ${callerRevision} FROM board_metadata m JOIN partners p ON p.uid=? WHERE m.id=1) AS revision`,
      )
      .bind(uid, id, uid, uid),
  ]);
  const state = result[3].results[0] as
    | {
        partnerCount: number;
        callerEnabled: number;
        taskExists: number;
        revision: number;
      }
    | undefined;
  if (result[1].results.length !== 1) {
    if (state?.partnerCount === 2 && state.callerEnabled && !state.taskExists)
      throw new ApiFailure(404, "TASK_NOT_FOUND", "No se encontró la tarea.");
    if (state?.partnerCount === 2 && !state.callerEnabled)
      throw new ApiFailure(
        403,
        "PARTNER_FORBIDDEN",
        "Esta cuenta no tiene acceso al tablero.",
      );
    throw new ApiFailure(
      503,
      "SERVICE_UNAVAILABLE",
      "El servicio no está disponible. Inténtalo de nuevo.",
    );
  }
  if (result[0].meta.changes !== 1 || !state)
    throw new Error("Deletion revision unavailable");
  return { revision: state.revision };
}
