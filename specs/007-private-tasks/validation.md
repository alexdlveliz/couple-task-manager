# Private Tasks Validation

## Baseline before implementation

`make test` ran against the local Firebase demo emulator and D1 fixtures. Typecheck, unit tests, integration tests, and build passed. The browser suite failed, so the overall workflow exited with code 2. A Chromium offline test trace records a timeout waiting for the disabled drag button in `tests/browser/offline.spec.ts:75`. Playwright also saved a Firefox failure artifact for the same scenario. The workflow suppresses individual browser results, so the complete failure count is unavailable.

## Phase 6 local validation

On 2026-11-23, the complete `make test` workflow passed typecheck, unit tests, integration tests, and build, then failed in the browser suite. The run recorded WebKit failures in Kanban dragging, cross-tab sign-out, failed-cache-cleanup recovery, and private account switching. A mobile Safari cross-tab authorization scenario also failed. The workflow suppresses individual browser output; these are the failure artifacts observed during the run rather than a complete failure count.

A standalone Chromium run of `private-account-switch.spec.ts` passed. The same scenario failed independently in WebKit while waiting for the sign-in form after sign-out. A diagnostic of WebKit service-worker registration did not return before it was interrupted. The browser results therefore do not establish private offline account switching on WebKit or mobile Safari. Manual screen-reader checks and deployed two-account smoke checks also remain pending.

The browser fixtures for weak ETags, grouped tasks, and delayed private responses were updated to include the required visibility field. Rollout and rollback guidance now identifies both migrations and requires a privacy-aware Worker after private rows exist. No remote migration, deployment, or production verification was performed.

## Browser follow-up

WebKit sign-out stalled in `PushManager.getSubscription()` when notification permission had not been granted and no account binding existed. Cleanup now skips that lookup in this state and bounds subscription cleanup when it is needed. A simulated stalled lookup, private account switching, and the cache-isolation scenarios passed in targeted WebKit and mobile Safari runs (9 tests per project). The targeted WebKit Kanban drag and shared-task deletion scenarios also passed. Multi-step browser tests received longer time limits after traces showed slow actions against a large local fixture board.

The latest completed `make test` run passed typecheck, unit tests, integration tests, and build, but failed on the WebKit cache-cleanup recovery scenario after it stalled during a reload. The recovery test was subsequently changed to reopen the app in the same browser context, and its targeted WebKit rerun passed. A later full workflow was interrupted at the user's request in favor of the targeted check, so the final changes do not have a clean full-suite result. Manual screen-reader verification and deployed two-account smoke checks remain pending.
