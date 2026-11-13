# Developer Command Contract

Run commands from the repository root. Failure returns a nonzero status with an actionable, named step; successful finite commands return zero. No command prints credentials, tokens or task contents.

| Command | Input | Successful behavior |
|---|---|---|
| `make serve` | Documented local prerequisites and configuration | Prepare local demo D1 and identities, start local Auth and app, and remain running until interrupted. Stop all services it started on exit. |
| `make test` | Documented local prerequisites, browser dependencies and configuration | Run typecheck, unit, integration, demo build and browser tests with required local services; stop owned services after success or failure. |
| `make migrate` | Local D1 configuration | Apply pending recorded migrations to local D1 only. |
| `make migrate ENV=local` | Local D1 configuration | Apply pending recorded migrations to local D1 only. |
| `make migrate ENV=dev` | Complete matching configuration and authorization | Apply pending recorded migrations to the selected remote D1 database. |
| `make deploy ENV=dev` | Explicit supported environment, complete matching configuration and externally supplied authorization | Build using appropriate non-emulator settings and deploy to exactly `dev`; do not apply remote migrations. |

Deployment requires `ENV`; migration uses local D1 when `ENV` is omitted or is `local`; an explicitly empty `ENV` is invalid. Unsupported or incomplete selected environments fail before building, publishing, or applying migrations, without fallback. Local workflows reject unsafe configuration and occupied required ports; they never adopt or stop pre-existing services. Startup and readiness failures, check failures and interruptions clean owned services. See [quickstart.md](../quickstart.md) for validation.
