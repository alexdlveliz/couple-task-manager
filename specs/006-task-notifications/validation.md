# Task notifications validation

## Phase 3 — saved task changes

- The D1 integration suite passed 37 tests on 2026-11-15. Notification fixtures cover both creation recipients, mixed completion payloads, unchanged and rejected saves, serialized concurrent replacements, rollback, device snapshots, late registration, successful fake-transport submission, and transport rejection without save failure. Existing integration tests also cover revision behavior and consistent snapshot reads.
- Targeted unit tests passed 18 tests across notification event classification, synchronization, and offline snapshot storage. Classification exercises both actors, creation, title, assignment, status and deadline edits, unchanged saves, and mixed completion. The sync and snapshot tests exercise stale-response protection and offline storage; they are not a real-device push test.
- Typecheck and the demo build passed. The build reports an existing large-chunk warning. Lint restricted to changed TypeScript files passed.
- The full unit suite did not pass: 17 tests in `make-serve.test.ts` and `make-test.test.ts` failed because an existing process occupied port 9099 (133 other tests passed). The existing process was left running. Repository-wide lint reported errors in pre-existing notification foundation files; changed TypeScript files passed separately.
- Browser tests and real push delivery were not run for this phase. Existing local services occupy ports 8787 and 9099; their state was not changed. Registration controls and the service-worker push handler remain Phase 5 work. Device receipt, deployed CPU limits, and free-tier viability remain unverified.

## Phase 4 — overdue tasks

- Controlled D1 tests cover first deadlines, unrelated edits, completion and reopening, removal and re-addition, past rescheduling, concurrent and repeated checks, completed and undated tasks, cancellation, deletion, bounded backlog and recovery after missing notification configuration. Six focused integration tests passed on 2026-11-15.
- With one eligible task and two registered devices, a scheduled check at a controlled instant 30 seconds after the deadline submitted both deliveries to a fake accepting transport. A one-task batch limit processed two overdue tasks across two checks. These are controlled generation and submission checks, not evidence of provider or device receipt, production latency, large-backlog throughput, or deployed CPU limits.
- The full integration suite passed 43 tests, including all six focused overdue tests. Typecheck, demo build, and lint for changed TypeScript files passed. The build emitted the existing large-chunk warning.
- The full unit suite had 139 passing tests and 17 failures in make-serve.test.ts and make-test.test.ts because port 9099 was already occupied. The existing listener was left untouched. Real browser delivery, deployment and free-tier CPU validation remain outstanding.

## Phase 5 — enablement and availability (partial)

- Subscription integration tests exercise authenticated access, partner ownership and conflicts, independent registrations, cancellation, request size, invalid provider endpoints, keys and expiry. The full integration suite passed 46 tests before the final additional contract case; the expanded subscription file passed four tests afterward.
- The demo build and TypeScript check passed; the build reports a large-chunk warning. Four mocked Chromium notification scenarios passed: explicit keyboard permission action, unavailable service, unsupported guidance, and failed removal followed by an account switch. These mocks do not demonstrate real push delivery.
- After applying the local notification migration and restoring local auth fixtures, 14 of 15 Chromium notification, cache-isolation and offline checks passed. The remaining offline check restored the board but expected an `Arrastrar tarea` button absent from the current implementation. Before the migration, saves returned 503 because the local database lacked notification tables.
- T025 and T032 remain open: browser coverage still needs broader multi-device, service-worker update and notification-click scenarios, plus real supported-device checks. Real push delivery, deployed latency and free-tier CPU use remain unverified.
