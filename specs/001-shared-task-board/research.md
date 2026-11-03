# Research: Shared Task Board

**Date**: 2026-11-02. These decisions resolve the Phase 1 design; deployment identifiers and exact dependency patches are environment configuration, not open product questions.

## Authentication and equal authorization

**Decision**: Firebase browser email/password sign-in with persisted auth state; privately provision two accounts. Worker verifies production ID tokens with a Workers-compatible JOSE library, then checks an indexed, enabled D1 partner UID on every API request. No roles or ownership restrictions. No public management endpoint or sign-up UI. Firebase identity alone does not grant board access.

**Rationale**: Verify RS256 signature against Google's trusted securetoken certificate selected by `kid`; validate `exp`, `iat`, `auth_time`, nonempty `sub`, exact project `aud` and issuer. Cache trusted certificates for their advertised lifetime. Fail closed if trusted verification cannot complete. Disabling a D1 partner removes API access immediately; token signature verification alone does not implement Firebase session revocation. [Firebase token requirements](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [session management](https://firebase.google.com/docs/auth/admin/manage-sessions).

**Alternatives considered**: Decode-only JWT handling is insecure; client-only allowlists cannot protect APIs; a separate authentication server adds unnecessary operations. Do not port the Node Admin SDK into the Worker.

**Development decision**: Auth Emulator uses one `demo-shared-task-board` project and explicit local/test-only unsigned-token acceptance, never a request-selected bypass. Production startup/configuration rejects emulator mode and production tests reject unsigned tokens. [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth). Non-phone authentication suits two users on Spark; no SMS or paid plan required for expected use. [Firebase pricing](https://firebase.google.com/pricing), [auth limits](https://firebase.google.com/docs/auth/limits).

## Hosting and routing

**Decision**: Vite builds the React SPA. One Worker serves assets and API; configure selective `assets.run_worker_first` for `/api` and `/api/*`, `assets.not_found_handling` as `single-page-application`. Worker terminates every API route with an API response. Private data is absent from HTML/assets.

**Rationale**: API routes must never turn into successful SPA HTML, including unknown endpoints. [Cloudflare Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

**Alternatives considered**: Separate frontend/API deployments add origin/CORS management; relying solely on SPA fallback obscures API failures.

## Atomic saves and snapshots

**Decision**: Direct primary D1 binding calls, no replicas. Use `batch()` transactions for a task mutation, conditional singleton revision increment, and saved-row/revision readback. Guard mutation and assignee validation against current enabled partner records inside the operation. A missing task causes no revision change. Full snapshot uses a read batch; never label task rows with a revision fetched independently.

**Rationale**: Batch rollback keeps task and revision changes atomic. D1 commit order, rather than request start time, timestamps, or response arrival, defines the winning save. [D1 batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/). Without Sessions API, queries continue to use the primary; this avoids replica lag and bookmark complexity. [D1 replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

**Alternatives considered**: Timestamp-only ordering can tie or reflect clock skew; independent writes permit inconsistent revisions; optimistic conflict rejection would contradict last-save-wins behavior.

## Polling and capacity

**Decision**: Poll visible boards every 15 seconds, immediate refresh after save/reconnect/focus/manual action, one in-flight refresh with coalesced pending triggers. A 10-second timeout surfaces stalls. On hidden/offline state, pause scheduled polls. On conditional equality, return 304 after authorization and revision lookup; otherwise return a complete consistent board with ETag.

**Rationale**: For two always-visible clients, 2 × 86,400 / 15 = 11,520 scheduled requests/day. Reading only revision on unchanged polls avoids scanning the board. Free-tier D1 includes 5 million row reads/day, 100,000 row writes/day and 5 GB storage; count scans and index maintenance, not just returned rows. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Workers Free's 100,000 requests/day and 10 ms CPU budget require measuring verifier cost. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

**Alternatives considered**: WebSockets/Durable Objects add infrastructure for two clients; scanning every task on every poll can exceed free reads. Quotas remain availability constraints, not guarantees.

## Offline viewing and privacy

**Decision**: `vite-plugin-pwa` precaches public shell assets only. API fetches are network-only and excluded from navigation fallback. Persist one complete successful board plus partners, revision, schema version, UID and last verified sync time atomically in IndexedDB. Never cache a mutation fragment as a complete board.

**Rationale**: Shell caching supports reopen while explicit IndexedDB storage makes account scoping and stale state inspectable. [Vite PWA guide](https://vite-pwa-org.netlify.app/guide/). Browser storage may be unavailable, cleared or evicted; catch read/write/cleanup errors and display storage failure. Request persistent storage opportunistically; refusal does not imply offline durability. [Browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Restore only after Firebase auth initialization identifies the same persisted UID previously authorized online. Offline expiry alone need not erase the authorized viewing snapshot; it never permits API access. Sign-out, account switch and definitive 401/403 invalidate in-memory state, outstanding requests and private storage. Coordinate this across tabs. If cleanup fails, block cache restoration until cleanup succeeds. A server-side access removal cannot retract a disconnected local copy until connectivity returns; disclose stale state.

**Alternatives considered**: HTTP/service-worker API caches risk leaking across accounts; localStorage is synchronous and poorly suited to full snapshots; queued offline writes are excluded by the spec.

## Deadlines

**Decision**: Persist UTC instants, convert at entry/display using the device's current IANA zone. Use Temporal via its polyfill on browsers lacking it. Compare earlier/later zoned resolutions with the requested local fields: reject gaps where neither matches; choose earlier for folds where both match, exposing its offset. Render in Spanish with IANA zone and deadline-specific UTC offset, not today's offset.

**Rationale**: A local date/time control contains no zone. Explicit gap/fold handling prevents silent deadline changes. [Temporal disambiguation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/from).

**Alternatives considered**: Saving wall-clock strings makes device zones disagree; native Date normalization silently shifts nonexistent times. No account-level zone setting or recurrence is needed.

## Validation

**Decision**: Vitest unit tests plus local Worker/D1 integration through `@cloudflare/vitest-plugin`, `cloudflareTest()` and Vitest 4.1+. Load real migrations with `readD1Migrations`/`applyD1Migrations`; disable remote bindings. Use Playwright for real browser contexts, mobile, offline reopen and zone scenarios, plus manual keyboard/screen-reader review.

**Rationale**: Current Cloudflare tooling runs tests in the Worker runtime. [Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/), [current setup requirements](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/). Browser emulation supports mobile and zones. [Playwright emulation](https://playwright.dev/docs/emulation).

**Alternatives considered**: Node-only mocks do not validate Worker/D1 behavior; emulator-only tests cannot prove production signature validation. Test signed fixtures with controlled keys and separate trust-source fixtures; never deploy fixture keys or bypasses.
