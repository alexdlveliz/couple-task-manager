# Notification Contracts

All API routes require the existing Firebase bearer authentication and two-partner authorization, return `Cache-Control: no-store`, and use existing Spanish error envelopes. Limit JSON bodies to 8 KiB.

- `GET /api/notifications/config`: `{ available: boolean, publicKey: string | null, problem: string | null }`; return the public VAPID key only, never private credentials.
- `POST /api/notifications/subscriptions`: `{ endpoint, expirationTime, keys: { p256dh, auth } }`; create or refresh the caller's registration; return `{ id, active: true }` with 201 on creation and 200 on refresh. A subscription belonging to another account returns 409 rather than transferring ownership.
- `GET /api/notifications/subscriptions/:id`: return only caller-owned `{ id, active, lastOutcome }`; 404 for unknown or foreign IDs.
- `DELETE /api/notifications/subscriptions/:id`: disable caller-owned registration, cancel pending deliveries and return 204; foreign IDs return 404.

Validate HTTPS endpoint, recognized browser push-provider origins, no credentials/fragments, key material, expiry, and bounded lengths. Disable redirect following for outbound requests. Maintain and test provider allowlist against supported-device endpoints; never allow arbitrary server-side fetch URLs.

Push payload: `{ version: 1, eventId, title, body, url: '/' }`. All display text Spanish. Never embed tokens or subscription secrets. Service worker calls showNotification for received pushes, uses event ID as tag, and constrains clicks to same-origin application paths. Existing task mutation response contracts remain unchanged.

UI: explicit `Activar notificaciones` action, device status, permission-denied settings guidance, unsupported guidance, iPhone installation instructions, and known service-problem disclosure. Registration status is distinct from browser permission. Account transitions remove the previous subscription association; failure must not associate it with the next account. No silent permission requests.

Scheduler: once per minute, guarded overdue creation and bounded dispatch. HTTP push 2xx means accepted, 404/410 disables registration, 429/5xx/network errors retry with bounded exponential backoff and Retry-After support; other failures become visible sanitized operational status. Retry ceiling: 24 hours from event creation. No task rollback on delivery failure.
