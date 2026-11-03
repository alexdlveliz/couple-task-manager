import { Temporal } from '@js-temporal/polyfill';
import { STATUSES, type CreateTask, type ReplaceTask, type TaskStatus } from './contracts';

export class ValidationError extends Error {
  constructor(public fields: Record<string, string> = {}) { super('Revisa los datos de la tarea.'); }
}

function objectInput(input: unknown, allowed: string[], required: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError();
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !allowed.includes(key)) || required.some(key => !(key in data))) throw new ValidationError();
  return data;
}
function fields(data: Record<string, unknown>): CreateTask {
  const errors: Record<string, string> = {};
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const assigneeUid = typeof data.assigneeUid === 'string' ? data.assigneeUid : '';
  if (!title) errors.title = 'Escribe un título.';
  if (!assigneeUid.trim()) errors.assigneeUid = 'Selecciona una persona autorizada.';
  let deadline: string | null = null;
  if (data.deadline !== undefined && data.deadline !== null) {
    try {
      if (typeof data.deadline !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i.test(data.deadline)) throw new Error();
      deadline = Temporal.Instant.from(data.deadline).toString();
    } catch { errors.deadline = 'Escribe una fecha y hora válidas.'; }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { title, assigneeUid, deadline };
}
export function parseCreateTask(input: unknown): CreateTask {
  return fields(objectInput(input, ['title', 'assigneeUid', 'deadline'], ['title', 'assigneeUid']));
}
export function parseReplaceTask(input: unknown): ReplaceTask {
  const data = objectInput(input, ['title', 'assigneeUid', 'status', 'deadline'], ['title', 'assigneeUid', 'status', 'deadline']);
  const parsed = fields(data);
  if (typeof data.status !== 'string' || !STATUSES.includes(data.status as TaskStatus)) throw new ValidationError({ status: 'Selecciona un estado válido.' });
  return { ...parsed, status: data.status as TaskStatus };
}
