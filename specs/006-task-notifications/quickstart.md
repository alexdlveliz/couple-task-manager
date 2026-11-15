# Validation Guide

This guide describes acceptance checks after implementation; the feature is not implemented by these documents.

1. Follow README local setup: frozen-lockfile installation, Firebase emulator, example environment files, local D1 migrations and local fixture seeding. Never seed production.
2. Generate a development-only VAPID key pair with the implementation's documented helper. Store the private key and contact subject in Worker secrets/environment files; keep them untracked. Set the public key consistently for registration. Production uses separate credentials.
3. Apply migrations with the README's local migration command. Build with `pnpm run build`; start the auth emulator and `pnpm run preview:worker` on 8787. Use a local fake push transport for deterministic automated tests; real push requires HTTPS and real browser subscriptions.
4. Run `pnpm run typecheck`, `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run build`, and `pnpm run test:browser` with their prerequisites. Record actual results separately.
5. As both fixture accounts, test the recipient matrix: creation/completion to both; title/assignment/deadline/reopening to the other partner; mixed completion edits correctly summarized; failed and unchanged saves generate none.
6. Use controlled clocks in tests for deadlines: incomplete, completed, no deadline, past deadline, reopen, future reschedule, deadline removal, duplicate and concurrent scheduler execution. Expect one logical overdue event per partner per cycle. Verify deletion cancels obsolete pending overdue work.
7. Simulate invalid subscriptions, 429, 5xx, timeout, process failure after transport acceptance, expired leases, and notification service misconfiguration. Task saves and offline snapshots remain correct. Check retry bounds and known-problem guidance.
8. On real HTTPS development deployment, test Android/desktop supported browsers and an installed iPhone Home Screen app. Grant/deny permission, close the app, receive each event, click notifications, switch accounts, and test multiple devices. Do not substitute mocked browser tests for proof of real push delivery.
9. Measure deployed Worker CPU for mutation capture, idle cron, overdue creation and maximum delivery batch including cryptography; inspect D1 row usage. Accept free-tier operation only with evidence below limits. Record enabled device count and tested batch bound.
10. Review Spanish text, keyboard navigation, assistive-technology labels, readable status, sensitive logging, endpoint validation, unauthorized/foreign-registration access, and service-worker API cache exclusions.
