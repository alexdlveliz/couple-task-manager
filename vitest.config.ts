import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig, defineProject } from 'vitest/config';
import { createEphemeralCertificate } from './tests/fixtures/create-ephemeral-cert.js';

const migrations = await readD1Migrations('./migrations');
const signingFixture = createEphemeralCertificate();
process.env.TEST_SIGNING_PRIVATE_KEY = signingFixture.privateKey;
process.env.TEST_SIGNING_CERTIFICATE = signingFixture.certificate;

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', fileParallelism: false, include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      defineProject({
        plugins: [cloudflareTest({
          remoteBindings: false,
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: { d1Databases: ['DB'], bindings: { TEST_MIGRATIONS: migrations, TEST_SIGNING_PRIVATE_KEY: signingFixture.privateKey, TEST_SIGNING_CERTIFICATE: signingFixture.certificate, AUTH_MODE: 'production', FIREBASE_PROJECT_ID: 'demo-shared-task-board' } },
        })],
        test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], setupFiles: ['./tests/integration/setup.ts'] },
      }),
    ],
  },
});
