# Validation: Makefile commands

## MVP — 2026-11-13

- `make serve` started the local Auth emulator, applied local migrations, seeded fixtures, and started the Worker and Vite. The application returned HTTP 200; browser scenarios signed in and exercised the board. Interrupting the command stopped its services; ports 9099, 4000, 8787 and 5173 were no longer listening.
- `pnpm run typecheck`: passed.
- `pnpm run test:unit`: passed, 63 tests, including controlled startup, missing configuration and prerequisites, occupied port, preparation failure, interruption, and owned-process cleanup.
- `pnpm run build`: passed, with Vite's existing large-chunk warning.
- `pnpm run test:integration`: failed in all eight suites during setup because `env.DB` was not a D1 database; 17 tests were skipped. The test configuration uses the Wrangler default environment, which has no D1 binding. This remains unresolved.
- `pnpm run test:browser` against the running demo: 111 passed, 3 skipped, 1 failed. The mobile Safari cross-tab 403 test timed out during `context.close()` after WebKit logged an internal error. The full browser suite is not green.

Deployment, the full test workflow and remaining migration validation are outside this MVP and remain open in tasks.md.

## User Story 2 — 2026-11-13

- `make test` completed successfully on the second full run: typecheck, unit, integration, demo build and browser checks passed, with local Auth, migrations, fixtures and Worker preview supervised by the command. Ports 9099, 4000 and 8787 were released afterward.
- The first full run correctly failed at `test:browser` on the mobile Chrome cross-tab 403 scenario. That case passed when rerun alone; the subsequent full run passed. The earlier mobile Safari timeout is recorded above.
- Integration setup now supplies an isolated D1 test binding: `pnpm run test:integration` passed all 17 tests.
- Final `pnpm run test:unit` passed all 75 tests, including controlled failures for all five checks, startup failures, readiness timeout, interruption, and cleanup of detached descendants. Final typecheck passed.

## User Story 4 — 2026-11-13

- In a temporary local D1 store, `make migrate` applied a representative manually authored SQL migration. Schema inspection confirmed its table and migration record; `make migrate ENV=local` then reported no pending migrations. No remote migration was run.
- Controlled tests covered omitted, local, dev, empty, unsupported, missing, malformed and incomplete destinations; failure propagation; no-pending reporting; and suppression of command output. `pnpm run test:unit` passed 84 tests and typecheck passed.
- An initial `make migrate` attempt was inadvertently run from the project directory and failed in the sandbox. Its command selected local D1; no remote operation was attempted. The isolated check then succeeded with local D1.
- The temporary fixture's dependency symlink affected project dependency links; these were restored using `pnpm install --frozen-lockfile` before final verification.

## User Story 3 — 2026-11-13

- Controlled deployment tests verified missing, empty and unsupported environment rejection; incomplete Wrangler, Worker, D1, assets and Firebase configuration rejection before building; production environment precedence; exact `build:production` and `wrangler deploy --env dev` arguments; named failures; suppressed child output; and no migration commands.
- `pnpm run test:unit` passed 106 tests; typecheck passed. Integration passed 17 tests. A production-mode build using non-secret test Firebase values passed with the existing large-chunk warning.
- `make deploy` and `make deploy ENV=unknown` rejected their destination. An invocation of `make deploy ENV=dev` against the current incomplete Firebase configuration was also rejected before the build. No deployment or remote migration was performed. Successful deployment routing was tested with substitutes only.

## Environment file selection

- Deployment validation and the `build:dev` command use Vite's `dev` mode, with `NODE_ENV=production`. Controlled tests verified `.env.dev` overrides local demo values and `.env.production.local` is ignored for dev deployment.
- `make serve` continues to use `.env.local` for its demo build and Vite development server. `pnpm run test:unit` passed 106 tests, typecheck passed, and a dev-mode production build passed with test Firebase values. No deployment was performed.
