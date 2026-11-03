import type { User } from 'firebase/auth';
import { STATUSES, type BoardSnapshot, type CreateTask, type Partner, type ReplaceTask, type SaveResult, type Task } from '../shared/contracts';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function isTask(value: unknown): value is Task {
  return isObject(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.assigneeUid === 'string' && typeof value.status === 'string' && STATUSES.includes(value.status as Task['status']) && (value.deadline === null || typeof value.deadline === 'string') && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}
function isBoard(value: unknown): value is BoardSnapshot { return isObject(value) && isRevision(value.revision) && Array.isArray(value.tasks) && value.tasks.every(isTask); }
function isSave(value: unknown): value is SaveResult { return isObject(value) && isRevision(value.revision) && isTask(value.task); }
function isPartners(value: unknown): value is { partners: Partner[] } { return isObject(value) && Array.isArray(value.partners) && value.partners.every(partner => isObject(partner) && typeof partner.uid === 'string' && typeof partner.displayName === 'string'); }
function invalid(): never { throw new ApiError(0, 'No se pudo actualizar. Los datos pueden estar desactualizados.'); }
export function createApi(user: User, onRejected: (status: number) => void, sessionSignal?: AbortSignal) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<{ data: T | null; response: Response }> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (sessionSignal?.aborted) abort(); else sessionSignal?.addEventListener('abort', abort, { once: true });
    const cancelled = new Promise<never>((_, reject) => { if (controller.signal.aborted) reject(new Error('Cancelled')); else controller.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once:true }); });
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timed out')); }, 10_000); });
    try {
      const token = await Promise.race([user.getIdToken(), timeout, cancelled]);
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init.body) headers.set('Content-Type', 'application/json');
      const response = await Promise.race([fetch(path, { ...init, headers, signal: controller.signal, cache: 'no-store' }), timeout, cancelled]);
      if (response.status === 401 || response.status === 403) onRejected(response.status);
      if (response.status === 304) return { data: null, response };
      let body: unknown;
      try { body = await Promise.race([response.json(), timeout, cancelled]); } catch { throw new ApiError(response.status, 'No se pudo actualizar. Los datos pueden estar desactualizados.'); }
      if (!response.ok) {
        const message = (body as { error?: { message?: string } })?.error?.message;
        throw new ApiError(response.status, typeof message === 'string' ? message : 'No se pudo completar la operación.');
      }
      return { data: body as T, response };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, 'No se pudo actualizar. Los datos pueden estar desactualizados.');
    } finally { clearTimeout(timer!); sessionSignal?.removeEventListener('abort', abort); }
  }
  return {
    async partners(): Promise<Partner[]> { const { data } = await call<unknown>('/api/partners'); if (!isPartners(data)) return invalid(); return data.partners; },
    async board(revision?: number): Promise<BoardSnapshot | null> {
      const headers: Record<string, string> = revision === undefined ? {} : { 'If-None-Match': `"board-r${revision}"` };
      const { data, response } = await call<unknown>('/api/tasks', { headers }); if (data === null) { if (revision === undefined || response.headers.get('ETag') !== headers['If-None-Match']) return invalid(); return null; } if (!isBoard(data) || response.headers.get('ETag') !== `"board-r${data.revision}"`) return invalid(); return data;
    },
    async create(data: CreateTask): Promise<SaveResult> { const result = (await call<unknown>('/api/tasks', { method: 'POST', body: JSON.stringify(data) })).data; if (!isSave(result)) return invalid(); return result; },
    async replace(id: string, data: ReplaceTask): Promise<SaveResult> { const result = (await call<unknown>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })).data; if (!isSave(result)) return invalid(); return result; },
  };
}
