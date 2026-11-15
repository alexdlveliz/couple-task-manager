# Tasks: Task Notifications

**Input**: Design artifacts in `specs/006-task-notifications/`.
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notifications.md, quickstart.md.
**Tests**: Included because the specification explicitly requires controlled recipient, eligibility, permission, authorization, and failure tests.
**Format**: `- [ ] Tnnn [P] [USn] Description with path`. [P] indicates independent files and work after stated prerequisites.

## Phase 1: Setup

- [X] T001 Inspect task mutation callers, authentication transitions, existing tests, PWA registration and migration setup; record integration points in specs/006-task-notifications/research.md before changing functions.
- [X] T002 [P] Add development-only VAPID generation helper in scripts/generate-vapid.ts and usage in scripts/README.md; never persist private keys in tracked files or logs.
- [X] T003 Add optional notification configuration to src/worker/env.ts and example environment files, keeping board operation available when notification credentials are absent or invalid.

## Phase 2: Foundation

**Goal**: Shared persistence and delivery primitives available before story integration.

- [X] T004 Add migration coverage in tests/integration/notification-schema.test.ts for upgrades preserving tasks/revisions and uniqueness constraints from specs/006-task-notifications/data-model.md.
- [X] T005 Add migrations/0003_task_notifications.sql with registrations, events, deliveries, current-cycle deduplication and indexed deadline metadata; enforce “HTTPS push endpoint (unique)”, “optional expiration”, “Unique event/registration pair”, unique mutation `(task, revision, type, recipient)` and overdue `(task, cycle, overdue, recipient)` identities.
- [X] T006 [P] Define payload, registration, sanitized outcomes and delivery states in src/shared/notifications.ts; implement “pending → leased → accepted; transient failure → pending; permanent invalid endpoint → abandoned” and retryable expired leases.
- [X] T007 Add transport tests in tests/unit/web-push.test.ts for RFC encryption vectors, VAPID claims, malformed keys, payload bounds, provider allowlist, redirect rejection and HTTP outcome classification.
- [X] T008 Implement RFC 8291 encryption and RFC 8292 VAPID transport in src/worker/web-push.ts with Web Crypto; enforce plaintext below 3,993 bytes, HTTPS approved-provider endpoints without credentials/fragments, bounded requests and no redirects.
- [ ] T009 Add delivery concurrency and recovery tests in tests/integration/notification-delivery.test.ts for leases, crash-after-acceptance ambiguity, invalid endpoints, independent devices, 429/Retry-After, transient errors and expiry.
- [ ] T010 Implement delivery persistence and dispatcher in src/worker/notification-delivery.ts with unique event/device expansion, atomic lease claims, expired-lease recovery, bounded concurrency, 24-hour retry ceiling, sanitized failures and invalid-registration cleanup; snapshot eligible devices at event creation so late enablement never replays history.
- [ ] T011 Implement seven-day operational cleanup in src/worker/notification-maintenance.ts without removing current-cycle overdue deduplication; cover cleanup in tests/integration/notification-retention.test.ts.

**Checkpoint**: Protocol and persistence primitives pass; real delivery still needs device registration and service-worker integration.

## Phase 3: US1 — Saved task changes (P1)

**Goal**: Creation/completion notify both; other covered edits notify only the other partner.
**Independent test**: With fixture registrations and fake transport, save each change as each partner and inspect Spanish payloads and exact recipient sets, independently of overdue scheduling.

- [ ] T012 [P] [US1] Add recipient and mixed-edit payload tests in tests/unit/task-notification-events.test.ts for creation, completion, other state/title/assignment/deadline edits, failed and unchanged saves.
- [ ] T013 [P] [US1] Add atomicity/concurrency and revision regression tests in tests/integration/task-notifications.test.ts, including simultaneous replacements and failed mutation guards.
- [ ] T014 [US1] Implement Spanish event classification and recipient-specific mixed-completion summaries in src/worker/task-notification-events.ts; actor sees completion only, other partner sees completion and additional covered changes without duplicate completion notices.
- [ ] T015 [US1] Extend guarded persistence in src/worker/tasks.ts to capture old/new values and notification intent atomically, avoiding separate pre-reads; preserve response shapes, revision behavior and unchanged-save semantics while generating no unchanged event.
- [ ] T016 [US1] Integrate bounded post-save dispatch via execution context in src/worker/index.ts and src/worker/local.ts; persist intent before dispatch and ensure transport rejection never changes successful save responses.
- [ ] T017 [US1] Validate US1 fixture scenarios and record results in specs/006-task-notifications/validation.md, including offline snapshot and synchronization regression checks.

## Phase 4: US2 — Overdue tasks (P1)

**Goal**: Every incomplete deadline task yields one logical overdue event per partner per cycle.
**Independent test**: Controlled-clock fixtures produce exact eligible events with no optional reminders and no dependency on change-event generation.

- [ ] T018 [P] [US2] Add deadline-cycle transition tests in tests/unit/deadline-cycle.test.ts for first deadline, changed future deadline, removal, unrelated edits, completion and reopening.
- [ ] T019 [P] [US2] Add scheduler integration tests in tests/integration/overdue-notifications.test.ts for past deadlines, completed/no-deadline tasks, concurrent/repeated runs, rescheduling, reopening, deletion, outage recovery and stale pending cancellation.
- [ ] T020 [US2] Implement cycle management in src/worker/deadline-cycle.ts and integrate it atomically into src/worker/tasks.ts; preserve cycles on unrelated edits/reopening and cancel pending overdue deliveries after completion, deletion or deadline replacement.
- [ ] T021 [US2] Implement indexed, bounded overdue processing in src/worker/notification-scheduler.ts with guarded current-state eligibility and unique per-partner cycle records; process already-past deadlines on the next check and retain deduplication through cleanup.
- [ ] T022 [US2] Add scheduled handler in src/worker/index.ts and minute cron configuration in wrangler.jsonc for applicable environments; run overdue generation, shared retry dispatch and bounded maintenance with injectable clocks for tests.
- [ ] T023 [US2] Record controlled timing and backlog checks in specs/006-task-notifications/validation.md, proving approximately one-minute submission under the tested normal load and distinguishing event generation from device receipt.

## Phase 5: US3 — Enablement and availability (P2)

**Goal**: Each partner enables each supported device and understands permission/availability limitations.
**Independent test**: Exercise registration endpoints and browser permission states with both accounts and multiple devices, without task mutations being required for setup.

- [ ] T024 [P] [US3] Add API contract tests in tests/integration/notification-subscriptions.test.ts for all four routes, bearer/partner authorization, foreign ownership, no-store, 8 KiB body limit, key/expiry validation and cross-account 409 conflicts.
- [ ] T025 [P] [US3] Add browser tests in tests/browser/notifications.spec.ts for explicit permission actions, denied/unsupported/iPhone guidance, service problems, multiple devices, keyboard access and failed logout/account-switch deregistration.
- [ ] T026 [US3] Implement registration/config/status/removal persistence in src/worker/notification-subscriptions.ts; return only caller-owned status, never silently transfer endpoints, and cancel pending deliveries when disabling registrations.
- [ ] T027 [US3] Wire GET config, POST subscriptions, GET subscription status and DELETE subscription routes into src/worker/index.ts per specs/006-task-notifications/contracts/notifications.md, preserving existing error envelopes and task API behavior.
- [ ] T028 [US3] Add authenticated notification API methods and UID/device binding lifecycle in src/client/notifications.ts and src/client/api.ts; distinguish browser permission from registration and prevent failed cleanup from reusing another account's association.
- [ ] T029 [US3] Implement logout/account-switch/session-invalidation cleanup in src/client/auth.ts and src/client/session-invalidation.ts after inspecting callers; clear local binding and unsubscribe locally when authenticated server removal is unavailable.
- [ ] T030 [US3] Implement custom worker in src/client/service-worker.ts and switch vite.config.ts to injectManifest, adding required direct dependencies in package.json if needed; preserve existing precache/navigation exclusions and no API runtime caching, display Spanish pushes with event tags and restrict click URLs to same origin.
- [ ] T031 [US3] Add Spanish notification controls in src/client/NotificationSettings.tsx, integrate in src/client/Board.tsx and style in src/client/styles.css; include explicit enablement, status, denied settings guidance, iPhone installation guidance and known problems with accessible status announcements.
- [ ] T032 [US3] Validate permission, status, account transition and service-worker update scenarios and record results in specs/006-task-notifications/validation.md; mocked browser checks must be labeled separately from real push delivery.

## Phase 6: Polish and cross-cutting validation

- [ ] T033 [P] Update README.md and scripts/README.md with VAPID configuration, local fake-transport setup, migration/cron operations, HTTPS deployment prerequisites, device guidance and failure recovery.
- [ ] T034 Run typecheck, unit/integration tests, build and browser suite with README prerequisites; record only actual results and outstanding checks in specs/006-task-notifications/validation.md.
- [ ] T035 Perform HTTPS development deployment checks on supported desktop/Android browsers and an installed iPhone PWA per specs/006-task-notifications/quickstart.md; record creation/completion/overdue delivery, clicks, closed-app behavior and multiple-device outcomes in specs/006-task-notifications/validation.md.
- [ ] T036 Measure deployed Worker CPU and D1 usage for mutation capture, idle cron, overdue generation and maximum crypto dispatch batch; tune bounds in src/worker/notification-delivery.ts and src/worker/notification-scheduler.ts and record evidence in specs/006-task-notifications/validation.md; report a free-tier gate failure if limits cannot be met.
- [ ] T037 Review Spanish accessibility, restricted registration access, sensitive logging, migration upgrades, offline snapshots and API cache exclusions against specs/006-task-notifications/quickstart.md; resolve regressions and document remaining limitations in specs/006-task-notifications/validation.md.

## Dependencies and execution order

Setup → Foundation → US1 → US2 → US3 → cross-cutting acceptance is the recommended sequence. US2 and US3 may begin after Foundation using fixtures, but their edits to src/worker/index.ts and src/worker/tasks.ts must be serialized with earlier changes. US1 and US2 are independently testable using fixture subscriptions and a fake transport; complete user-visible delivery depends on US3. No story is production-ready solely because event tests pass.

Within phases, tests precede their implementation. T005 follows T004; T008 follows T007; T010 follows T005–T009; T011 follows T010. T014–T016 follow T012–T013. T020–T022 follow T018–T019. T026–T031 follow the relevant contract/browser tests and shared primitives. Final real-device and CPU checks require an authorized development deployment and credentials; record blocked evidence rather than claiming success.

## Parallel examples

- US1: T012 and T013 can run together after Foundation; their files are independent.
- US2: T018 and T019 can run together before cycle/scheduler implementation.
- US3: T024 and T025 can run together; API and browser contracts use different test files.
- T033 documentation can run while acceptance results are collected, with final commands checked against the implementation.

[P] identifies opportunities, not authorization to delegate or make simultaneous edits to shared files.

## Implementation strategy

Deliver Foundation plus US1 first as a backend MVP with deterministic fixture validation. Add US2 for deadline coverage, then US3 for actual per-device use. The smallest usable partner-facing release requires all three stories; do not expose unfinished enablement as working delivery. Validate each checkpoint before broadening scope. Keep recurring reminders and history outside this feature.

Present logical diffs for user review before incremental Conventional Commits, staging specific paths only. Do not commit without review, push, or create a PR without the user's required authorization. Task completion marks implementation evidence, not a promise of notification receipt.
