# Task notifications validation

## Phase 3 — saved task changes

- The D1 integration suite passed 37 tests on 2026-11-15. Notification fixtures cover both creation recipients, mixed completion payloads, unchanged and rejected saves, serialized concurrent replacements, rollback, device snapshots, late registration, successful fake-transport submission, and transport rejection without save failure. Existing integration tests also cover revision behavior and consistent snapshot reads.
- Targeted unit tests passed 18 tests across notification event classification, synchronization, and offline snapshot storage. Classification exercises both actors, creation, title, assignment, status and deadline edits, unchanged saves, and mixed completion. The sync and snapshot tests exercise stale-response protection and offline storage; they are not a real-device push test.
- Typecheck and the demo build passed. The build reports an existing large-chunk warning. Lint restricted to changed TypeScript files passed.
- The full unit suite did not pass: 17 tests in `make-serve.test.ts` and `make-test.test.ts` failed because an existing process occupied port 9099 (133 other tests passed). The existing process was left running. Repository-wide lint reported errors in pre-existing notification foundation files; changed TypeScript files passed separately.
- Browser tests and real push delivery were not run for this phase. Existing local services occupy ports 8787 and 9099; their state was not changed. Registration controls and the service-worker push handler remain Phase 5 work. Device receipt, deployed CPU limits, and free-tier viability remain unverified.
