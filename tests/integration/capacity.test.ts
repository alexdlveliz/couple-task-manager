import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { importPKCS8, SignJWT } from 'jose';
import { verifyFirebaseToken } from '../../src/worker/auth';

describe('local capacity sample', () => {
  it('records D1 reads and writes for a 1000-task board', async () => {
    await env.DB.prepare("INSERT INTO partners VALUES (1,'capacity-a','A',1),(2,'capacity-b','B',1)").run();
    const insert = env.DB.prepare("INSERT INTO tasks VALUES (?,?,?,'todo',NULL,?,?)");
    const stamp = '2026-01-01T00:00:00.000Z';
    for (let offset=0; offset<1000; offset+=100) {
      await env.DB.batch(Array.from({ length:100 }, (_, index) => insert.bind(`task-${offset+index}`, 'Tarea local', 'capacity-a', stamp, stamp)));
    }
    const authorization = await env.DB.prepare('SELECT COUNT(*) AS count, MAX(CASE WHEN uid = ? AND enabled = 1 THEN 1 ELSE 0 END) AS authorized FROM partners').bind('capacity-a').all();
    const unchanged = await env.DB.prepare('SELECT revision FROM board_metadata WHERE id=1').all();
    const changed = await env.DB.prepare('SELECT id,title,assignee_uid,status,deadline,created_at,updated_at FROM tasks ORDER BY created_at,id').all();
    const write = await env.DB.prepare("UPDATE tasks SET title='Tarea local 2' WHERE id='task-0'").run();
    const indexWrite = await env.DB.prepare("UPDATE tasks SET created_at='2026-01-02T00:00:00.000Z' WHERE id='task-1'").run();
    const start = performance.now();
    const bytes = new TextEncoder().encode(JSON.stringify(changed.results)).byteLength;
    const elapsedMs = performance.now() - start;
    expect(changed.results).toHaveLength(1000);
    const now = Math.floor(Date.now()/1000);
    const key = await importPKCS8(env.TEST_SIGNING_PRIVATE_KEY, 'RS256');
    const token = await new SignJWT({auth_time:now}).setProtectedHeader({alg:'RS256',kid:'capacity-key'}).setSubject('capacity-a').setAudience('demo-shared-task-board').setIssuer('https://securetoken.google.com/demo-shared-task-board').setIssuedAt(now).setExpirationTime(now+3600).sign(key);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({'capacity-key':env.TEST_SIGNING_CERTIFICATE}), {headers:{'cache-control':'max-age=3600'}}));
    const verifyStart = performance.now();
    try { for (let n=0;n<100;n++) await verifyFirebaseToken(token, { ...env, AUTH_MODE:'production', ENVIRONMENT:undefined, FIREBASE_AUTH_EMULATOR_HOST:undefined, FIREBASE_PROJECT_ID:'demo-shared-task-board' }); } finally { fetchSpy.mockRestore(); }
    const verifyElapsedMs = performance.now() - verifyStart;
    console.log('CAPACITY_SAMPLE', JSON.stringify({ rows:1000, authorization:authorization.meta, unchanged:unchanged.meta, changed:changed.meta, write:write.meta, indexedWrite:indexWrite.meta, serializationBytes:bytes, serializationElapsedMs:elapsedMs, verifications:100, verificationElapsedMs:verifyElapsedMs }));
  });
});
