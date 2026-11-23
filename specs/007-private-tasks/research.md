# Research: Private Tasks

## Ownership and enforcement

- **Decision** — Persist visibility and creator separately from the assignee. Bind creator from authenticated context and scope all task operations at the data boundary.
- **Rationale** — Existing shared assignment is mutable. Private access must also cover direct identifiers, deletion, and writes that enqueue notifications.
- **Alternatives considered** — UI filtering and assignment-based access. UI filtering exposes task data and assignment is a separate concept.

## Sync and cache

- **Decision** — Use audience-specific revision counters for board responses and keep the existing global counter for internal mutation sequencing.
- **Rationale** — The existing global revision and ETag would disclose private changes to the other partner. Initialize each audience counter from the old global value to preserve monotonic comparisons in existing snapshots. Keep account-scoped storage and accept cached legacy tasks as shared.
- **Alternatives considered** — Filtering rows with a global ETag leaks activity. A content hash alone would discard ordering guarantees used by synchronization and cache writes.

## Notifications

- **Decision** — Resolve the eligible audience during saved-event and overdue-event creation. Leave device registration and delivery scoped to the event recipient.
- **Rationale** — Current delivery joins by recipient UID. Both overdue candidate selection and enqueue must use the same audience so an already notified private task does not repeatedly occupy scheduler capacity. A silent edit may still change deadline eligibility.
- **Alternatives considered** — Filtering at push time still creates events for the wrong audience. Dropping all private notifications conflicts with the selected behavior.
