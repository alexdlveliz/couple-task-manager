# Data Model: Private Tasks

## Task

- Add `visibility` with values `shared` and `private`, defaulting to `shared`, and nullable `creator_uid` referencing a partner. Existing shared rows keep a null creator. New shared rows may also use null.
- Private rows require a creator and `assignee_uid = creator_uid`. Enforce private row invariants and immutable visibility and creator at persistence and in the Worker. Preserve task ID, state, title, deadline, and timestamp behavior.
- Creation derives creator and private assignment from the authenticated UID. Replacements may change the usual editable fields within visibility and assignment rules. The owner can use existing deletion behavior. No conversions between visibility states.

## Board revision

- Add two slot-specific audience revision columns to the singleton board metadata row, both initialized to the pre-migration global revision. Resolve the caller’s counter through their authorized partner slot.
- In the same transaction as an accepted mutation, advance the audience revisions for both partners on shared create, update, or delete, and only the creator's revision on private create, update, or delete. Partner display-name and enabled changes advance both audience revisions.
- Update the global and affected audience counters in one metadata-row update. Retain the internal global mutation sequence, safe-integer guard, and single-row change signal consumed by deadline maintenance. Never return the internal value from task endpoints. Read visible rows and caller revision in the same D1 batch and retain the existing conditional request semantics.

## Notifications

- Retain event, deadline-cycle, overdue dedup, registration, and delivery records. Use existing cycle rules and recipients scoped at event creation.
- Creation and completion generate one event per eligible recipient. Private ordinary edits generate no change event. Apply existing deadline updates and obsolete delivery cleanup after authorized changes only.
