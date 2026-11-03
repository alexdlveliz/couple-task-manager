# Data Model: Shared Task Board

## Authoritative entities

### Partner (`partners`)

| Field | Type | Constraint |
|-------|------|------------|
| slot | integer | Primary key, exactly one of 1 or 2 |
| uid | text | Unique, nonempty Firebase UID |
| displayName | text | Nonempty Spanish-facing display name |
| enabled | boolean | Required; checked on every API request |

Privately provision exactly two fixed rows; API has no create/update/delete partner operations. Operational provisioning validates both slots before service readiness. The slot constraint caps rows at two; readiness ensures both exist. Equal rights are independent of slot. Disabling a record blocks API access without deleting historical assignments. `/api/partners` returns only enabled assignable partners, in slot order, with UID/display name, never credentials or emails. In normal operation there are two enabled entries.

### Task (`tasks`)

| Field | Type | Constraint |
|-------|------|------------|
| id | text UUID | Server-generated primary key, immutable |
| title | text | Trimmed, nonempty; server and client share whitespace rules |
| assigneeUid | text | Required FK to unique partner UID; enabled at save time |
| status | text enum | `todo`, `in_progress`, `blocked`, `completed` |
| deadline | nullable UTC instant | RFC 3339 canonical `Z` string, or null |
| createdAt | UTC instant | Server-set and immutable |
| updatedAt | UTC instant | Server-set on each successful save |

New tasks always use `todo`; creation accepts no status or server fields. PUT requires every editable field (title, assigneeUid, status, deadline); null explicitly clears deadline. Missing fields/unknown properties are invalid. POST may omit deadline, meaning null. All status-to-status transitions, including reopening completed tasks, are allowed. Past deadlines are valid. Deadline does not change status automatically. Server parses and canonicalizes instants; rejects unzoned, impossible or nonfinite dates. Timestamps provide display/audit context, never concurrency ordering. No deletion, creator ownership, recurrence, reminder or notification entities.

One partner has many tasks; each task has exactly one assignee. Index task primary key and partner UID. Validate payload before D1 operations and enforce FK/status/nonempty constraints in storage; use bound parameters.

### Board metadata (`board_metadata`)

Singleton `id=1`; `revision` starts at 0, integer in JSON-safe range 0..9007199254740991. Revision is monotonic across successful task saves, including accepted same-value saves; failed mutations never advance it. Do not derive from time or row count. Guard overflow rather than wrap. Keep it across deployments/migrations.

## Transaction and response semantics

1. Verify token and current enabled caller on every request, including conditional GETs.
2. Mutation validation checks assignee against current enabled records in the database operation. For PUT, a missing ID produces 404. A zero-row mutation cannot increment revision. Roll back all statements on failure.
3. Within one D1 batch transaction, mutate exactly one task, advance metadata once conditional on that mutation, and read the saved task plus new revision. Authorization/assignee guards must prevent a concurrent disabling operation from admitting a forbidden write. Commit is the save boundary.
4. Two PUTs replace the full editable record; last committed values win without field merging or 409 version checks. A response's arrival order does not establish save order. Respond only after commit.
5. GET tasks with no matching ETag reads tasks and metadata in a single read batch, ordered by createdAt then id. It includes all tasks, including completed, without pagination. If a preliminary revision check detects a mismatch, re-read metadata in the snapshot batch; never reuse the preliminary revision with later rows.
6. Exact current ETag match returns bodyless 304 after authorization. Comparison uses the complete snapshot revision supplied by the client; malformed/multiple validators can be treated as no match. A change after the check is observed on the next refresh.

For mutation implementation, use conditional SQL and affected-row checks within the batch; do not increment unconditionally after a zero-row UPDATE. Preserve a stable outcome for the 400/403/404 classification from the same operation. Integration tests must prove no-op failures and rollback behavior using real D1 migrations.

## Browser persistence and ordering

IndexedDB key includes Firebase project, UID and schema version. Value: `uid`, `partners`, full `tasks`, `revision`, `lastSyncAt`, `schemaVersion`. Fetch partners on initial authorization and when accepting a changed full board, then store partners and that complete snapshot atomically; if either fetch fails, retain the prior complete cache and report failure. Operational changes to partner display/assignment records must also advance board revision so conditional refresh cannot retain stale assignee metadata. `lastSyncAt` is the local time of successful authoritative board verification (including valid 304), not an offline open time.

Track `snapshotRevision` for the complete board and `highestSeenRevision` for any confirmed server result. On mutation, raise highest seen but do not overwrite the complete cache or its revision with a partial task response. Immediately refresh; send the old complete snapshot ETag so missing concurrent changes are fetched. Accept a full snapshot only if revision is at least both tracked revisions. Serialize cache writes and reject lower revisions inside the IndexedDB transaction to prevent delayed writes from rolling back cache, including across tabs.

A 304 only verifies the exact snapshot used to issue that request; discard it if a newer mutation/full snapshot was observed meanwhile. Outstanding requests carry UID and auth-generation identity; discard on mismatch even if revision is higher. Coalesce refresh triggers and retry a discarded stale snapshot through the refresh coordinator.

Offline restore requires a persisted signed-in matching UID plus a previous successful authorization for that cache. Never show another UID's data while authentication initializes. Sign-out, account change, 401/403 clear private state and caches across tabs, cancel requests and stop polling. If deletion fails, suppress restoration and show storage failure until cleanup succeeds. No credentials or tokens in board cache. IndexedDB failure permits online viewing with an explicit loss-of-offline-availability warning. No save queue.

## Deadline semantics

Store only an instant, not the original device zone. Entry captures current IANA zone; recheck if device zone changes while editing and request reconfirmation in Spanish before interpreting changed local fields. Unchanged deadlines preserve their instant. Display date, time, zone and UTC offset calculated at that instant. A repeated local time chooses its earlier occurrence and exposes offset; a nonexistent local time is rejected before API submission. See [UI contract](contracts/ui.md) and acceptance examples in [quickstart](quickstart.md).
