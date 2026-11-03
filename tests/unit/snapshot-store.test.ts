import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteSnapshot, readSnapshot, writeSnapshot } from '../../src/client/snapshot-store';

describe('private board snapshots', () => {
  it('scopes snapshots to project and UID and refuses lower revisions', async () => {
    const snapshot = { uid:'a', partners:[], tasks:[], revision:3, lastSyncAt:'2026-01-01T00:00:00Z', schemaVersion:1 as const };
    await writeSnapshot('project', snapshot);
    await writeSnapshot('project', { ...snapshot, revision:2 });
    expect((await readSnapshot('project', 'a'))?.revision).toBe(3);
    expect(await readSnapshot('project', 'b')).toBeNull();
    expect(await readSnapshot('other-project', 'a')).toBeNull();
    await deleteSnapshot('project', 'a');
    expect(await readSnapshot('project', 'a')).toBeNull();
  });
});

it('prevents an old session write from restoring data after cleanup', async () => {
  const { currentGeneration, invalidateSnapshot, activateSnapshot } = await import('../../src/client/snapshot-store');
  const snapshot = { uid:'stale', partners:[], tasks:[], revision:1, lastSyncAt:'2026-01-01T00:00:00Z', schemaVersion:1 as const };
  const generation = await currentGeneration('project', 'stale');
  await activateSnapshot('project', 'stale', generation);
  await writeSnapshot('project', snapshot, generation);
  await invalidateSnapshot('project', 'stale');
  await writeSnapshot('project', snapshot, generation);
  expect(await readSnapshot('project', 'stale')).toBeNull();
  expect(await activateSnapshot('project', 'stale', generation)).toBe(false);
});

it('preserves the highest revision across concurrent writes', async () => {
  const snapshot = { uid:'concurrent', partners:[], tasks:[], revision:7, lastSyncAt:'2026-01-01T00:00:00Z', schemaVersion:1 as const };
  await Promise.all([writeSnapshot('project', snapshot), writeSnapshot('project', { ...snapshot, revision:4 })]);
  expect((await readSnapshot('project', 'concurrent'))?.revision).toBe(7);
});
it('surfaces storage unavailability', async () => {
  const { vi } = await import('vitest');
  vi.stubGlobal('indexedDB', undefined);
  try { await expect(readSnapshot('project', 'a')).rejects.toThrow('Storage unavailable'); }
  finally { vi.unstubAllGlobals(); }
});

it('does not replace a same-revision snapshot with an older verification time', async () => {
  const snapshot = { uid:'same-revision', partners:[], tasks:[], revision:3, lastSyncAt:'2026-11-02T12:00:00.000Z', schemaVersion:1 as const };
  await writeSnapshot('project', snapshot);
  await writeSnapshot('project', { ...snapshot, lastSyncAt:'2026-11-02T11:00:00.000Z' });
  expect((await readSnapshot('project', 'same-revision'))?.lastSyncAt).toBe(snapshot.lastSyncAt);
});

it('propagates read, write, quota and cleanup failures without returning a snapshot', async () => {
  const { vi } = await import('vitest');
  const snapshot = { uid:'failure', partners:[], tasks:[], revision:1, lastSyncAt:'2026-01-01T00:00:00Z', schemaVersion:1 as const };
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new DOMException('Storage full', 'QuotaExceededError'); });
  try {
    await expect(readSnapshot('project','failure')).rejects.toMatchObject({name:'QuotaExceededError'});
    await expect(writeSnapshot('project',snapshot)).rejects.toMatchObject({name:'QuotaExceededError'});
    await expect(deleteSnapshot('project','failure')).rejects.toMatchObject({name:'QuotaExceededError'});
  } finally { transaction.mockRestore(); }
  expect(await readSnapshot('project','failure')).toBeNull();
});

it('rejects incomplete snapshots without replacing the last complete board', async () => {
  const complete = { uid:'partial', partners:[], tasks:[], revision:1, lastSyncAt:'2026-01-01T00:00:00.000Z', schemaVersion:1 as const };
  await writeSnapshot('project',complete);
  await expect(writeSnapshot('project',{uid:'partial',revision:2,schemaVersion:1,lastSyncAt:'2026-01-02T00:00:00.000Z'} as typeof complete)).rejects.toThrow();
  expect(await readSnapshot('project','partial')).toEqual(complete);
});

it('surfaces a corrupted stored snapshot without restoring it', async () => {
  const db = await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('shared-task-board',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({generation:0,blocked:false,snapshot:{uid:'corrupt',revision:1}},'project:corrupt:1');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  db.close();
  await expect(readSnapshot('project','corrupt')).rejects.toThrow('Incomplete stored snapshot');
});

it('repairs a corrupted stored snapshot using a new complete board', async () => {
  const db = await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('shared-task-board',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({generation:0,blocked:false,snapshot:{uid:'repair'}},'project:repair:1');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); db.close();
  const complete = {uid:'repair',partners:[],tasks:[],revision:1,lastSyncAt:'2026-01-01T00:00:00Z',schemaVersion:1 as const};
  await writeSnapshot('project',complete,0);
  expect(await readSnapshot('project','repair')).toEqual(complete);
});
