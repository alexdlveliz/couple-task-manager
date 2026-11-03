# Tasks: Shared Task Board

**Input**: `specs/001-shared-task-board/` — spec.md, plan.md, research.md, data-model.md, contracts/openapi.yaml, contracts/ui.md and quickstart.md; `.specify/memory/constitution.md` 1.0.0.
**Organization**: Setup → foundation → US1 (P1) → US2 (P2) / US3 (P3) → polish. Exact paths below are repository-relative planned files; this repository currently contains design artifacts only.
**Tests**: Included for specification acceptance/access-control criteria and the design's explicit verification requirements. Write story tests first, confirm meaningful failures, then implement and pass them. Manual acceptance complements automated tests.
**Format**: `- [ ] Tnnn [P?] [USn?] Description with file path`. `[P]` means separate files and no dependency on another incomplete task within the indicated parallel group; phase gates and explicit prerequisites still apply.
**Boundary**: Generate no notification/reminder, registration, deletion, extra-member or offline-write functionality. Retain the current branch. Exact dependency patches and deployment identifiers are resolved during implementation, not invented here.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the single React/TypeScript PWA and Worker repository and intended quickstart commands.

- [X] T001 Initialize Node.js 22.12+ / pnpm ES-module tooling in package.json, pnpm-lock.yaml and tsconfig.json; pin compatible React 19.x, TypeScript 5.x, Vite, Firebase browser SDK, Workers-compatible JOSE, Temporal polyfill, Wrangler, Firebase CLI, PWA/Workbox and test dependencies; provide typecheck, test:unit, test:integration, test:browser, build, dev, preview:worker and seed:local scripts matching specs/001-shared-task-board/quickstart.md.
- [X] T002 [P] Configure the React entry and Vite API proxy in index.html, vite.config.ts and src/client/main.tsx; use lang="es", port 5173, /api proxy to 8787 and dist output; defer service-worker caching to US3.
- [X] T003 [P] Configure one Worker with DB binding and migrations in wrangler.jsonc, src/worker/env.ts, .env.example, .dev.vars.example and .gitignore; pin compatibility date, serve dist, route /api and /api/* Worker-first before SPA fallback, ignore local credentials, and separate local emulator from production configuration with production rejection of emulator mode/host.
- [X] T004 [P] Configure Vitest 4.1+ unit and Worker integration projects in vitest.config.ts and tests/integration/setup.ts using @cloudflare/vitest-plugin cloudflareTest(), real D1 migrations via readD1Migrations/applyD1Migrations, isolated local storage, no remote bindings and separate production-verifier/emulator suites.
- [X] T005 [P] Configure Firebase Auth Emulator and Playwright in firebase.json, playwright.config.ts and tests/browser/fixtures.ts; use demo-shared-task-board, Auth 127.0.0.1:9099, emulator UI 4000 and built Worker base URL 127.0.0.1:8787; cover Chromium, Firefox, WebKit and mobile profiles with isolated partner contexts.

**Checkpoint**: Tooling and configuration exist; infrastructure commands may depend on implementation entrypoints added below.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, trust boundary and local fixtures. Finish before story work.

- [X] T006 Implement shared API types and strict request validation in src/shared/contracts.ts and src/shared/validation.ts from contracts/openapi.yaml; title is "Trimmed, nonempty; server and client share whitespace rules", assigneeUid is "Required FK to unique partner UID; enabled at save time", status is "`todo`, `in_progress`, `blocked`, `completed`", and deadline is "RFC 3339 canonical `Z` string, or null"; reject unknown/missing fields, unzoned/impossible/nonfinite instants and POST status/server fields, allow omitted POST deadline and past dates, require all four editable PUT fields, and canonicalize instants.
- [X] T007 [P] Create migrations/0001_shared_board.sql with partners, tasks and board_metadata constraints/indexes and foreign keys: partner slot "Primary key, exactly one of 1 or 2", uid "Unique, nonempty Firebase UID", displayName "Nonempty Spanish-facing display name", enabled "Required; checked on every API request"; task id "Server-generated primary key, immutable", title "Trimmed, nonempty; server and client share whitespace rules", assigneeUid "Required FK to unique partner UID; enabled at save time", status "`todo`, `in_progress`, `blocked`, `completed`", deadline "RFC 3339 canonical `Z` string, or null", createdAt "Server-set and immutable", updatedAt "Server-set on each successful save"; singleton "id=1", "revision starts at 0" and "integer in JSON-safe range 0..9007199254740991"; keep revision across migrations and guard overflow in mutations.
- [X] T008 [P] Implement Firebase production verification and explicit local-only emulator verification in src/worker/auth.ts; verify RS256 with trusted Google securetoken keys/kid, certificate cache lifetime, exp, iat, auth_time, exact aud/issuer and nonempty sub; never use request-selected bypasses, reject unsigned tokens in production, and surface trusted-key retrieval failure as service unavailability.
- [X] T009 [P] Implement Spanish API error mapping and routing shell in src/worker/index.ts and src/worker/errors.ts; enforce no-store on every API response, JSON 404 for unknown API routes, JSON 405 with Allow for unsupported methods, 415 for non-JSON writes, safe error codes/messages from OpenAPI and no credential/token/task-content logging.
- [X] T010 Implement enabled-UID authorization and partner access in src/worker/partners.ts using bound SQL; check current enabled caller on every API request before reads/writes/304, list only enabled UID/displayName entries in slot order, and fail service readiness unless both fixed slots exist; expose no partner-management endpoint.
- [X] T011 Implement idempotent demo-only provisioning in scripts/seed-local.ts; refuse non-demo Firebase projects and remote D1, create/reuse two partner accounts plus outsider, seed actual authorized UIDs into fixed D1 slots, initialize revision only for an empty database and preserve it on reseeding; document local-only fixture passwords in scripts/README.md and advance revision when existing partner display/assignment metadata changes.
- [X] T012 Implement Firebase persisted browser auth and Spanish sign-in shell in src/client/auth.ts, src/client/SignIn.tsx and src/client/App.tsx; connect emulator only before local sign-in, translate SDK errors, provide private-board onboarding and sign-out with no registration link, and expose UID/auth-generation invalidation hooks before any private board renders.

**Checkpoint**: Shared contracts, database, local identities and server/client trust boundaries are ready. Execute typecheck and local migration/seed smoke checks; no production provisioning or deployment.

## Phase 3: User Story 1 — Share and update tasks privately (Priority: P1) — MVP

**Goal**: Both authorized partners manage all tasks equally and see authoritative connected updates.
**Independent Test**: In separate A/B sessions, create, reassign, edit, traverse all states and complete each other's tasks; both see saved values after refresh. Deny every unauthenticated/outsider request. Each partner completes create/assign/complete in under two minutes.

### Tests for User Story 1

- [X] T013 [P] [US1] Add validation/status tests in tests/unit/validation.test.ts for whitespace parity, required/outsider assignees, all states/reopening, strict POST/PUT field sets and immutable server fields; verify Spanish validation mapping and unchanged state on rejection.
- [X] T014 [P] [US1] Add signed-token and endpoint access tests in tests/integration/auth.test.ts covering all four operations, missing bearer, forged/expired/unsigned tokens, wrong aud/issuer, missing claims, outsider and disabled UID including matching-ETag access; mock trusted-key retrieval separately from signed fixtures, test certificate failures and production emulator-config rejection, and confine emulator acceptance to local-suite tests.
- [X] T015 [P] [US1] Add real-D1 contract/transaction tests in tests/integration/tasks.test.ts for GET /api/partners, GET/POST /api/tasks and PUT /api/tasks/{id}: exact bodies/status/headers, complete ordered snapshots, 304 without task scan, 400/403/404 without revision changes, same-value saves, overflow, guarded disabling/assignee races, rollback after forced statement failure and last-commit-wins full replacements; race revision lookup against saves and assert returned rows match returned revision.
- [X] T016 [P] [US1] Add refresh-coordinator tests in tests/unit/sync.test.ts for 15-second visible polling, hidden/offline pause, 10-second timeout, coalesced immediate triggers, old GET/304/mutation response ordering, separate complete/highest-seen revisions and UID/generation cancellation.
- [X] T017 [P] [US1] Add two-partner browser tests in tests/browser/board.spec.ts for create/edit/assignment/all states/equal rights, successful refresh visibility, preserved drafts during polling and failed/uncertain saves, non-JSON/quota/service failures, manual retry and no automatic POST retry; include Spanish mobile/keyboard flows and record per-partner under-two-minute acceptance procedure.

### Implementation for User Story 1

- [X] T018 [US1] Implement bound D1 reads and atomic saves in src/worker/tasks.ts; generate UUID/timestamps, default creation to todo, guard caller and enabled assignee inside mutation, replace full editable record on PUT, preserve ID/createdAt, conditionally increment revision exactly once including same-value saves, read back committed task/revision, roll back failures, classify missing ID consistently and reject overflow.
- [X] T019 [US1] Wire all four contracted operations in src/worker/index.ts using src/worker/tasks.ts and src/worker/partners.ts; authorize before ETag checks, return bodyless 304 for exact quoted board-r revision match without task scan, otherwise read full tasks plus metadata in one batch ordered by createdAt/id including completed tasks, and use no-store/error semantics for every response.
- [X] T020 [P] [US1] Implement authenticated network transport in src/client/api.ts with refreshed Firebase bearer tokens, strict response handling, 10-second timeout, non-JSON/service failure mapping, definitive 401/403 invalidation and no automatic uncertain mutation retry.
- [X] T021 [US1] Implement refresh coordination in src/client/sync.ts after T020: separate snapshotRevision/highestSeenRevision, reject stale full snapshots/304s, associate requests with UID/auth generation, refresh partners with changed boards before accepting complete state, and refresh immediately after confirmed saves using the last complete ETag; coalesce focus/reconnect/save/manual triggers with 15-second visible-only nonoverlapping polling.
- [X] T022 [P] [US1] Implement accessible Spanish board and task editor in src/client/Board.tsx, src/client/TaskForm.tsx and src/client/styles.css; show four labeled status groups/counts, all task titles/assignee names, empty state and Sin fecha límite, require title/assignee, permit editing any assignment/status, preserve drafts on refresh/failure, and support keyboard/modal focus, inline validation, 44px targets, 320px layout and 200% zoom.
- [X] T023 [US1] Integrate auth, board, forms and synchronization in src/client/App.tsx; show loading/current/refreshing/stale/save-pending/confirmed/uncertain states per UI contract, distinguish successful save from failed refresh, invalidate pending requests on account changes, clear private memory on sign-out/401/403 and disable writes without connection; pass null for new deadlines and preserve any existing instant on edits until US2 adds controls.
- [ ] T024 [US1] Execute US1 unit/integration/browser checks and record evidence in specs/001-shared-task-board/validation.md, including both partner timings, authorization matrix, revision/concurrency races and Spanish keyboard acceptance; fix failures in the owning US1 files before declaring the MVP checkpoint.

**Checkpoint**: Connected MVP works without due-date controls or offline persistence. This is an incremental milestone, not full FR-006/FR-007 acceptance.

## Phase 4: User Story 2 — Add a due date (Priority: P2)

**Goal**: Either partner adds, changes or removes a deadline with explicit local zone and stable UTC storage.
**Independent Test**: Save with/without deadlines; Guatemala 2026-11-02 09:00 becomes 15:00Z and Madrid 16:00 UTC+01:00. Remove it and verify null for both partners; exercise DST gaps/folds and device-zone changes.

### Tests for User Story 2

- [X] T025 [P] [US2] Add conversion tests in tests/unit/deadline.test.ts for optional/null/past instants, impossible/unzoned inputs, unchanged instant round trips, New York 2027-03-14 02:30 rejection and 2027-11-07 01:30 choosing 05:30Z with UTC−04:00; test zone change during editing and deadline-specific offsets.
- [X] T026 [P] [US2] Add deadline API contract tests in tests/integration/deadline.test.ts for POST omitted/null/value, full PUT add/change/remove, canonical Z storage, rejection without revision changes and no automatic status change.
- [X] T027 [P] [US2] Add cross-zone browser tests in tests/browser/deadline.spec.ts for Guatemala/Madrid values, displayed IANA/offset, removal, optional and past deadlines, DST Spanish feedback, device-zone reconfirmation and keyboard-accessible date/time flows.

### Implementation for User Story 2

- [X] T028 [US2] Implement Temporal-based conversion/display in src/client/deadline.ts: capture current IANA zone, reject nonexistent wall time, choose earlier repeated occurrence with Spanish offset notice, preserve untouched instants, compute offset for deadline date and require review after zone changes before saving changed local fields.
- [X] T029 [US2] Add optional Fecha límite/Hora límite controls and Quitar fecha límite to src/client/TaskForm.tsx; integrate T028, clear both controls on removal, send canonical Z/null and expose zone, offset, linked errors and zone-change review in Spanish without overwriting drafts.
- [X] T030 [US2] Render Spanish date/time/IANA/offset or Sin fecha límite in src/client/Board.tsx; recalculate for current device zone without altering the saved instant, and keep all statuses independent of deadlines.
- [X] T031 [US2] Run US2 tests plus US1 regressions and record cross-zone/DST/removal and manual keyboard results in specs/001-shared-task-board/validation.md; fix failures before the deadline checkpoint.

**Checkpoint**: US1 + deadline functionality work without requiring US3. Server deadline representation already exists from foundation; US2 adds the complete user flow.

## Phase 5: User Story 3 — View tasks without connectivity (Priority: P3)

**Goal**: Previously authorized tasks survive offline reopening with clear stale state, isolated storage and authoritative reconnection.
**Independent Test**: Load all tasks, await shell installation/cache transaction, disconnect and reopen in the same persistent profile; see every task and last-sync/stale text with no writes. Reconnect after the other partner saves and verify complete replacement; switching/signing out must never restore another UID's data.

### Tests for User Story 3

- [X] T032 [P] [US3] Add IndexedDB tests in tests/unit/snapshot-store.test.ts for project/UID/schema keys, atomic partners/full-task/revision/lastSyncAt writes, serialized lower-revision rejection across tabs, no fragment promotion, auth-generation races and open/read/write/quota/delete failures that block unsafe restoration.
- [X] T033 [P] [US3] Add persistent-profile offline browser tests in tests/browser/offline.spec.ts for service-worker activation plus completed persistence before reopen, all tasks including completed, no queued writes, last verified sync time, first-use shell-only/no-snapshot and evicted-storage cases, reconnect refresh and deadline preservation when US2 is present.
- [X] T034 [P] [US3] Add browser isolation/failure tests in tests/browser/cache-isolation.spec.ts for delayed request/write after account switch, cross-tab sign-out and 401/403 cleanup, outsider/no persisted session, failed deletion suppressing restore and online availability under storage failures; inspect Cache Storage to prove API/auth data never enter public caches.

### Implementation for User Story 3

- [X] T035 [P] [US3] Configure installable public-shell PWA caching in vite.config.ts, public/manifest.webmanifest and public/icons/; supply appropriate icons, precache shell assets only, exclude /api and auth from runtime caching/navigation fallback, and preserve network-only API behavior with no background save queue.
- [X] T036 [P] [US3] Implement complete snapshot persistence in src/client/snapshot-store.ts; key by Firebase project/UID/schema version, atomically store partners/full tasks/revision/lastSyncAt/schemaVersion, serialize writes with transaction-level lower-revision rejection across tabs, feature-detect storage, expose read/write/quota/cleanup errors and request persistent storage opportunistically without promising durability.
- [X] T037 [US3] Implement cross-tab private-state invalidation in src/client/session-invalidation.ts and src/client/auth.ts after T036; cancel requests on UID/generation changes, clear memory/cache on sign-out/account switch/401/403, prevent pending writes from resurrecting data and suppress restoration until failed cleanup succeeds when its pending marker can be recorded; document the accepted all-storage-failed limitation, and persist no tokens/credentials in board storage.
- [X] T038 [US3] Integrate persistence/restore with src/client/sync.ts after T037; restore only matching persisted signed-in previously authorized UID after auth initialization, cache only complete accepted board-plus-partner results, preserve prior cache on either fetch failure, update lastSyncAt only on valid full/304 verification and revalidate complete authoritative state on reconnect.
- [X] T039 [US3] Integrate offline and storage states in src/client/App.tsx and src/client/Board.tsx after T038; show Spanish stale/last-sync/no-snapshot/storage-unavailable/cleanup-failed content, disable create/edit/save offline, retain online viewing on storage failure and preserve stale data on network/5xx/key-service failures while purging on definitive authorization rejection.
- [X] T040 [US3] Run built-Worker offline/isolation tests across configured browsers and record results in specs/001-shared-task-board/validation.md; manually verify Android Chrome and iPhone Safari/Home Screen behavior when devices are available and explicitly record unavailable device checks rather than claim them passed.

**Checkpoint**: All previously loaded tasks remain viewable for the matching authorized session, no offline edits are queued, failures are visible and reconnect restores authoritative state.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate complete feature and operating constraints without deploying or creating real accounts.

- [ ] T041 [P] Audit Spanish/mobile/accessibility flows against contracts/ui.md and record evidence in specs/001-shared-task-board/accessibility.md; review sign-in/onboarding, validation, save/sync/offline/storage errors, keyboard focus/escape/return, screen-reader labels/states/live regions, contrast, 44px targets, 320px width and 200% zoom; fix owning UI files and rerun affected checks.
- [X] T042 [P] Add local capacity measurement helper in scripts/measure-capacity.ts and document observations in specs/001-shared-task-board/capacity.md; use 1,000 tasks/100 saves per day as planning envelope, measure D1 read/write metadata for unchanged/changed polls and index writes plus verifier/serialization CPU, compare against documented free-tier assumptions and distinguish local estimates from production measurements.
- [X] T043 [P] Update README.md and specs/001-shared-task-board/quickstart.md to match implemented scripts, fixtures, ports, pinned dependencies, build/PWA serving, production provisioning/trust configuration, revision-preserving partner updates, privacy-safe logging, storage limitations and quota failure behavior; document controlled signed-token smoke-test procedure without deploying or creating production identities.
- [ ] T044 Execute clean local quickstart and all typecheck/unit/integration/build/browser checks, reconcile FR-001–009 and SC-001–005 evidence in specs/001-shared-task-board/validation.md, repeat both partner timing checks and list remaining manual/production-only verification explicitly; accept feature only when applicable local criteria pass and remaining release checks are visible.

## Dependencies & Execution Order

```text
T001 → T002–T005 (parallel setup files)
Setup → T006 → T007/T008/T009 (parallel foundation files)
T007 + T008 + T009 → T010 → T011 → T012 → Foundation ready
Foundation → US1 tests T013–T017 → T018 → T019
T019 → T020 → T021; T022 may run alongside T020/T021
T021 + T022 → T023 → T024 → Connected MVP
Connected MVP → US2: T025–T027 → T028 → T029 → T030 → T031
Connected MVP → US3: T032–T034 → T035/T036 → T037 → T038 → T039 → T040
US2 + US3 → T041/T042/T043 → T044
```

- US1 has no dependency on later stories. US2 and US3 both extend the working US1 board and are independently testable on that baseline; neither requires the other's completion.
- Default execution is sequential priority order US1 → US2 → US3. If implemented concurrently, serialize edits to App.tsx, Board.tsx, auth.ts, sync.ts, vite.config.ts and validation.md; do not interpret story independence as conflict-free file ownership.
- Tests in a story are authored before its implementation. Resolve failures before its checkpoint. A test may initially fail because its target module does not exist; refine it to exercise the specified behavior once wired.
- Foundation T006 supplies deadline wire validation; US1 uses null/preserved deadlines; US2 adds time conversion and controls without changing the API. US3 persists whole task records without depending on deadline controls.
- Shared migrations and authorization are foundational prerequisites; UI/service code belongs to the earliest story that needs it. No separate feature branch, deployment or real account creation is part of executing this list by default.

## Parallel Execution Examples

### User Story 1

After foundation, write T013 validation tests, T014 verifier/access tests, T015 D1 contract tests, T016 coordinator tests and T017 browser tests concurrently in their separate files. After T019, T020 transport work and T022 board/form work can proceed together; T021 waits for transport, and integration T023 waits for both paths.

### User Story 2

After the connected MVP, write T025 conversion, T026 API deadline and T027 browser deadline tests concurrently. Conversion T028 precedes form integration T029 and display integration T030; avoid simultaneous edits to the shared form/board files from another story.

### User Story 3

After the connected MVP, write T032 store, T033 offline and T034 isolation tests concurrently. After tests, T035 shell/PWA configuration and T036 snapshot storage can proceed together because they use different files. Invalidation, sync and final UI integration follow their stated dependencies; offline browser execution waits for both shell and store paths.

## Implementation Strategy

1. Complete setup and foundation, including real local D1 migrations, demo fixtures and separate signed-token/emulator trust tests.
2. Deliver and independently validate US1 as the connected MVP. Offline persistence and deadline controls remain incomplete at this milestone; do not claim full feature acceptance.
3. Add and validate US2, then US3 by default. Preserve earlier acceptance scenarios at every increment.
4. Complete cross-cutting Spanish/accessibility/capacity/docs work and run the entire quickstart against built Worker assets so PWA behavior is exercised.
5. Keep validation evidence honest: application checks are future tasks, not results of generating this document. Real deployment, production accounts and unavailable physical-device checks require their own execution context.

## Coverage & Completion Accounting

| Requirement / outcome | Primary tasks |
|---|---|
| FR-001, SC-004 privacy and two accounts | T008–T012, T014, T019, T034, T037 |
| FR-002–004, SC-001 equal task management | T006–T007, T013, T015, T017–T019, T022–T024 |
| FR-005, SC-002 authoritative synchronization | T015–T016, T018–T021, T023–T024 |
| FR-006, SC-003 offline and failure visibility | T032–T040 |
| FR-007 deadlines | T006–T007, T025–T031 |
| FR-008–009, SC-005 Spanish/mobile/accessibility | T009, T012, T017, T022–T023, T027–T031, T039, T041, T044 |
| Free-tier operation and reproducibility | T001–T005, T011, T042–T044 |

**Counts**: 44 tasks: setup 5, foundation 7, US1 12, US2 7, US3 9, polish 4. There are 25 `[P]` tasks, subject to their phase/prerequisite gates. Every user-story task carries its corresponding story label; infrastructure and polish tasks do not.
