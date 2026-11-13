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
