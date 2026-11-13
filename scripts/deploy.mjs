import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import ts from 'typescript';
import { loadEnv } from 'vite';

const environment = process.env.ENV;
if (environment !== 'dev') {
  console.error('Invalid environment. Select the configured destination with make deploy ENV=dev.');
  process.exit(1);
}
let config;
let client;
try {
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'));
  if (parsed.error) throw new Error();
  config = parsed.config;
  client = loadEnv('dev', process.cwd());
} catch {
  console.error('Missing or invalid dev environment configuration; check wrangler.jsonc and production Firebase settings.');
  process.exit(1);
}
const dev = config?.env?.dev;
const project = dev?.vars?.FIREBASE_PROJECT_ID;
const databases = Array.isArray(dev?.d1_databases) ? dev.d1_databases.filter((entry) => entry?.binding === 'DB') : [];
const db = databases[0];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const uuid = typeof db?.database_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(db.database_id) && !/^0+$/.test(db.database_id.replaceAll('-', ''));
const main = dev?.main ?? config?.main;
const assets = dev?.assets ?? config?.assets;
let mainExists = false;
try { mainExists = nonempty(main) && statSync(main).isFile(); } catch {}
const domain = client.VITE_FIREBASE_AUTH_DOMAIN;
const standardDomain = typeof domain === 'string' && /\.(?:firebaseapp\.com|web\.app)$/i.test(domain);
const validDomain = typeof domain === 'string' && /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain) && domain.includes('.') && domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) && !/^\d+\.\d+\.\d+\.\d+$/.test(domain) && !/^(?:demo-|localhost(?:\.|$))/i.test(domain);
if (!nonempty(config?.name) || !mainExists || /(?:^|\/)local\.(?:[cm]?[jt]s)$/i.test(main) || (!nonempty(assets?.directory) || resolve(assets.directory) !== resolve('dist')) || dev?.vars?.AUTH_MODE !== 'production' || !nonempty(project) || project.startsWith('demo-') || databases.length !== 1 || !nonempty(db?.database_name) || !uuid || !nonempty(db?.migrations_dir) || client.VITE_FIREBASE_PROJECT_ID !== project || !nonempty(client.VITE_FIREBASE_API_KEY) || client.VITE_FIREBASE_API_KEY.startsWith('demo-') || !validDomain || (standardDomain && ![`${project}.firebaseapp.com`, `${project}.web.app`].includes(domain.toLowerCase())) || !['', 'false'].includes(client.VITE_USE_AUTH_EMULATOR ?? '')) {
  console.error('Incomplete or inconsistent dev configuration. Check Wrangler D1 and production Firebase settings before deploying.');
  process.exit(1);
}
for (const [name, args] of [
  ['production build', ['run', 'build:dev']],
  ['dev deployment', ['exec', 'wrangler', 'deploy', '--env', 'dev']],
]) {
  console.log(`Running ${name}...`);
  const result = spawnSync('pnpm', args, { stdio: 'ignore', env: { ...process.env, ...client, NODE_ENV: 'production' } });
  if (result.error || result.status !== 0) {
    console.error(`${name} failed. Check dependencies, configuration, and Cloudflare authorization.`);
    process.exit(result.status || 1);
  }
}
console.log('Deployment to dev completed.');
