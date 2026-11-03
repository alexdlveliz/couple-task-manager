import { describe, expect, it, vi } from 'vitest';
import { RefreshCoordinator } from '../../src/client/sync';

describe('board refresh coordinator', () => {
  it('coalesces triggers and never accepts a stale snapshot after a save', async () => {
    let resolve!: (v: { revision: number; tasks: [] }) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ revision: 2, tasks: [] });
    const accept = vi.fn();
    const coordinator = new RefreshCoordinator({ load, partners: async () => [], accept, uid: 'a' });
    const first = coordinator.refresh();
    coordinator.saved(2);
    coordinator.refresh();
    resolve({ revision: 1, tasks: [] });
    await first;
    expect(load).toHaveBeenCalledTimes(2);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept.mock.calls[0][0].revision).toBe(2);
  });
  it('ignores responses after invalidation', async () => {
    let resolve!: (v: { revision: number; tasks: [] }) => void;
    const accept = vi.fn();
    const coordinator = new RefreshCoordinator({ load: () => new Promise(r => { resolve = r; }), partners: async () => [], accept, uid:'a' });
    const pending = coordinator.refresh();
    coordinator.stop();
    resolve({ revision: 4, tasks: [] });
    await pending;
    expect(accept).not.toHaveBeenCalled();
  });
});

it('polls visible online boards and pauses while hidden or offline', async () => {
  vi.useFakeTimers();
  const doc = new EventTarget() as EventTarget & { visibilityState:string };
  doc.visibilityState = 'visible';
  const nav = { onLine:true };
  vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('navigator', nav);
  const load = vi.fn().mockResolvedValue({ revision:1, tasks:[] });
  const sync = new RefreshCoordinator({ uid:'a', load, partners:async () => [], accept:() => {} });
  try {
    sync.start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(load).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'hidden';
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible'; nav.onLine = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(1);
  } finally { sync.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); }
});

it('discards a 304 for an older complete snapshot after a newer save', async () => {
  let finish304!: (result: null) => void;
  const load = vi.fn().mockResolvedValueOnce({ revision:1, tasks:[] }).mockImplementationOnce(() => new Promise(resolve => { finish304=resolve; })).mockResolvedValueOnce({ revision:2, tasks:[] });
  const accept = vi.fn(); const verified = vi.fn();
  const sync = new RefreshCoordinator({ uid:'a', load, partners:async () => [], accept, verified });
  await sync.refresh();
  const pending = sync.refresh();
  sync.saved(2);
  finish304(null);
  await pending;
  expect(verified).toHaveBeenCalledTimes(2);
  expect(accept).toHaveBeenLastCalledWith({ revision:2, tasks:[] }, []);
  expect(load.mock.calls[2][0]).toBe(1);
});

it('does not let a late older mutation response reduce the highest seen revision', async () => {
  let complete!: (board: { revision:number; tasks:[] }) => void;
  const load = vi.fn().mockImplementationOnce(() => new Promise(resolve => { complete=resolve; })).mockResolvedValue({revision:3,tasks:[]});
  const accept = vi.fn();
  const sync = new RefreshCoordinator({ uid:'a', load, partners:async () => [], accept });
  const pending = sync.refresh();
  sync.saved(3); sync.saved(2);
  complete({revision:2,tasks:[]});
  await pending;
  expect(accept).toHaveBeenCalledTimes(1);
  expect(accept).toHaveBeenCalledWith({revision:3,tasks:[]}, []);
});

it('does not let a delayed server snapshot replace a newer restored offline board', async () => {
  const load = vi.fn().mockResolvedValueOnce({revision:4,tasks:[]}).mockResolvedValueOnce({revision:5,tasks:[]});
  const accept = vi.fn();
  const sync = new RefreshCoordinator({uid:'a',load,partners:async()=>[],accept});
  sync.restore({revision:5,tasks:[]},[]);
  await sync.refresh();
  expect(accept).toHaveBeenCalledTimes(1);
  expect(accept).toHaveBeenCalledWith({revision:5,tasks:[]},[]);
  expect(load.mock.calls[0][0]).toBe(5);
});

it('reports repeated stale server responses without entering an endless refresh loop', async () => {
  const load = vi.fn().mockResolvedValue({revision:4,tasks:[]});
  const error = vi.fn();
  const sync = new RefreshCoordinator({uid:'a',load,partners:async()=>[],accept:()=>{},error});
  sync.restore({revision:5,tasks:[]},[]);
  await Promise.race([sync.refresh(), new Promise((_,reject)=>setTimeout(()=>reject(new Error('refresh loop')),100))]);
  expect(load.mock.calls.length).toBeLessThanOrEqual(3);
  expect(error).toHaveBeenCalled();
});

it('retains the last complete board when fetching its partner list fails', async () => {
  const load = vi.fn().mockResolvedValueOnce({revision:1,tasks:[]}).mockResolvedValueOnce({revision:2,tasks:[]}).mockResolvedValueOnce({revision:2,tasks:[]});
  const partners = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([]);
  const accept=vi.fn(), error=vi.fn();
  const sync = new RefreshCoordinator({uid:'a',load,partners,accept,error});
  await sync.refresh();
  await sync.refresh();
  expect(accept).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledOnce();
  await sync.refresh();
  expect(load.mock.calls[2][0]).toBe(1);
  expect(accept).toHaveBeenLastCalledWith({revision:2,tasks:[]},[]);
});
