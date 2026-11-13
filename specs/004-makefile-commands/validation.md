# Validation: Makefile commands

## MVP — 2026-11-13

- `make serve` started the local Auth emulator, applied local migrations, seeded fixtures, and started the Worker and Vite. The application returned HTTP 200; browser scenarios signed in and exercised the board. Interrupting the command stopped its services; ports 9099, 4000, 8787 and 5173 were no longer listening.
- `pnpm run typecheck`: passed.
- `pnpm run test:unit`: passed, 63 tests, including controlled startup, missing configuration and prerequisites, occupied port, preparation failure, interruption, and owned-process cleanup.
- `pnpm run build`: passed, with Vite's existing large-chunk warning.
- `pnpm run test:integration`: failed in all eight suites during setup because `env.DB` was not a D1 database; 17 tests were skipped. The test configuration uses the Wrangler default environment, which has no D1 binding. This remains unresolved.
- `pnpm run test:browser` against the running demo: 111 passed, 3 skipped, 1 failed. The mobile Safari cross-tab 403 test timed out during `context.close()` after WebKit logged an internal error. The full browser suite is not green.

Deployment, the full test workflow and remaining migration validation are outside this MVP and remain open in tasks.md.
