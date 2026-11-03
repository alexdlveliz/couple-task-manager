import { env } from 'cloudflare:workers';
import { SignJWT, importPKCS8 } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker/index';

describe('production API authorization', () => {
  it('enforces signatures, claims, partner state and no-store on every operation', async () => {
    await env.DB.prepare("INSERT INTO partners VALUES (1,'a','Ana',1),(2,'b','Bea',1)").run();
    const key = await importPKCS8(env.TEST_SIGNING_PRIVATE_KEY, 'RS256');
    const now = Math.floor(Date.now()/1000);
    const makeToken = async (uid='a', project='demo-shared-task-board', exp=now+3600) => new SignJWT({ auth_time: now }).setProtectedHeader({ alg:'RS256', kid:'test-key' }).setSubject(uid).setAudience(project).setIssuer(`https://securetoken.google.com/${project}`).setIssuedAt(now).setExpirationTime(exp).sign(key);
    const request = (path: string, token?: string, method='GET') => new Request(`https://example.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(method === 'POST' || method === 'PUT' ? { 'Content-Type':'application/json' } : {}) }, ...(method === 'POST' || method === 'PUT' ? { body:JSON.stringify({ title:'x', assigneeUid:'a' }) } : {}) });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ 'test-key':env.TEST_SIGNING_CERTIFICATE }), { headers: { 'cache-control':'max-age=0' } }));
    const prod = { ...env, AUTH_MODE:'production' as const, FIREBASE_PROJECT_ID:'demo-shared-task-board', ENVIRONMENT:undefined, FIREBASE_AUTH_EMULATOR_HOST:undefined };
    try {
      const signed = await makeToken();
      const missingClaim = await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('a').setAudience('demo-shared-task-board').setIssuer('https://securetoken.google.com/demo-shared-task-board').setIssuedAt(now).setExpirationTime(now+3600).sign(key);
      const wrongAudience = await new SignJWT({auth_time:now}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('a').setAudience('other').setIssuer('https://securetoken.google.com/demo-shared-task-board').setIssuedAt(now).setExpirationTime(now+3600).sign(key);
      const wrongIssuer = await new SignJWT({auth_time:now}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('a').setAudience('demo-shared-task-board').setIssuer('https://securetoken.google.com/other').setIssuedAt(now).setExpirationTime(now+3600).sign(key);
      const unsigned = `${btoa(JSON.stringify({alg:'none'})).replace(/=/g,'')}.${signed.split('.')[1]}.`;
      const invalid = `${signed.slice(0,-4)}aaaa`;
      for (const [path, method] of [['/api/partners','GET'], ['/api/tasks','GET'], ['/api/tasks','POST'], ['/api/tasks/absent','PUT']]) {
        for (const token of [undefined, invalid, unsigned, missingClaim, wrongIssuer, wrongAudience, await makeToken('outside'), await makeToken('a','different-project'), await makeToken('a','demo-shared-task-board',now-10)]) {
          const response = await worker.fetch(request(path, token, method), prod);
          expect([401, 403]).toContain(response.status);
          expect(response.headers.get('Cache-Control')).toBe('no-store');
        }
      }
      expect((await worker.fetch(request('/api/tasks', signed), prod)).status).toBe(200);
      await env.DB.prepare("UPDATE partners SET enabled=0 WHERE uid='a'").run();
      for (const [path, method] of [['/api/partners','GET'], ['/api/tasks','GET'], ['/api/tasks','POST'], ['/api/tasks/absent','PUT']]) expect((await worker.fetch(request(path, signed, method), prod)).status).toBe(403);
      const conditional = new Request('https://example.test/api/tasks', {headers:{Authorization:`Bearer ${signed}`, 'If-None-Match':'\"board-r1\"'}});
      expect((await worker.fetch(conditional, prod)).status).toBe(403);
    } finally { fetchSpy.mockRestore(); }
  });
});
