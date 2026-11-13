---
description: "Implementation tasks for Makefile development commands"
---

# Tasks: Makefile Development Commands

**Input**: `specs/004-makefile-commands/plan.md`, `specs/004-makefile-commands/spec.md`, research, data model, command contract and quickstart.

**Organization**: Each story is an independently verifiable increment. Workflow tests below cover the explicit failure, isolation and routing scenarios in the specification; write them before their corresponding implementation.

## Phase 1: Setup

- [X] T001 Inspect existing commands and prerequisites in `package.json`, `wrangler.jsonc`, `firebase.json`, `scripts/seed-local.ts`, and `README.md`, including callers before changing any existing function
- [ ] T002 Establish thin phony entry-point structure in `Makefile` and a command dispatch convention for helpers in `scripts/`

## Phase 2: Foundational

- [X] T003 Implement reusable named-step execution, actionable failure reporting, and secret-safe diagnostics in `scripts/workflow-common.mjs`
- [X] T004 Implement owned child-process tracking, bounded readiness checks, signal handling, and cleanup of descendants without killing unrelated processes in `scripts/workflow-common.mjs`
- [X] T005 Implement local prerequisite, demo configuration, and required-port validation in `scripts/workflow-common.mjs`, using `firebase.json` and `wrangler.jsonc` as the configuration sources

**Checkpoint**: Shared validation and lifecycle utilities are available to the story workflows.

## Phase 3: User Story 1 — Serve the local environment (P1; MVP)

**Goal**: Start the prepared demo environment through `make serve` and clean up owned services.

**Independent test**: Start with documented prerequisites, open the app, stop the command, and verify owned services stop; repeat with a missing prerequisite and an occupied port.

- [X] T006 [P] [US1] Add controlled startup, port-conflict, failed preparation, interruption, and owned-process cleanup checks in `tests/unit/make-serve.test.ts`
- [X] T007 [US1] Implement local-only Auth emulator startup and readiness, local D1 migrations, fixture seeding, app startup, and cleanup in `scripts/serve.mjs` using `scripts/workflow-common.mjs`
- [X] T008 [US1] Wire `make serve` to `scripts/serve.mjs` in `Makefile` and verify the live scenario in `specs/004-makefile-commands/quickstart.md`

## Phase 4: User Story 2 — Run project checks (P2)

**Goal**: Run all five required check categories with local browser-test services and reliable failure status.

**Independent test**: Run `make test`; force each named check to fail separately and verify nonzero status and cleanup.

- [X] T009 [P] [US2] Add controlled tests for each named check failure, readiness timeout, interruption, and owned-service cleanup in `tests/unit/make-test.test.ts`
- [X] T010 [US2] Implement ordered typecheck, unit, integration, demo build, and browser steps with local Auth, local migration/seeding, and Worker preview in `scripts/test-workflow.mjs`
- [X] T011 [US2] Wire `make test` to `scripts/test-workflow.mjs` in `Makefile` and execute the checks described in `specs/004-makefile-commands/quickstart.md`

## Phase 5: User Story 4 — Apply migrations (P2)

**Goal**: Apply manually authored migrations locally by default or to the explicitly selected supported database.

**Independent test**: Apply a reviewed SQL migration to isolated local D1, repeat with no pending work, and use stubs to verify destination routing and invalid-input rejection.

- [X] T012 [P] [US4] Add routing and failure tests for omitted `ENV`, `local`, `dev`, explicitly empty, unknown and incomplete configuration, and no-pending migrations in `tests/unit/make-migrate.test.ts`
- [X] T013 [US4] Implement destination validation and explicit Wrangler `DB` migration application with `--env local --local` or `--env dev --remote`, no fallback, and actionable failure handling in `scripts/migrate.mjs`
- [X] T014 [US4] Wire `make migrate` in `Makefile`, preserving the distinction between omitted and explicitly empty `ENV`, and verify isolated local migration and repeat behavior using `specs/004-makefile-commands/quickstart.md`

## Phase 6: User Story 3 — Deploy to a selected environment (P3)

**Goal**: Build and deploy only to an explicitly selected, fully configured environment without applying migrations.

**Independent test**: With command stubs, reject missing, unsupported and incomplete destinations before build; verify valid `dev` uses the selected destination and invokes no migration.

- [ ] T015 [P] [US3] Add controlled tests for missing, empty, unsupported and incomplete environments, correct dev build/deploy arguments, and absence of migration commands in `tests/unit/make-deploy.test.ts`
- [ ] T016 [US3] Implement explicit `dev` configuration and non-emulator Firebase build validation, production-mode build, exact Wrangler environment selection, and safe failure reporting in `scripts/deploy.mjs`
- [ ] T017 [US3] Wire `make deploy ENV=dev` to `scripts/deploy.mjs` in `Makefile` and verify the stubbed deployment scenarios in `specs/004-makefile-commands/quickstart.md`

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 Document all four commands, prerequisites, local ports, supported destinations, manually authored SQL migrations, separate remote migration operation, and credentials handling in `README.md` and `scripts/README.md`
- [ ] T019 Run the applicable workflow tests and the end-to-end local scenarios in `specs/004-makefile-commands/quickstart.md`, recording actual results and any unavailable prerequisites in `specs/004-makefile-commands/validation.md`
- [ ] T020 Review the final diff against privacy, local isolation, process cleanup, existing access/synchronization, Spanish accessibility, notification boundaries, and free-tier constraints in `.specify/memory/constitution.md`

## Dependencies & Execution Order

- Setup T001–T002 → foundation T003–T005 → stories.
- US1 (T006–T008) is the MVP; US2 and US4 are P2, followed by US3 at P3. Each story depends on the shared foundation, not on another story.
- Tests precede implementation in each story; a Makefile wiring task follows its corresponding helper. Serialize T008, T011, T014 and T017 because they edit the same file. Shared helper edits must likewise be coordinated.
- T018–T020 follow the relevant stories; complete all stories before final validation. Review each logical diff with the user before any incremental commit, as required by `AGENTS.md`; do not push or create a PR without the user's explicit confirmation.

## Parallel Opportunities

- **US1**: T006 can run alongside unrelated story test work after the foundation; T007 follows its tests.
- **US2**: T009 can run alongside T006, T012 and T015; T010 follows its tests.
- **US4**: T012 can run alongside the other story test tasks; T013 follows its tests.
- **US3**: T015 can run alongside the other story test tasks; T016 follows its tests.
- Story helpers live in separate files and can be developed independently after foundation; coordinate the shared Makefile and avoid simultaneous local services on the same ports.

## Implementation Strategy

Complete setup and foundation, deliver and validate US1 as the MVP, then independently deliver US2 and US4 before US3. Finish with documentation, full local verification and diff review. A real remote migration or deployment is an operator action, not a prerequisite for automated routing tests.
