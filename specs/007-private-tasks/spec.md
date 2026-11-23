# Feature Specification: Private Tasks

**Feature Branch**: Pending

**Created**: 2026-11-23

**Status**: Draft

**Input**: Either partner can create a task through the existing form and keep its details and notifications private.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and manage a private task (Priority: P1)

As either partner, I can keep a personal task on my board and manage it through the usual task controls.

**Why this priority**: Both partners need a way to track personal work within the existing board.

**Independent Test**: Sign in as each partner in turn and create one shared task and one private task through the same form.

**Acceptance Scenarios**

1. Given the creation form, when either partner leaves the default visibility selected and saves a valid task, both partners see the shared task after synchronization.
2. Given the creation form, when either partner selects private and saves, the task appears on their board with a Spanish privacy label and is assigned to them. The form can be completed using a keyboard, with controls and labels accessible to screen readers.
3. Given a saved private task, when its creator edits its title, state, or deadline, the changes persist after synchronization. Attempts to change the visibility or assign it to the other partner are rejected.

### User Story 2 - Keep private tasks isolated (Priority: P1)

As a creator, I can rely on the board to protect my private tasks from the other partner on every device.

**Why this priority**: Privacy must hold through account switching, synchronization, and direct access.

**Independent Test**: Create a private task, synchronize both accounts, then use the other account to look for or modify the task, including by its identifier.

**Acceptance Scenarios**

1. Given a saved private task, when the other partner opens or synchronizes their board or attempts direct access, they receive no details or indication that the task exists and cannot change it.
2. Given a synchronized board, when the creator views it offline, their private task remains visible in their last authorized board. When the other partner signs in on the same device, their authorized board and any subsequent offline view expose none of the creator’s private tasks.

### User Story 3 - Receive private task notifications (Priority: P1)

As a creator, I receive applicable notifications about my private tasks without alerting the other partner.

**Why this priority**: A notification can reveal a task even when the board protects it.

**Independent Test**: Enable notifications on a supported device for each partner and exercise creation, ordinary edits, completion, and overdue eligibility.

**Acceptance Scenarios**

1. Given both partners opted in, when a private task is created, completed, or becomes eligible for an overdue notice, the creator is the sole recipient of the corresponding Spanish notification.
2. Given a private task, when its creator saves changes to its title, deadline, or state other than completion, the save generates zero change notifications. A save that also completes the task generates one completion notice addressed only to the creator.
3. Given an overdue notice has already been generated for the current deadline cycle, when eligibility is checked again or the task is reopened with the same deadline, no duplicate overdue notice is generated. A replacement deadline starts a new cycle under the existing rules.
4. Given a shared task, when partners create, complete, edit, or let it become overdue, the existing recipients still apply.

### Edge Cases

- A failed, rejected, or unchanged save produces no successful-change notification. Notification delivery failures do not undo a saved task.
- Private tasks with no deadline or tasks already complete at the eligibility check produce no overdue notice. Removing a deadline ends its eligibility.
- The creator’s offline board remains read-only. A signed-out user has no access to private tasks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both partners MUST be able to choose shared or private in the existing Spanish task creation form using accessible controls. Shared MUST be the default.
- **FR-002**: A private task MUST be assigned to its authenticated creator. Its visibility and assignment MUST be fixed once saved. The creator MUST be able to edit its title, state, and deadline using the existing controls.
- **FR-003**: The system MUST show private tasks with a Spanish privacy indication to their creator and MUST prevent all other users from discovering, reading, or modifying them through the board, synchronization, offline views, or direct access.
- **FR-004**: The creator MUST be the sole intended recipient of private-task creation, completion, and overdue notifications, subject to existing Spanish messaging, notification settings, and deadline-cycle rules. The same recipient restriction MUST apply to any supported reminder.
- **FR-005**: Ordinary edits to private tasks MUST produce zero change notifications. Completing a private task in a save that also edits other fields MUST produce only the completion notice.
- **FR-006**: Existing tasks MUST be treated as shared. Shared tasks MUST retain the access, assignment, and notification behavior defined by the [shared board](../001-shared-task-board/spec.md) and [task notifications](../006-task-notifications/spec.md) specifications.

### Key Entities

- **Task** — A shared or private board item with an assignee, title, state, and optional deadline. A private task’s creator is its sole assignee and authorized user.
- **Task notification** — A message about an eligible task event, subject to the recipient’s existing notification settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both authorized partners complete a private task creation through the existing form and can find and edit their task after synchronization.
- **SC-002**: Across both partner roles, the acceptance scenarios produce zero disclosures or successful modifications by the other partner and zero private-task disclosures after switching accounts.
- **SC-003**: In every tested private creation, completion, and overdue event with both partners opted in, the creator is the sole intended recipient. Ordinary edits produce zero notices and combined completion and edit produces exactly one completion notice.
- **SC-004**: All tested shared-task access, assignment, and notification scenarios retain their existing behavior.

## Assumptions

- This feature applies to the two existing authorized partners and uses existing task validation, synchronization, and notification preferences and delivery behavior.
- The private-task recipient restriction applies to supported reminders without expanding the set of reminder features. The acceptance scenarios use the notification events defined in the task notifications specification.
