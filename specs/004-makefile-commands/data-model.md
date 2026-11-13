# Data Model: Command Workflows

This feature adds no persistent application entities or schema migrations.

## Workflow invocation

- **Fields**: command (`serve`, `test`, `deploy`, or `migrate`), phase, outcome, owned process handles, selected environment for deployment or migration.
- **Rules**: local workflows use only demo Firebase and local D1; deploy requires an explicit supported, fully configured environment. Diagnostics exclude credentials, tokens and task contents.
- **Transitions**: validate → prepare/start → run → cleanup → success or failure. Failure or interruption at any phase transitions to cleanup of owned processes before exit; deployment has no local-service cleanup unless it starts one.

## Migration record

- **Fields**: ordered versioned SQL file, intended schema change and application status recorded by D1 for each database.
- **Rules**: migration SQL is authored and reviewed manually; application operates on the selected database and skips already applied records.

## Deployment environment

- **Fields**: environment name, matching Wrangler configuration, Firebase project and client build configuration, credentials supplied externally.
- **Rules**: only `dev` is initially supported; missing or inconsistent required configuration rejects the invocation before build or publish. Credentials are not stored in the model or printed. Remote migrations are a separate operator action.
