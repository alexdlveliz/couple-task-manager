import { invalidateSnapshot } from './snapshot-store';
const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-shared-task-board';
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('shared-board-session');
const marker = (uid: string) => `shared-board-cleanup:${project}:${uid}`;
const cookieName = (uid: string) => `shared_board_cleanup_${encodeURIComponent(project)}_${encodeURIComponent(uid)}`;
const pending = new Set<string>();
function cookiePending(uid: string): boolean {
  try { return document.cookie.split(';').some(part => part.trim() === `${cookieName(uid)}=pending`); }
  catch { return false; }
}
function setCookieMarker(uid: string): boolean {
  try {
    document.cookie = `${cookieName(uid)}=pending; Path=/; Max-Age=31536000; SameSite=Strict`;
    return cookiePending(uid);
  } catch { return false; }
}
function clearCookieMarker(uid: string): void {
  if (!cookiePending(uid)) return;
  document.cookie = `${cookieName(uid)}=; Path=/; Max-Age=0; SameSite=Strict`;
  if (cookiePending(uid)) throw new Error('Cleanup marker could not be removed');
}
export function restorationAllowed(uid: string): boolean {
  if (pending.has(uid) || cookiePending(uid)) return false;
  try { return localStorage.getItem(marker(uid)) !== 'pending'; } catch { return false; }
}
export async function invalidatePrivateData(uid: string, broadcast = true): Promise<void> {
  pending.add(uid);
  let marked = false;
  try { localStorage.setItem(marker(uid), 'pending'); marked = localStorage.getItem(marker(uid)) === 'pending'; } catch { /* Try an independent marker below. */ }
  if (!marked) setCookieMarker(uid);
  if (broadcast) channel?.postMessage({ project, uid });
  await invalidateSnapshot(project, uid);
  if (marked) localStorage.removeItem(marker(uid));
  clearCookieMarker(uid);
  pending.delete(uid);
}
export function listenForInvalidation(callback: (uid: string) => void): () => void {
  if (!channel) return () => {};
  const listener = (event: MessageEvent) => { if (event.data?.project === project && typeof event.data.uid === 'string') callback(event.data.uid); };
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
