import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const environment = process.argv[2] === '--environment-from-env' ? process.env.ENV ?? '' : process.argv.length > 2 ? process.argv[2] : 'local';
if (!['local', 'dev'].includes(environment)) {
  console.error('Invalid environment. Select ENV=local or ENV=dev; omit ENV for local.');
  process.exit(1);
}
const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'));
const config = parsed.config?.env?.[environment];
const db = config?.d1_databases?.find((entry) => entry.binding === 'DB');
if (parsed.error || !db?.database_name || !db?.database_id || !db?.migrations_dir || (environment === 'dev' && /^0+$/.test(db.database_id.replaceAll('-', '')))) {
  console.error(`Incomplete ${environment} environment D1 configuration; check wrangler.jsonc.`);
  process.exit(1);
}
const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--env', environment, environment === 'local' ? '--local' : '--remote'], { stdio: 'inherit' });
if (result.error || result.status !== 0) {
  console.error(`Migration step failed for ${environment}; check Wrangler configuration and authorization.`);
  process.exit(result.status || 1);
}
