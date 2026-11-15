# Implementation Plan: Task Notifications

**Branch**: `feature/notifications-management` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

## Summary

Add standard Web Push to the existing PWA and Worker. Persist notification intent alongside successful mutations, dispatch outside the save response, and run a minute-based scheduled handler for overdue eligibility and retries. Both partners receive creation, completion, and overdue events; other covered edits reach only the other partner.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19; existing Node engine range.
**Primary Dependencies**: Existing Firebase Auth, Wrangler, Vite PWA; standards-based Web Crypto push encryption and VAPID signing behind a tested transport adapter.
**Storage**: Existing D1 plus registrations, notification events, deliveries, and deadline cycle metadata.
**Testing**: Vitest unit and Worker integration tests; Playwright browser flows; real-device push smoke checks.
**Target Platform**: Cloudflare Workers and supported HTTPS browsers, including installed iOS 16.4+ Home Screen apps.
**Project Type**: Private two-person PWA and API.
**Performance Goals**: Submit eligible overdue events within approximately one minute under normal availability.
**Constraints**: Free tiers, 10 ms free Worker CPU budget, Spanish accessible UI, preserved revisions and UID-scoped offline snapshots; no credentials or task content in logs.
**Scale/Scope**: Two partners, multiple devices, bounded batches; no recurring reminders or notification history UI.

## Constitution Check

Pre-research and post-design: PASS by design; operational proof remains implementation validation.

- I: Equal access and recipients independent of assignment.
- II: Atomic saved-change intent; delivery failure never changes saved tasks; no API caching or offline editing.
- III: Durable eligibility and per-cycle deduplication; disclose best-effort delivery and known failures.
- IV: Authenticate all registration routes; ownership checks; endpoint validation and no sensitive logging.
- V: Spanish controls, permission guidance, keyboard and assistive-technology checks.
- VI: Reuse Worker/D1; indexed queries and bounded delivery batches; benchmark crypto CPU before accepting free-tier operation.

## Project Structure

Documentation: `specs/006-task-notifications/{plan,research,data-model,quickstart}.md` and `contracts/notifications.md`.

Source changes: `src/worker/tasks.ts`, `index.ts`, `env.ts`; new notification persistence, scheduler, and push transport modules in `src/worker`; shared notification contracts in `src/shared`; notification controls and service worker in `src/client`; `vite.config.ts` and `wrangler.jsonc`; next numbered migration in `migrations`; unit, integration, and browser tests in existing directories.

**Structure Decision**: Extend the existing application. Replace generated service-worker strategy with a custom worker preserving precache behavior and navigation exclusions.

## Delivery Design and Implementation Order

1. Add schema and transactional event capture. Inspect callers and tests before changing task persistence. Capture previous and saved values within one atomic D1 operation; do not compare against a separate pre-read. Preserve response shapes and revision guarantees. Unchanged payloads generate no event.
2. Add authenticated device registration, status, and removal contracts. Keep subscription secrets out of logs. Bind registrations to the current UID; unregister on logout/account switch before reuse, and clear local binding on session invalidation.
3. Implement a Web Crypto transport adapter with VAPID, RFC 8291 payload encryption, bounded concurrency and endpoint validation. Benchmark on a deployed development Worker against the free CPU limit. Do not claim free-tier viability based on network latency alone.
4. Add durable delivery claiming, bounded retries, invalid-subscription cleanup and minute Cron processing. Recheck task eligibility before overdue event creation. Use unique event keys and expiring delivery leases for concurrent runs.
5. Add Spanish per-device controls and service-worker push/click handling. Request permission only from an explicit action. Display notification with stable event tag; open only same-origin app URLs and require normal authentication for task access.
6. Run contract, migration, concurrency, failure, browser, and actual supported-device checks; update README and validation evidence.

## Complexity Tracking

No constitution exceptions. A durable outbox is required to avoid losing intent between a successful save and asynchronous dispatch. Delivery receipt and strict exactly-once device display are not guaranteed by Web Push.
