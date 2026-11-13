import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const environment = process.argv[2] === '--environment-from-env' ? process.env.ENV ?? '' : process.argv.length > 2 ? process.argv[2] : 'local';
if (!['local', 'dev'].includes(environment)) {
  console.error('Invalid environment. Select ENV=local or ENV=dev; omit ENV for local.');
  process.exit(1);
}
let parsed;
try {
  parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'));
} catch {
  console.error(`Missing or unreadable ${environment} environment configuration; check wrangler.jsonc.`);
  process.exit(1);
}
const databases = parsed.config?.env?.[environment]?.d1_databases;
const matches = Array.isArray(databases) ? databases.filter((entry) => entry?.binding === 'DB') : [];
const db = matches[0];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const uuid = typeof db?.database_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(db.database_id);
if (parsed.error || matches.length !== 1 || !nonempty(db?.database_name) || !uuid || !nonempty(db?.migrations_dir) || (environment === 'dev' && /^0+$/.test(db.database_id.replaceAll('-', '')))) {
  console.error(`Incomplete ${environment} environment D1 configuration; check wrangler.jsonc.`);
  process.exit(1);
}
const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--env', environment, environment === 'local' ? '--local' : '--remote'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || result.status !== 0) {
  console.error(`Migration step failed for ${environment}; check Wrangler configuration and authorization.`);
  process.exit(result.status || 1);
}
if (/no migrations to apply/i.test(result.stdout ?? '')) {
  console.log(`No pending migrations for ${environment}.`);
} else {
  console.log(`Pending migrations applied to ${environment}.`);
}
