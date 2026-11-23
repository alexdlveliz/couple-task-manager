# Implementation Plan: Private Tasks

**Branch** — `007-private-tasks` (planned feature branch)  
**Date** — 2026-11-23  
**Spec** — [Private Tasks](spec.md)

## Summary

Add an immutable visibility choice to the existing task flow. Enforce creator-only access in the Worker and D1, use per-partner board revisions, and scope notification recipients before events are queued.

## Technical Context

- **Language and dependencies** — TypeScript, React, Firebase Auth, Cloudflare Workers and D1. Use repository-pinned versions and local tooling.
- **Storage** — D1 is authoritative. IndexedDB retains complete authorized snapshots under the existing project and UID boundary.
- **Testing** — Vitest unit and Worker integration suites, Playwright against local Worker preview and Firebase Auth emulator.
- **Target and scope** — Spanish mobile-friendly PWA for two partners. Preserve conditional polling and existing notification schedules. No new hosted services or recurring jobs.

## Constitution Check

Pre-design and post-design gates pass. Both partners retain equal agency over shared tasks and identical private-task capabilities (I). Each authorized view synchronizes independently and remains read-only offline (II). Recipient and deadline rules respect existing delivery settings and device limitations (III). Worker authorization covers reads, writes, and event creation, with no private task details in logs (IV). The UI and messages remain Spanish, keyboard accessible, and usable on mobile (V). Existing services and free-tier assumptions remain applicable for two users. Provider quotas, permissions, and push availability continue to govern delivery (VI). Validate these gates using the [quickstart](quickstart.md).

## Project Structure

- `src/shared` defines task fields and validation.
- `src/worker` handles authorization, transactional writes, revisions, and notification eligibility. `migrations` holds the additive schema change.
- `src/client` handles task forms, board cards, and compatible offline snapshots.
- `tests/unit`, `tests/integration`, and `tests/browser` exercise progressively broader behavior.

## Implementation Sequence

1. Add visibility, immutable ownership, and audience revision storage. Preserve seeded and existing shared data and revisions. Update shared validation and API readers for compatibility.
2. Scope authenticated board reads and all task mutations, including existing deletion. Apply the same authorization to mutation diagnostics and notification batch statements. Return the caller's board revision from reads and saves.
3. Scope recipient selection for immediate and overdue events, including both scheduler candidate selection and enqueue. Retain deadline maintenance for silent edits and existing delivery and dedup behavior.
4. Add private creation and labeling in Spanish. Lock assignment in private mode, display the creator's name, and use the existing board and edit flow. Keep caching and account-switch isolation. Run the validation suite.
5. Apply the additive migration before deploying the compatible Worker and bundled UI. Verify backup and both-account smoke scenarios. Once private rows exist, roll back only to a privacy-aware build or disable task traffic while restoring service. Never serve private rows with the pre-feature Worker.

See [research](research.md), [data model](data-model.md), [interface contract](contracts/private-tasks.md), and [validation guide](quickstart.md).
