# Research: Makefile Development Commands

## Command orchestration

**Decision**: Use a root Makefile as the public interface and a focused supervisor helper for multi-step workflows. Reuse existing pnpm scripts and explicitly invoke local Wrangler operations.

**Rationale**: Make supplies the requested discoverable entry points; a single supervisor can track child processes, readiness, errors and cleanup across multiple recipe steps.

**Alternatives considered**: Independent Make recipe lines lose shared lifecycle state; rewriting existing test/build logic duplicates maintained project commands.

## Local startup and ownership

**Decision**: Check prerequisites, local configuration and required ports before starting services. Start the demo Auth emulator, wait for readiness, apply local D1 migrations, seed fixtures, then start the application for serve or the Worker preview for browser tests. Use bounded readiness checks and track owned child processes and descendants, cleaning them on normal exit, failure and signals; never kill a process by port alone.

**Rationale**: `firebase.json` fixes Auth at 9099 and UI at 4000; the existing app uses 8787 and Vite uses 5173. The seeder restricts itself to the demo project and local D1. Explicit ownership avoids terminating someone else's services.

**Alternatives considered**: Reusing an already-running emulator cannot guarantee isolation or lifecycle ownership; unbounded sleeps are unreliable. Disable the optional emulator UI if the implementation explicitly configures and documents that choice; otherwise check its port.

## Test sequence

**Decision**: Run typecheck, unit, integration, demo build and browser tests as named steps; start required local services and prepare local data before browser tests. Stop on the first failure, report its name, propagate a nonzero result, and clean owned services.

**Rationale**: The five scripts in `package.json` map directly to the specification. Playwright uses the Worker at 127.0.0.1:8787, not the Vite dev server.

**Alternatives considered**: Running only unit tests misses required categories; continuing after a failed prerequisite can produce misleading downstream errors.

## Deployment selection

**Decision**: Allow only an explicit `ENV=dev` initially, verify that its Wrangler environment and required production-mode Firebase build configuration are complete and consistent, then build for that selected environment and run Wrangler deployment with that exact environment. Refuse missing, unsupported or incomplete configuration before building. Never invoke remote migrations.

**Rationale**: `wrangler.jsonc` defines a dev binding and Firebase project, but its presence alone does not prove credentials or client build configuration are available. The dev deployment uses Vite dev mode to load `.env.dev`, while `NODE_ENV=production` enables production build behavior; demo build settings must not leak into a remote deployment.

**Alternatives considered**: Wrangler's default environment risks an implicit destination; using the demo build would point the deployed client at emulator settings; automatically applying migrations violates the specification. No live deployment is necessary to verify argument handling.

## Migration application

**Decision**: Apply recorded migrations with the explicit local D1 binding when `ENV` is omitted; `ENV=local` also selects local D1, while `ENV=dev` selects the configured dev D1 database in remote mode. Reject an explicitly empty value. Validate the mapping before invoking Wrangler, reject unsupported or incomplete environments, and keep this operation separate from deployment. `dev` is the initial remote environment.

**Rationale**: The `DB` bindings identify distinct local and dev databases in `wrangler.jsonc`; select `DB` with `--env local --local` or `--env dev --remote` respectively, and the operator must be able to identify the actual destination. Local preparation must not reach a remote database.

**Alternatives considered**: An implicit remote default risks applying changes to the wrong database; applying during deployment contradicts the specification.

## Migration authoring

**Decision**: Retain the existing hand-authored, numbered SQL migration workflow. This feature does not add migration generation.

**Rationale**: The project already stores its schema and trigger changes in versioned SQL. The user selected the existing workflow; [Wrangler creates empty SQL migration files](https://developers.cloudflare.com/d1/reference/migrations/) rather than inferring schema changes.

**Alternatives considered**: Adding a declarative schema and a diff generator introduces a new source of truth and baseline work without being needed for migration application. A scaffolding command is also outside the requested scope.
