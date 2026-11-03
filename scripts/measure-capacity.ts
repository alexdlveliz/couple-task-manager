import { spawnSync } from 'node:child_process';
import { importPKCS8, SignJWT } from 'jose';
import { verifyFirebaseToken } from '../src/worker/auth';
import type { Env } from '../src/worker/env';
import { createEphemeralCertificate } from '../tests/fixtures/create-ephemeral-cert';

// The integration project uses isolated, migrated local D1 and never remote bindings.
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(executable, ['exec', 'vitest', 'run', '--project', 'integration', 'tests/integration/capacity.test.ts', '--disableConsoleIntercept'], { stdio:'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Process CPU is a local Node estimate, not Cloudflare Worker CPU billing.
const fixture = createEphemeralCertificate();
const certificate = fixture.certificate;
const privateKey = await importPKCS8(fixture.privateKey,'RS256');
const now = Math.floor(Date.now()/1000);
const project = 'demo-shared-task-board';
const token = await new SignJWT({auth_time:now}).setProtectedHeader({alg:'RS256',kid:'capacity-key'}).setSubject('capacity-a').setAudience(project).setIssuer(`https://securetoken.google.com/${project}`).setIssuedAt(now).setExpirationTime(now+3600).sign(privateKey);
const previousFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response(JSON.stringify({'capacity-key':certificate}), {headers:{'cache-control':'max-age=3600'}})) as typeof fetch;
try {
  const env = {AUTH_MODE:'production',FIREBASE_PROJECT_ID:project} as Env;
  await verifyFirebaseToken(token,env);
  const verifyStart = process.cpuUsage();
  for (let n=0;n<100;n++) await verifyFirebaseToken(token,env);
  const verifyCpu = process.cpuUsage(verifyStart);
  const tasks = Array.from({length:1000},(_,index)=>({id:`task-${index}`,title:'Tarea local',assigneeUid:'capacity-a',status:'todo',deadline:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}));
  const serializeStart = process.cpuUsage();
  for (let n=0;n<100;n++) JSON.stringify(tasks);
  const serializeCpu = process.cpuUsage(serializeStart);
  console.log('NODE_CPU_SAMPLE', JSON.stringify({iterations:100,verificationMicroseconds:verifyCpu.user+verifyCpu.system,serializationMicroseconds:serializeCpu.user+serializeCpu.system}));
} finally {globalThis.fetch=previousFetch;}
