import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- The installed Cloudflare test pool currently provides these migration fixtures.
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
