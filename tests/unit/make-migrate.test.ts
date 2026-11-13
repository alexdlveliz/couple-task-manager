import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';

describe('migration destination validation', () => {
  it.each(['', 'production', 'unknown'])('rejects invalid destination %j before invoking Wrangler', (value) => {
    const result = spawnSync('node', ['scripts/migrate.mjs', value], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/environment/i);
  });

  it.each([
    [undefined, 'local', '--local'],
    ['local', 'local', '--local'],
    ['dev', 'dev', '--remote'],
  ])('routes %s to the selected database', (input, environment, mode) => {
    const dir = mkdtempSync(join(tmpdir(), 'migration-test-'));
    try {
      const output = join(dir, 'args');
      writeFileSync(join(dir, 'pnpm'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$WORKFLOW_TEST_OUTPUT"\n', { mode: 0o755 });
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, WORKFLOW_TEST_OUTPUT: output };
      delete env.ENV;
      const args = input === undefined ? ['migrate'] : ['migrate', `ENV=${input}`];
      const result = spawnSync('make', args, { encoding: 'utf8', env });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, 'utf8').trim().split('\n')).toEqual(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--env', environment, mode]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';

function isolated(config: string | undefined, response = 'No migrations to apply!') {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-config-'));
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(resolve('Makefile'), join(dir, 'Makefile'));
  copyFileSync(resolve('scripts/migrate.mjs'), join(dir, 'scripts/migrate.mjs'));
  symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
  const bin = join(dir, 'bin'); mkdirSync(bin);
  if (config !== undefined) writeFileSync(join(dir, 'wrangler.jsonc'), config);
  const output = join(dir, 'called');
  writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\nprintf called > "$MIGRATION_CALLED"\nprintf '%s\\n' "$MIGRATION_RESPONSE"\nexit "${'${MIGRATION_STATUS:-0}'}"\n`, { mode: 0o755 });
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, MIGRATION_CALLED: output, MIGRATION_RESPONSE: response };
  delete env.ENV;
  return { dir, output, env, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const validConfig = readFileSync('wrangler.jsonc', 'utf8');
describe('migration failures and reporting', () => {
  it.each([undefined, '{invalid', '{"env":{"dev":{"d1_databases":[{"binding":"DB"}]}}}'])('rejects missing, malformed, or incomplete configuration before applying', (config) => {
    const f = isolated(config);
    try {
      const result = spawnSync('make', ['migrate', 'ENV=dev'], { cwd: f.dir, env: f.env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/configuration/i);
      expect(existsSync(f.output)).toBe(false);
    } finally { f.cleanup(); }
  });

  it.each([
    ['local', { binding: 'DB', database_name: 'local', database_id: 'bad', migrations_dir: 'migrations' }],
    ['dev', { binding: 'DB', database_name: 'dev', database_id: '00000000-0000-0000-0000-000000000000', migrations_dir: 'migrations' }],
    ['dev', { binding: 'DB', database_name: ' ', database_id: '09ad1f2f-026e-4e80-8dc8-1ae3f6cd242e', migrations_dir: 'migrations' }],
  ])('rejects incomplete %s database settings', (environment, db) => {
    const f = isolated(JSON.stringify({ env: { [environment]: { d1_databases: [db] } } }));
    try {
      const result = spawnSync('make', ['migrate', `ENV=${environment}`], { cwd: f.dir, env: f.env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/configuration/i);
      expect(existsSync(f.output)).toBe(false);
    } finally { f.cleanup(); }
  });

  it('rejects an explicitly empty environment before invoking Wrangler', () => {
    const f = isolated(validConfig);
    try {
      const result = spawnSync('make', ['migrate', 'ENV='], { cwd: f.dir, env: f.env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/environment/i);
      expect(existsSync(f.output)).toBe(false);
    } finally { f.cleanup(); }
  });

  it('reports no pending migrations without exposing command output', () => {
    const f = isolated(validConfig, 'No migrations to apply! secret-token task-content');
    try {
      const result = spawnSync('make', ['migrate'], { cwd: f.dir, env: f.env, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/no .*migrations/i);
      expect(result.stdout).not.toMatch(/secret-token|task-content/);
    } finally { f.cleanup(); }
  });

  it('reports a failed migration without exposing command output', () => {
    const f = isolated(validConfig, 'secret-token task-content');
    try {
      const result = spawnSync('make', ['migrate', 'ENV=dev'], { cwd: f.dir, env: { ...f.env, MIGRATION_STATUS: '7' }, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/migration.*failed/i);
      expect(result.stdout + result.stderr).not.toMatch(/secret-token|task-content/);
    } finally { f.cleanup(); }
  });
});
