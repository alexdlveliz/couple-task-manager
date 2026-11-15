# Research Decisions

## Delivery platform

**Decision**: Standard Web Push with VAPID on the existing Worker; authenticated subscriptions stored in D1. Use RFC 8291 encrypted payloads and RFC 8292 signing through Web Crypto, verified with protocol test vectors and a real provider.
**Rationale**: Matches the selected approach without another paid provider. Keep payloads below 3,993 plaintext bytes.
**Alternatives considered**: FCM introduces another messaging configuration; a Node-specific push package adds runtime compatibility work. A compatible library may replace the adapter internals only after checking current support and CPU performance.
**Sources**: https://www.rfc-editor.org/rfc/rfc8291.html and https://www.rfc-editor.org/rfc/rfc8292.html

## Scheduling and cost

**Decision**: One minute Cron Trigger with indexed due queries and small bounded delivery batches.
**Rationale**: Workers Free currently provides five cron triggers, 100,000 requests/day and 10 ms CPU per invocation, including cron. Network waiting is excluded from CPU but cryptography is not. A minute schedule produces 1,440 invocations daily. Deployment CPU measurement is a required implementation acceptance check; no free-tier guarantee is inferred from two-user scale alone.
**Alternatives considered**: Browser timers cannot run reliably while closed; external schedulers increase operational complexity.
**Source**: https://developers.cloudflare.com/workers/platform/limits/

## Durable events and retries

**Decision**: Atomic mutation intent, unique recipient events, per-device deliveries and expiring leases. Retry transient failures for at most 24 hours with bounded backoff; cancel obsolete pending overdue deliveries when the task completes, is deleted, or changes deadline. Keep a seven-day operational record and retain current-cycle deduplication separately.
**Rationale**: Avoid losing events between saving and dispatch. Provider acceptance is not receipt. A crash after acceptance can lead to duplicate transport attempts; stable event IDs and notification tags mitigate duplicate display without promising exactly once.
**Alternatives considered**: Only waitUntil dispatch loses durable intent; an external queue adds another service without solving the ambiguous acceptance boundary.
**Source**: https://www.rfc-editor.org/rfc/rfc8030.html

## Registration and privacy

**Decision**: Per-account per-device registration, HTTPS provider allowlist, bounded key/payload validation, no redirect following, and removal on account transitions. Treat endpoints and subscription auth values as secrets.
**Rationale**: Prevent cross-account delivery and arbitrary outbound fetches. Request permission only on explicit user action; distinguish permission from server registration state.
**Alternatives considered**: Sharing a device registration between accounts risks exposing private task changes.
**Sources**: https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription and https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## Existing PWA integration

**Decision**: Custom service worker preserving existing precaching, navigation exclusions and absence of API runtime caching. Add push and notification-click handlers.
**Rationale**: Current vite.config.ts generates the worker and has no push handler. Existing Worker routes call task persistence directly; event capture must preserve its guarded D1 batch and revision behavior. Task deletion already exists in code despite older spec exclusions and must cancel stale overdue work.
**Alternatives considered**: A second service worker at the same scope would conflict with the existing registration.

All planning unknowns are resolved as design decisions. Runtime CPU feasibility and actual device delivery remain explicit implementation validation obligations.
