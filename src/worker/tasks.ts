import type { BoardSnapshot, CreateTask, ReplaceTask, SaveResult, Task } from '../shared/contracts';
import { ApiFailure } from './errors';

const columns = 'id, title, assignee_uid AS assigneeUid, status, deadline, created_at AS createdAt, updated_at AS updatedAt';
const maxRevision = 9007199254740991;
export async function readRevision(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT revision FROM board_metadata WHERE id=1').first<{ revision: number }>();
  if (!row) throw new ApiFailure(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible. Inténtalo de nuevo.');
  return row.revision;
}
export async function readBoard(db: D1Database): Promise<BoardSnapshot> {
  const [rows, metadata] = await db.batch([
    db.prepare(`SELECT ${columns} FROM tasks ORDER BY created_at, id`),
    db.prepare('SELECT revision FROM board_metadata WHERE id=1'),
  ]);
  const revision = (metadata.results[0] as { revision: number } | undefined)?.revision;
  if (revision === undefined) throw new ApiFailure(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible. Inténtalo de nuevo.');
  return { tasks: rows.results as unknown as Task[], revision };
}
interface MutationState { partnerCount: number; callerEnabled: number; assigneeEnabled: number; taskExists: number }
function failMutation(state: MutationState | undefined, creating: boolean): never {
  if (!state || state.partnerCount !== 2) throw new ApiFailure(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible. Inténtalo de nuevo.');
  if (!state.callerEnabled) throw new ApiFailure(403, 'PARTNER_FORBIDDEN', 'Esta cuenta no tiene acceso al tablero.');
  if (!creating && !state.taskExists) throw new ApiFailure(404, 'TASK_NOT_FOUND', 'No se encontró la tarea.');
  if (!state.assigneeEnabled) throw new ApiFailure(400, 'VALIDATION_ERROR', 'Revisa los datos de la tarea.', { assigneeUid: 'Selecciona una persona autorizada.' });
  throw new ApiFailure(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible. Inténtalo de nuevo.');
}
async function save(db: D1Database, uid: string, data: CreateTask | ReplaceTask, id: string, creating: boolean): Promise<SaveResult> {
  const now = new Date().toISOString();
  const guard = `EXISTS (SELECT 1 FROM partners WHERE uid=? AND enabled=1) AND EXISTS (SELECT 1 FROM partners WHERE uid=? AND enabled=1) AND EXISTS (SELECT 1 FROM board_metadata WHERE id=1 AND revision < ${maxRevision}) AND (SELECT count(*) FROM partners)=2`;
  const mutation = creating
    ? db.prepare(`INSERT INTO tasks (id,title,assignee_uid,status,deadline,created_at,updated_at) SELECT ?,?,?,'todo',?,?,? WHERE ${guard}`).bind(id, data.title, data.assigneeUid, data.deadline, now, now, uid, data.assigneeUid)
    : db.prepare(`UPDATE tasks SET title=?,assignee_uid=?,status=?,deadline=?,updated_at=? WHERE id=? AND ${guard}`).bind(data.title, data.assigneeUid, (data as ReplaceTask).status, data.deadline, now, id, uid, data.assigneeUid);
  const result = await db.batch([
    mutation,
    db.prepare('UPDATE board_metadata SET revision=revision+1 WHERE id=1 AND changes()=1'),
    db.prepare(`SELECT ${columns}, (SELECT revision FROM board_metadata WHERE id=1) AS revision FROM tasks WHERE id=?`).bind(id),
    db.prepare('SELECT (SELECT COUNT(*) FROM partners) AS partnerCount, EXISTS(SELECT 1 FROM partners WHERE uid=? AND enabled=1) AS callerEnabled, EXISTS(SELECT 1 FROM partners WHERE uid=? AND enabled=1) AS assigneeEnabled, EXISTS(SELECT 1 FROM tasks WHERE id=?) AS taskExists').bind(uid, data.assigneeUid, id),
  ]);
  if (result[0].meta.changes !== 1) return failMutation(result[3].results[0] as unknown as MutationState | undefined, creating);
  const row = result[2].results[0] as (Task & { revision: number }) | undefined;
  if (!row || result[1].meta.changes !== 1) throw new ApiFailure(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible. Inténtalo de nuevo.');
  const { revision, ...task } = row;
  return { task, revision };
}
export function createTask(db: D1Database, uid: string, data: CreateTask): Promise<SaveResult> { return save(db, uid, data, crypto.randomUUID(), true); }
export function replaceTask(db: D1Database, uid: string, id: string, data: ReplaceTask): Promise<SaveResult> { return save(db, uid, data, id, false); }
