# Quickstart and Acceptance Validation

This is a Phase 1 run guide for the future implementation. This repository currently contains design artifacts; the package scripts, configurations, migrations, seed helper and tests described here must be supplied during implementation. These commands are the intended interface, not a claim that application commands run today.

## Prerequisites and configuration

Use Node.js 22.12+ and pnpm, Java supported by the installed Firebase Emulator release, Firebase CLI via a pinned `firebase-tools` development dependency, Wrangler, and Playwright browser dependencies. Keep exact dependency versions in the future lockfile. Use the same local demo project ID everywhere: `demo-shared-task-board`. No production credentials or deployment are needed for local acceptance.

Implementation must provide `firebase.json` with Auth on `127.0.0.1:9099` and Emulator UI on port 4000; `wrangler.jsonc` with `DB` binding, local database name `shared-task-board`, migrations directory `migrations`, assets directory `dist`, API-first routing, and separate local/production auth configuration. Vite dev runs port 5173 and proxies `/api` to Wrangler on 8787. Production acceptance runs the built shell served by Wrangler on 8787 so the service worker is tested.

| Configuration | Local value or meaning |
|---------------|------------------------|
| `VITE_FIREBASE_PROJECT_ID` | `demo-shared-task-board` |
| `VITE_FIREBASE_API_KEY` | Emulator-only placeholder |
| `VITE_FIREBASE_AUTH_DOMAIN` | Matching Firebase project auth domain; not a secret |
| `VITE_USE_AUTH_EMULATOR` | `true` locally; absent/false in production builds |
| `FIREBASE_PROJECT_ID` | Same project ID in Worker verification |
| `AUTH_MODE` | `emulator` only in explicit local/test configuration; `production` deployed |
| `FIREBASE_AUTH_EMULATOR_HOST` | `127.0.0.1:9099`, local tools only |
| `DB` | D1 binding; no remote bindings in automated tests |

Connect Firebase browser auth explicitly to `http://127.0.0.1:9099` before sign-in. Keep local `.env.local` and `.dev.vars` ignored by git. Production Worker must fail startup/config validation if emulator mode/host is set; production client build must not connect to the emulator. [Official emulator setup](https://firebase.google.com/docs/emulator-suite/connect_auth).

## Intended development commands

From the repository root after implementation:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install
pnpm exec firebase emulators:start --only auth --project demo-shared-task-board
```

In another terminal, migrate local D1 and populate local fixtures:

```bash
pnpm exec wrangler d1 migrations apply shared-task-board --local
pnpm run seed:local
pnpm run dev
```

`seed:local` must refuse non-demo projects and remote D1; create or reuse two emulator accounts (`partner-a@example.test`, `partner-b@example.test`) and one unauthorized account (`outsider@example.test`) with documented local-only passwords. Obtain actual emulator UIDs and seed only the first two into D1 slots 1 and 2; initialize metadata revision 0 only on an empty database. Never reset revision during idempotent reseeding. The helper prints only fixture identities and local login instructions, no real credentials. `dev` starts Vite and local Wrangler; confirm 5173 → 8787 proxy before tests. [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/).

## Intended checks and PWA serving

```bash
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration
pnpm run build
pnpm run preview:worker
```

`preview:worker` serves the built assets and Worker with local D1 on 8787; stop dev's Wrangler first to avoid port collision. Configure Playwright base URL `http://127.0.0.1:8787`. Emulator must stay running. Then:

```bash
pnpm run test:browser
```

Integration uses Vitest 4.1+ and `@cloudflare/vitest-plugin` with `cloudflareTest()`, real D1 migrations applied to isolated test storage, and remote bindings disabled. Verifier tests use controlled signed-token fixtures and trusted key-fetch mocks; unsigned emulator fixtures are confined to a separate local suite. [Current Workers test setup](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/).

## Reproducible acceptance scenarios

| Scenario | Steps and expected result |
|----------|---------------------------|
| Equal access (FR-001–004, SC-001/002) | Open isolated browser contexts A/B with authorized accounts. A creates “Comprar alimentos”, assigns B; B edits title, reassigns A, visits every state and completes. Repeat with roles reversed. No ownership restrictions; new status is Por hacer. Both see each save after successful refresh. Time create/assign/complete separately for each partner: under two minutes without help. |
| Validation | Submit blank/whitespace title, missing/outsider assignee, bad status, unknown fields and incomplete PUT directly and through available UI. Expect 400 Spanish errors, unchanged tasks/revision. POST status override rejected. Deadline null/omitted valid; past deadline valid. Missing task PUT returns 404 without revision increment. |
| Access control (SC-004) | For every endpoint, try no bearer, forged signature, expired, wrong audience/project, wrong issuer, missing required claims, unsigned token and valid outsider token. Expect 401 or 403 and no data/revision changes. Disable an authorized D1 UID and repeat conditional GET with matching ETag: access denied before 304. Production-mode tests reject emulator tokens and emulator configuration. |
| Atomic concurrency | Hold A/B PUT responses and commit A then B to the same task. GET returns B's full values and two ordered revision increments. Deliver A's response late: no rollback. Force a batch statement failure: no partial task/revision commit. Verify missing ID does not increment. |
| Snapshot race | Delay a GET, commit changes to different tasks, deliver mutation result before old GET. Client discards stale snapshot, fetches with last complete snapshot ETag and sees both changes. A fragment never upgrades snapshotRevision. Race preliminary revision lookup with a mutation: returned full board matches its own revision. |
| Polling/conditional reads | Two visible contexts: refresh at 15-second intervals without overlap. Hide one: scheduled requests stop. Focus, reconnect, save and manual refresh trigger immediate coalesced refreshes. Unchanged GET returns 304 and does not scan task rows; changed GET is full 200 with matching ETag/revision. Stall a fetch: visible failure after 10 seconds. |
| Offline reopen (SC-003) | Load full board, wait for service worker activation and IndexedDB transaction completion, set context offline, close/reopen page within the same persistent profile. All tasks remain with stale notice and last-sync time. Saving disabled; no queued requests. Make B save while A offline; reconnect A and verify complete authoritative replacement. |
| First-use/auth/cache isolation | Clear browser storage then load once online only far enough to cache shell, without loading tasks. Reopen offline: Spanish no-snapshot message. A brand-new offline origin may show browser offline screen. Sign out A; B/outsider must never see A cache. Repeat sign-out in another tab and account switch during pending fetch/cache write; no private data reappears. |
| Storage failure | Inject IndexedDB open, quota/write, read and deletion failures. Keep online viewing where authorized, show Spanish persistence warning and never claim offline data saved. Failed cleanup blocks restore. Clear/evict storage then reopen offline: no-snapshot state, no crash. |
| Service/save failures | Inject network failures, 503, quota/non-JSON responses and timeouts while online. Refresh retains stale data and retry control. Failed save preserves draft, shows no success; dropped response after possible commit requires refresh before retry, no automatic POST retry. 401/403 clears private state. |
| Zones (FR-007) | Context A America/Guatemala, B Europe/Madrid. A enters 2026-11-02 09:00; API instant is 2026-11-02T15:00:00Z. B sees 16:00 UTC+01:00 with Europe/Madrid. Remove deadline: null on both. Change device zone: display recalculates without changing stored instant. |
| DST | America/New_York 2027-03-14 02:30 is rejected as nonexistent. 2027-11-07 01:30 resolves to earlier 2027-11-07T05:30:00Z, UTC−04:00, with explanatory text. Test zone change while editor open and unchanged-instant round trips. |
| Spanish/mobile/accessibility (SC-005) | Run mobile and desktop browser projects, keyboard-only create/edit/deadline flows, 320px layout, 200% zoom, 44px targets. Review screen-reader names, focus and announcements manually; inspect all loading/auth/validation/offline/failure messages for Spanish. No task/status is communicated by color alone. |

Production readiness additionally requires administrative creation of exactly two Firebase email/password accounts, UID seeding in D1, production token trust configuration, quota/CPU measurements, and a controlled signed-token smoke test. Do not deploy or create real accounts as part of this design phase. No notification permission, delivery or scheduling checks apply to this independently shippable feature.
