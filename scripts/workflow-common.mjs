import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { parseEnv } from 'node:util';
import ts from 'typescript';

export function validateLocalConfiguration() {
  try {
    if (!existsSync('.env.local') || !existsSync('.dev.vars.local')) throw new Error();
    const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'));
    const local = parsed.config?.env?.local;
    const db = local?.d1_databases?.find((item) => item.binding === 'DB');
    const vars = parseEnv(readFileSync('.dev.vars.local', 'utf8'));
    const client = {};
    for (const file of ['.env', '.env.local', '.env.demo', '.env.demo.local']) {
      if (existsSync(file)) Object.assign(client, parseEnv(readFileSync(file, 'utf8')));
    }
    Object.assign(client, Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('VITE_'))));
    if (parsed.error || firebase.emulators?.auth?.host !== '127.0.0.1' || firebase.emulators.auth.port !== 9099 || !firebase.emulators.ui?.enabled || firebase.emulators.ui.port !== 4000 || local?.vars?.AUTH_MODE !== 'emulator' || local.vars.FIREBASE_PROJECT_ID !== 'demo-shared-task-board' || !db?.database_name || !db.database_id || !db.migrations_dir || vars.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || client.VITE_FIREBASE_PROJECT_ID !== 'demo-shared-task-board' || client.VITE_USE_AUTH_EMULATOR !== 'true' || !client.VITE_FIREBASE_API_KEY || !client.VITE_FIREBASE_AUTH_DOMAIN || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'demo-shared-task-board') || (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')) throw new Error();
  } catch {
    throw new Error('Invalid or missing local configuration. Copy .env.example to .env.local and .dev.vars.example to .dev.vars.local, and use the demo Firebase and local D1 settings.');
  }
}

export function validatePrerequisites() {
  for (const command of ['pnpm', 'java', 'openssl']) {
    const result = spawnSync(command, [command === 'java' ? '-version' : '--version'], { stdio: 'ignore' });
    if (result.error || result.status !== 0) throw new Error(`Missing or unusable prerequisite: ${command}. Install it and check PATH.`);
  }
  if (!existsSync('node_modules/.bin/firebase') || !existsSync('node_modules/.bin/wrangler')) throw new Error('Project dependencies are missing. Run pnpm install --frozen-lockfile.');
}

export async function checkPorts(ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop the existing listener and retry.`)));
      server.listen(port, '127.0.0.1', () => server.close(resolve));
    });
  }
}

export class Supervisor {
  #groups = new Set();
  #stopping = false;
  start(name, args) {
    console.log(`Starting ${name}...`);
    const child = spawn('pnpm', args, { detached: true, stdio: 'ignore', env: process.env });
    if (child.pid) this.#groups.add(child.pid);
    child.on('error', () => {});
    return child;
  }
  async step(name, args) {
    console.log(`Running ${name}...`);
    const child = this.start(name, args);
    const status = await new Promise((resolve) => {
      child.once('error', () => resolve(1));
      child.once('exit', (code) => resolve(code ?? 1));
    });
    if (status !== 0 || this.#stopping) throw new Error(`${name} failed. Check local prerequisites and retry.`);
  }
  async ready(name, child, port, timeout = 60000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline && !this.#stopping) {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) throw new Error(`${name} stopped before becoming ready.`);
      const ready = await new Promise((resolve) => {
        const socket = connect({ host: '127.0.0.1', port });
        socket.setTimeout(500);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => { socket.destroy(); resolve(false); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
      });
      if (ready) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`${name} did not become ready on port ${port}.`);
  }
  async cleanup() {
    if (this.#stopping) return;
    this.#stopping = true;
    for (const pid of this.#groups) { try { process.kill(-pid, 'SIGTERM'); } catch {} }
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (const pid of this.#groups) { try { process.kill(-pid, 'SIGKILL'); } catch {} }
    this.#groups.clear();
  }
}
