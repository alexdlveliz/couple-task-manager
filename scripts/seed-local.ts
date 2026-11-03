import { execFileSync } from 'node:child_process';

const project = process.env.FIREBASE_PROJECT_ID ?? 'demo-shared-task-board';
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
if (project !== 'demo-shared-task-board' || host !== '127.0.0.1:9099' || process.argv.includes('--remote')) {
  throw new Error('Local fixtures require the demo project and local Auth emulator.');
}
const fixtures = [
  { email: 'partner-a@example.test', password: 'local-demo-password-a', name: 'Persona A' },
  { email: 'partner-b@example.test', password: 'local-demo-password-b', name: 'Persona B' },
  { email: 'outsider@example.test', password: 'local-demo-password-outsider', name: 'Sin acceso' },
];
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const output = execFileSync(executable, ['exec', 'wrangler', 'd1', 'execute', 'shared-task-board', '--local', '--env', 'local', '--json', '--command', 'SELECT slot,uid,display_name FROM partners ORDER BY slot'], { encoding: 'utf8' });
const rows = (JSON.parse(output) as Array<{ results: Array<{ slot: number; uid: string; display_name: string }> }>)[0]?.results ?? [];
async function identity(email: string, password: string, existingUid?: string): Promise<string> {
  const endpoint = `http://${host}/identitytoolkit.googleapis.com/v1/accounts`;
  const request = (method: string) => fetch(`${endpoint}:${method}?key=demo-api-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  let response = await request('signInWithPassword');
  if (!response.ok && existingUid) {
    const restored = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchCreate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ users: [{ localId: existingUid, email, rawPassword: password }] }),
    });
    const result = await restored.json() as { error?: unknown[] };
    if (!restored.ok || result.error?.length) throw new Error(`Could not restore local account ${email}.`);
    response = await request('signInWithPassword');
  } else if (!response.ok) response = await request('signUp');
  if (!response.ok) throw new Error(`Could not create or reuse local account ${email}.`);
  const result = await response.json() as { localId?: string };
  if (!result.localId || !/^[A-Za-z0-9_-]+$/.test(result.localId) || (existingUid && result.localId !== existingUid)) throw new Error('Local account UID differs from the D1 partner.');
  return result.localId;
}
const uids = await Promise.all(fixtures.map(({ email, password }, index) => identity(email, password, rows.find(row => row.slot === index + 1)?.uid)));
const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sql = `
INSERT INTO partners (slot,uid,display_name,enabled) VALUES (1,${sqlString(uids[0])},${sqlString(fixtures[0].name)},1)
ON CONFLICT(slot) DO UPDATE SET display_name=excluded.display_name WHERE partners.uid=excluded.uid;
INSERT INTO partners (slot,uid,display_name,enabled) VALUES (2,${sqlString(uids[1])},${sqlString(fixtures[1].name)},1)
ON CONFLICT(slot) DO UPDATE SET display_name=excluded.display_name WHERE partners.uid=excluded.uid;
`;
// Refuse to overwrite established identities; assignments may still refer to them.
if (rows.some(row => row.uid !== uids[row.slot - 1])) throw new Error('Existing partner UID differs; refusing to overwrite assignments.');
execFileSync(executable, ['exec', 'wrangler', 'd1', 'execute', 'shared-task-board', '--local', '--env', 'local', '--command', sql], { stdio: 'inherit' });
console.log(`Local fixture accounts ready: ${fixtures.map(f => f.email).join(', ')}`);
