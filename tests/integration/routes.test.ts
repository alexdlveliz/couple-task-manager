import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/local';

const encode = (data: unknown) => btoa(JSON.stringify(data)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const now = Math.floor(Date.now()/1000);
const token = `${encode({ alg:'none' })}.${encode({ sub:'a', aud:'demo-shared-task-board', iss:'https://securetoken.google.com/demo-shared-task-board', iat:now, auth_time:now, exp:now+3600 })}.`;
const local = { ...env, AUTH_MODE: 'emulator' as const, ENVIRONMENT: 'local', FIREBASE_PROJECT_ID:'demo-shared-task-board' };
const req = (path: string, init: RequestInit = {}) => new Request(`https://example.test${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });

describe('API routes', () => {
  it('authenticates, validates writes, saves and supports conditional snapshots', async () => {
    await env.DB.prepare("INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)").run();
    expect((await worker.fetch(new Request('https://example.test/api/tasks'), local)).status).toBe(401);
    const partners = await worker.fetch(req('/api/partners'), local);
    expect(partners.status).toBe(200);
    expect(await partners.json()).toEqual({partners:[{uid:'a',displayName:'Ana'},{uid:'b',displayName:'Bea'}]});
    expect(partners.headers.get('Cache-Control')).toBe('no-store');
    const created = await worker.fetch(req('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:' Uno ', assigneeUid:'b' }) }), local);
    expect(created.status).toBe(201);
    expect((await created.json() as { task: { title: string } }).task.title).toBe('Uno');
    const snapshot = await worker.fetch(req('/api/tasks'), local);
    expect(snapshot.status).toBe(200);
    expect(snapshot.headers.get('ETag')).toBe('"board-r1"');
    const unchanged = await worker.fetch(req('/api/tasks', { headers: { 'If-None-Match': '"board-r1"' } }), local);
    expect(unchanged.status).toBe(304);
    expect(unchanged.headers.get('Cache-Control')).toBe('no-store');
    const statements: string[] = [];
    const tracked = { ...local, DB: { prepare: (query: string) => { statements.push(query); return env.DB.prepare(query); }, batch: env.DB.batch.bind(env.DB) } as unknown as D1Database };
    expect((await worker.fetch(req('/api/tasks', { headers:{'If-None-Match':'\"board-r1\"'} }), tracked)).status).toBe(304);
    expect(statements.some(query => /FROM tasks/i.test(query))).toBe(false);
    expect((await worker.fetch(req('/api/tasks', { method:'DELETE' }), local)).status).toBe(405);
    expect((await worker.fetch(req('/api/tasks', { method:'POST', body:'x' }), local)).status).toBe(415);
    const broken = { ...local, DB: { prepare: () => { throw new Error('D1_ERROR: local failure'); } } as unknown as D1Database };
    expect((await worker.fetch(req('/api/tasks'), broken)).status).toBe(503);
    await env.DB.prepare("UPDATE partners SET enabled=0 WHERE uid='a'").run();
    expect((await worker.fetch(req('/api/tasks', { headers: { 'If-None-Match':'"board-r1"' } }), local)).status).toBe(403);
  });
});
