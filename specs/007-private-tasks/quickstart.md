# Quickstart: Validate Private Tasks

## Local setup

Follow the [README](../../README.md) and [local fixture guide](../../scripts/README.md). Use Node.js 22.12+, pnpm 12.16.1, Java, OpenSSL, Playwright browsers, and the Firebase demo project. Use only local D1 and demo identities.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install
make test
```

Prepare the example environment files as described in the README before running the suite. For interactive checks use `make serve`. For separate browser runs use `pnpm run preview:worker` and `pnpm run test:browser` with Firebase Auth running and port 8787 free before starting preview.

## Acceptance checks

1. Create a shared and private task as each fixture partner. Verify default shared visibility, keyboard and screen-reader operation, fixed private assignment, Spanish labeling, and successful owner edits and deletion. Verify existing shared tasks remain editable by both partners.
2. Synchronize both accounts. Save and delete private tasks as one partner and verify the other's conditional board revision remains valid. Verify direct replacement and deletion return the missing-task response for the other partner. Verify no failed attempt changes tasks or queues events.
3. View an authorized snapshot offline, reconnect and switch accounts on the same browser, then go offline again. Verify each account receives only its own authorized board and offline remains read-only.
4. Register both partners in the local notification integration harness. Verify creator-only creation, completion, and overdue events and deliveries. Change a title and deadline without completing and verify no immediate event. Complete with another edit and verify one completion event. Repeat overdue processing and reopen on the same cycle, then replace the deadline and verify only the new eligible cycle can notify again. Verify shared-recipient behavior remains intact.
5. Upgrade a local database containing shared tasks and a populated board revision. Confirm legacy snapshots synchronize, both partners retain shared access, and shared mutations and partner metadata changes advance both audience revisions.

Use the [interface contract](contracts/private-tasks.md) for expected response behavior and the [data model](data-model.md) for migration and event invariants.
