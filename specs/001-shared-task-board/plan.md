# Implementation Plan: Shared Task Board

**Branch**: `main` (retained; no feature branch) | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-shared-task-board/spec.md` and constitution 1.0.0.
**Delivery boundary**: Phase 0 research and Phase 1 design only. No application code or `tasks.md`.

## Summary

Design a private Spanish task board for two equal partners using a React/TypeScript PWA, Vite, one Cloudflare Worker for static assets and authenticated APIs, D1 authoritative storage, and Firebase email/password authentication. Refresh visible boards every 15 seconds; enter and display deadlines in each device's current local time zone. Preserve a complete UID-scoped offline snapshot without offline writes.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.x, Node.js 22.12+ for tooling; ES module Worker with compatibility date pinned during implementation. Pin exact compatible package versions in the future lockfile.
**Primary Dependencies**: Vite, Firebase browser SDK, `vite-plugin-pwa`/Workbox, a Workers-compatible JOSE verifier using Web Crypto, and `@js-temporal/polyfill` for consistent DST handling across browsers. No Firebase Admin SDK dependency in the Worker.
**Storage**: One D1 database, three entities (partners, tasks, singleton board metadata); IndexedDB for one complete authorized snapshot per UID; Cache Storage for public application shell only.
**Testing**: Vitest 4.1+ with current `@cloudflare/vitest-plugin`/`cloudflareTest()` and local D1 migrations; Playwright Chromium, Firefox, and WebKit browser projects. Separate production-verifier and emulator suites.
**Target Platform**: Current desktop and mobile browsers supporting service workers and IndexedDB, including Android Chrome and iPhone Safari/Home Screen PWA. Feature-detect storage; expose inability to persist.
**Project Type**: Single repository web application and Worker API sharing contracts.
**Performance Goals**: Under two minutes per partner for create/assign/complete (SC-001); connected remote changes appear on the next successful 15-second poll or immediate refresh. No overlap between refreshes; no hidden-tab polling; 10-second network timeout makes stalled refreshes visible. Timing targets assume available services, not a delivery SLA.
**Constraints**: Two accounts, equal rights, Spanish UI/errors, complete offline viewing, online saves only, last committed save wins. No deletion, registration UI, extra members, notifications, or scheduling.
**Scale/Scope**: Two continuously visible clients yield 11,520 scheduled polls/day before focus/save/manual requests. Planning envelope: 1,000 tasks and 100 saves/day; this is a capacity assumption, not a task limit.

## Constitution Check

| Principle | Before research | After Phase 1 design and verification evidence to require |
|-----------|-----------------|--------------------------------------------------------|
| I. Equal agency | PASS: both partners may edit any assignment | PASS: identical API authorization; cross-assignee browser scenarios |
| II. Consistency/availability | PASS: server authoritative, offline read only | PASS: atomic revision, complete snapshot, response ordering, reconnect/storage-failure scenarios |
| III. Reminders | N/A for this feature, as specified | N/A: separate 002/003 features; no delivery guarantees introduced |
| IV. Privacy | PASS: separate accounts and Worker enforcement | PASS: signed-token checks plus enabled UID lookup on every request; cache isolation and rejection tests |
| V. Spanish/accessibility | PASS: Spanish mobile flows required | PASS: UI contract covers labels, keyboard, focus, status announcements and touch targets; manual review required |
| VI. Free-tier simplicity | PASS: constitution-mandated stack | PASS: quota model below; one Worker/database; no paid services required under expected load |
| Technology constraints | PASS: React/TypeScript PWA, Workers/D1, Firebase | PASS: no substitution or amendment needed |

Both design gates pass. Runtime evidence will be collected during implementation using [quickstart.md](quickstart.md); this phase does not claim application tests have passed.

## Architecture and consistency

Worker-first routing covers `/api` and `/api/*` before SPA fallback; unknown API routes return JSON 404 and unsupported methods JSON 405. Public shell contains no task data. Every API request verifies authentication and the enabled partner UID before reads, writes, or conditional responses. Do not log credentials, tokens, or task content. API responses use `Cache-Control: no-store`.

D1 binding operations go directly to the primary without Sessions API/read replicas. Use a transactional batch for mutation plus revision increment plus returned saved task/revision. Increment only when one task changes successfully; not-found/validation/authorization failures never increment. Read full board and revision in one read batch. Conditional polling first checks singleton revision; equality returns 304 without task scanning; mismatch loads a new consistent batch and uses that batch's revision.

Maintain separate `snapshotRevision` (complete board) and `highestSeenRevision` (including mutations). A mutation response is not a full snapshot: show confirmed save, raise highest seen, then fetch the complete board immediately. Never advance snapshotRevision by patching just one task. Discard older responses and invalidate outstanding requests on account changes. See [data-model.md](data-model.md) and [API contract](contracts/openapi.yaml).

## Free-tier and performance assumptions

As checked 2026-11-02: Workers Free allows 100,000 requests/day and 10 ms CPU/request; D1 Free includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. Account limits are shared with other workloads. Firebase non-phone authentication is available on Spark. Sources and alternatives are in [research.md](research.md).

Estimated unchanged polling reads roughly one indexed partner row plus one metadata row: 23,040 rows/day. At 100 saves/day and 1,000 tasks, two full-client refreshes per save add about 200,000 task rows/day, plus starts and incidental refreshes. Scanning 1,000 tasks every poll would cost 11.52 million rows/day. Index UID and task ID; account for index writes and measure actual D1 `rows_read`/`rows_written`. Retaining completed tasks means data grows; monitor storage and reconsider capacity before quotas are reached. Request bursts, multiple tabs, and unrelated account usage consume headroom. Measure signature verification and serialization within CPU budget. Quota errors are visible synchronization/availability failures, including non-JSON platform responses.

## Project Structure

### Documentation (generated now)

```text
specs/001-shared-task-board/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── openapi.yaml
    └── ui.md
```

### Source Code (planned only)

```text
src/
├── client/          # Spanish UI, auth, polling, IndexedDB, deadline conversion
├── worker/          # routes, token verifier, authorization, D1 access
└── shared/          # schemas, status mappings, API types
migrations/          # D1 schema and future versioned changes
scripts/            # local fixtures and validation helpers
tests/
├── unit/           # validation, revisions, time conversion
├── integration/    # Worker routing, verifier, D1 transactions
└── browser/        # two users, PWA/offline, accessibility, zones
```

**Structure Decision**: One deployable Worker and one browser bundle avoid multiple services while preserving a server trust boundary. Test and configuration files (Vite, Wrangler, Vitest, Playwright, Firebase emulator) will be added during implementation.

## Complexity Tracking

No constitution violations or exceptions. All design clarifications are resolved by the supplied preferences and decisions in research. Setup ran with explicit `SPECIFY_FEATURE_DIRECTORY`, `SPECIFY_FEATURE=main`, and persistence disabled to avoid altering unrelated feature selection. No extension configuration existed before generation; check again before completion.
