import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { verifyFirebaseToken } from '../../src/worker/auth';
import type { Env } from '../../src/worker/env';

const env = { FIREBASE_PROJECT_ID: 'demo-shared-task-board', AUTH_MODE: 'production' } as Env;

describe('Firebase token trust boundary', () => {
  it('rejects unsigned tokens and emulator settings in production', async () => {
    await expect(verifyFirebaseToken('eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1In0.', env)).rejects.toThrow();
    await expect(verifyFirebaseToken('anything', { ...env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).rejects.toThrow();
  });
  it('accepts an emulator token only for the local demo environment', async () => {
    const token = await new SignJWT({ auth_time: Math.floor(Date.now()/1000) }).setProtectedHeader({ alg: 'HS256' }).setSubject('alice').setAudience(env.FIREBASE_PROJECT_ID).setIssuer(`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('a'.repeat(32)));
    const [header, payload] = token.split('.');
    const unsigned = `${btoa(JSON.stringify({ alg: 'none' })).replace(/=/g, '')}.${payload}.`;
    expect(header).toBeTruthy();
    expect(await verifyFirebaseToken(unsigned, { ...env, AUTH_MODE: 'emulator', ENVIRONMENT: 'local' }, true)).toBe('alice');
    await expect(verifyFirebaseToken(unsigned, env)).rejects.toThrow();
  });
  it('fails closed when the signing key cannot be retrieved', async () => {
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256', kid: 'fake' }).setSubject('alice').setAudience(env.FIREBASE_PROJECT_ID).setIssuer(`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('a'.repeat(32)));
    await expect(verifyFirebaseToken(token, env)).rejects.toThrow();
  });
});

it('verifies an RS256 signature and required Firebase claims using fetched trusted certificates', async () => {
  const { importPKCS8 } = await import('jose');
  const { vi } = await import('vitest');
  const key = await importPKCS8(process.env.TEST_SIGNING_PRIVATE_KEY!, 'RS256');
  const certificate = process.env.TEST_SIGNING_CERTIFICATE!;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ 'test-key':certificate }), { status:200, headers:{ 'cache-control':'public, max-age=0' } }));
  const makeToken = (project = env.FIREBASE_PROJECT_ID, expires = '1h') => new SignJWT({ auth_time:Math.floor(Date.now()/1000) }).setProtectedHeader({ alg:'RS256', kid:'test-key' }).setSubject('alice').setAudience(project).setIssuer(`https://securetoken.google.com/${project}`).setIssuedAt().setExpirationTime(expires).sign(key);
  try {
    expect(await verifyFirebaseToken(await makeToken(), env)).toBe('alice');
    await expect(verifyFirebaseToken(await makeToken('other-project'), env)).rejects.toThrow();
    await expect(verifyFirebaseToken(await makeToken(env.FIREBASE_PROJECT_ID, '-1h'), env)).rejects.toThrow();
    fetchMock.mockResolvedValue(new Response('unavailable', { status:503 }));
    await expect(verifyFirebaseToken(await makeToken(), env)).rejects.toMatchObject({ constructor: expect.objectContaining({ name:'KeyServiceError' }) });
  } finally { fetchMock.mockRestore(); }
});

it('rejects emulator configuration in the production verifier even when local flags are supplied', async () => {
  const { validateEnvironment } = await import('../../src/worker/env');
  expect(() => validateEnvironment({ ...env, AUTH_MODE:'emulator', ENVIRONMENT:'local' })).toThrow();
});
