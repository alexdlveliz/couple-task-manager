---
description: "Implementation checklist for Private Tasks"
---

# Tasks: Private Tasks

**Inputs** — [Specification](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [interface contract](contracts/private-tasks.md), and [quickstart](quickstart.md).

## Phase 1 — Setup

- [X] T001 Prepare the Firebase demo emulator and local D1 environment using `README.md` and `scripts/README.md`. Run the existing `make test` workflow from `Makefile` to record the baseline.

## Phase 2 — Foundation

- [X] T002 [P] Define shared/private visibility on task responses and optional visibility on create inputs in `src/shared/contracts.ts`. In `src/shared/validation.ts`, default omitted visibility to shared, require a shared assignee, permit an omitted private assignee, reject invalid visibility, and reject visibility or creator fields on replacement.
- [X] T003 [P] Add `migrations/0004_private_tasks.sql` with “`visibility` with values `shared` and `private`, defaulting to `shared`, and nullable `creator_uid` referencing a partner.” Enforce “Private rows require a creator and `assignee_uid = creator_uid`” and immutable visibility and creator. Add two slot-specific counters to singleton metadata, backfill both from the global revision, and update the partner metadata trigger to advance all three counters.

## Phase 3 — US1 Create and manage a private task (P1)

**Independent acceptance** — Each partner can create shared and private tasks through the same accessible form, then edit their own private task with its visibility and assignment fixed.

- [X] T004 [US1] In `src/worker/tasks.ts`, persist visibility and derive the private creator and assignee from the authenticated UID. Reject a different supplied assignee with a Spanish field error. Preserve existing validation and mutation responses, including task visibility.
- [X] T005 [P] [US1] In `src/client/api.ts`, decode visibility on returned tasks and pass the create-only field through the existing creation request. Keep replacement payloads limited to existing editable fields.
- [X] T006 [P] [US1] In `src/client/TaskForm.tsx` and `src/client/Board.tsx`, add accessible Spanish creation options “Compartida” and “Privada”, default to shared, and show the creator as fixed assignee for private tasks. Keep existing edit fields and show private visibility as informational.
- [X] T007 [P] [US1] Label private cards “Privada” in `src/client/Kanban.tsx` while preserving keyboard operation and mobile touch targets.

## Phase 4 — US2 Keep private tasks isolated (P1)

**Independent acceptance** — With private rows owned by each fixture partner, test both authenticated views, direct mutation denial, conditional revisions, and offline account switching.

- [X] T008 [US2] In `src/worker/tasks.ts`, scope board reads, replacement, deletion, and mutation diagnostics to shared rows or the authenticated creator. Make inaccessible and missing tasks return the same Spanish 404. Reject private reassignment and ensure failed mutations leave state and revisions intact.
- [X] T009 [US2] In `src/worker/tasks.ts` and `src/worker/index.ts`, return the authorized slot revision, atomically read it alongside visible rows, and use it for conditional GET and mutation responses. Advance both slot counters for shared changes and only the creator’s counter for private changes, in the existing single metadata-row update with the global sequence and overflow guard.
- [X] T010 [P] [US2] In `src/client/snapshot-store.ts`, normalize legacy snapshots’ missing visibility to shared and preserve project/UID isolation, complete snapshot writes, and read-only offline behavior. Verify the existing `src/client/sync.ts` watermark logic with caller-specific revisions.

## Phase 5 — US3 Receive private task notifications (P1)

**Independent acceptance** — With both partners registered, verify private creation, completion, and overdue events address only the creator. Ordinary edits are silent and a combined completion and edit emits one completion event.

- [X] T011 [P] [US3] In `src/worker/task-notification-events.ts`, scope event selection to the owner for private creation and completion, suppress ordinary edits, retain shared recipients and Spanish payloads, and match the mutation’s authorization using stored visibility for existing tasks.
- [X] T012 [P] [US3] In `src/worker/notification-scheduler.ts`, use the same owner-only eligible audience in overdue candidate selection and enqueue, preserving shared behavior, disabled-partner handling, deduplication, and repeat processing.
- [X] T013 [US3] In `src/worker/tasks.ts`, pass creation ownership to the event batch and verify creation, replacement, and deletion keep event writes and deadline-cycle maintenance atomic. Preserve the single-row `changes()=1` guard and verify that silent deadline edits maintain cycles and obsolete delivery cleanup.

## Phase 6 — Cross-cutting validation

- [ ] T014 Verify every scenario in `specs/007-private-tasks/quickstart.md`, including same-device offline account switching, conditional revision isolation, unauthorized replacement and deletion, shared recipient regressions, and upgrade from existing shared rows. Run `make test` and record actual results and any manual checks still pending in `specs/007-private-tasks/validation.md`.
- [ ] T015 Review the rollout and rollback order against `specs/007-private-tasks/plan.md` and `README.md`. Confirm the migration precedes the compatible Worker rollout and a pre-feature Worker cannot serve private rows after activation.

## Dependencies and execution order

- **Graph** — Setup → Foundation → US1 and US2 → US3 batch integration → validation. T008 and T009 follow T004 because they share the task persistence code. T011 and T012 can start once the foundation is ready. T013 waits for T009, T011, and T012.
- **Parallel examples** — US1 API decoding, form wiring, and card labels can proceed in distinct files once the shared contract is fixed. For US2, offline snapshot compatibility can proceed alongside Worker authorization. For US3, saved-event and overdue selection can proceed independently before batch integration.
- **MVP** — Validate US1 with local fixtures alongside US2 isolation and US3 recipient handling. Enable private creation for real accounts only after all three P1 stories and rollout checks pass.
- **Incremental delivery** — Present logical migration, API, UI, and notification diffs for review before committing. Stage specific paths and use Conventional Commits. Push and open a PR only after explicit confirmation that implementation is complete and tested.
