# Quickstart and Validation

These scenarios describe the planned implementation; run them after implementation. See [command contracts](contracts/commands.md) and [data model](data-model.md).

## Prerequisites

Install make, compatible Node.js (22.12+), pnpm 12.16.1, Java for the Firebase emulator, OpenSSL and Playwright browser/system dependencies. From the repository root run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local` and `.dev.vars.example` to `.dev.vars.local`, and run `pnpm exec playwright install`. The demo Firebase emulator, local D1, and ports 9099, 4000, 8787 and 5173 must be available unless the implementation explicitly disables the emulator UI. Do not use production services or credentials for local workflows.

## Serve

Run `make serve`, open `http://127.0.0.1:5173`, and sign in with the local fixtures documented in `scripts/README.md`. Verify local preparation and application startup, then interrupt the command and verify its services stop. Repeat with a required port occupied and with missing local configuration; expect actionable nonzero failures and the pre-existing listener to remain running.

## Checks

Run `make test`. Confirm named typecheck, unit, integration, build and browser steps complete successfully and no services started by the command remain. Using controlled test doubles, force each step and startup to fail in turn, then interrupt an active run; verify the named failure, nonzero exit, and cleanup without stopping unrelated processes. Exercise readiness timeout as well.

## Migrations

In an isolated test checkout, write and review a representative numbered SQL migration using the existing manual workflow. Run `make migrate` against isolated local D1 and verify the expected schema and recorded migration; repeat and verify no migration is reapplied. Verify `make migrate ENV=local` also selects local D1, and an explicitly empty `ENV` fails without applying. With command stubs, check `make migrate ENV=dev` targets the configured remote dev database, and unsupported or incomplete environments fail before application. Only an authorized operator should run remote migration application after reviewing the SQL and destination.

## Deployment

Without publishing, run `make deploy`, `make deploy ENV=unknown`, and a controlled `dev` invocation with incomplete configuration. Each must fail before build or deployment. With stubbed build and deploy commands, verify a complete `ENV=dev` selects production-mode client configuration and passes exactly `dev` to Wrangler; verify no remote migration command is run. Only an authorized operator with complete matching configuration and credentials should run `make deploy ENV=dev` against the real destination. Review and apply pending remote D1 migrations separately with `make migrate ENV=dev` to the intended database before deployment when needed, and follow the production checks in README. Never print credentials or task contents during validation.
