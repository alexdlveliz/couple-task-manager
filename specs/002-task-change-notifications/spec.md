# Feature Specification: Task-Change Notifications

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-11-02

**Status**: Draft

**Input**: Notify a partner when the other creates or changes a shared task, with notification enablement and clear availability guidance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive notice of task changes (Priority: P1)

A partner learns about the other's saved task changes without continuously checking the board.

**Why this priority**: Change awareness helps partners coordinate responsibilities.

**Independent Test**: Using the shared board with notifications enabled, create and edit tasks as each partner and verify notices go only to the other partner. No scheduled reminders are required.

**Acceptance Scenarios**:

1. **Given** notification delivery is available, **When** one partner creates a task, **Then** the other receives a Spanish notification identifying the task and its creation, and the actor receives no change notification.
2. **Given** an existing task, **When** either partner saves a title, assignment, state, or due-date change, **Then** the other receives a Spanish notification identifying the task and change.
3. **Given** a rejected or failed task save, **When** no change is saved, **Then** no successful-change notification is generated.

### User Story 2 - Enable notifications and understand limitations (Priority: P2)

Each partner can enable notifications on a supported device and understand permission or availability problems.

**Why this priority**: Partners need to know whether notifications can reach them and what they can do when they cannot.

**Independent Test**: Exercise allowed, not-yet-granted, denied, and unsupported notification states, including installation guidance where needed.

**Acceptance Scenarios**:

1. **Given** a supported device without notification permission, **When** a partner chooses to enable notifications and grants permission, **Then** the product enables notifications for that partner on that device and shows the resulting status.
2. **Given** denied permission or unsupported notifications, **When** a partner opens notification controls, **Then** the interface explains the limitation in Spanish and gives enabling guidance where possible.
3. **Given** a supported iPhone requiring Home Screen installation, **When** a partner views notification guidance, **Then** it explains the installation requirement before enabling notifications.
4. **Given** a known notification-service or delivery failure, **When** a partner views notification controls, **Then** the product discloses the known problem without claiming guaranteed delivery.

### Edge Cases

- An unavailable or failed notification must not undo or alter a successfully saved task.
- Completing a task is a change and notifies the other partner regardless of assignment.
- Notification permission is device-specific; one partner's permission does not imply availability for the other.
- No notification history, scheduled reminders, or final overdue notifications are included here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Creating or editing a task MUST generate a change notification identifying the task and change, addressed to the other authorized partner and never to the actor as a change notification.
- **FR-002**: Covered changes MUST include title, assignee, state, and due date. When scheduled reminders are added by spec 003, reminder changes MUST also use this notification behavior.
- **FR-003**: Only successfully saved changes MUST generate successful-change notifications. Notification failures MUST NOT alter the saved task or prevent board use.
- **FR-004**: Each authorized partner MUST be able to enable notifications on a supported device through notification controls and a permission request.
- **FR-005**: The product MUST show permission state, unsupported-device limitations, and known availability problems, with guidance for enabling notifications where possible. It MUST explain that delivery depends on permission, connectivity, device/platform services, and service availability.
- **FR-006**: Notification controls and task-related notification data MUST be restricted to the two authorized partners, preserving separate accounts and equal access.
- **FR-007**: All notification messages, controls, onboarding guidance, and errors MUST be in Spanish. Controls MUST be usable on mobile screens, by keyboard, and with assistive technology, with readable text and usable touch targets.

### Key Entities *(include if feature involves data)*

- **Partner**: An authorized board member who may act on a task or receive notice of the other partner's changes.
- **Notification Availability**: A partner's device-specific permission and capability status, including known problems preventing delivery.
- **Task-Change Notification**: A message identifying a saved task and its change, addressed to the partner who did not make the change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In controlled tests, 100% of successful task creations and covered edits generate a notification addressed to the other partner, with none addressed to the actor as a change notification.
- **SC-002**: With notification delivery available, both partners receive a Spanish notice identifying the task and change for each tested change type.
- **SC-003**: In all tested denied, unsupported, and known-unavailable states, notification controls show the limitation and applicable enabling guidance; saved task data remains unchanged by delivery failures.
- **SC-004**: Both partners can complete notification enablement and status-review flows on mobile and by keyboard; assistive technology exposes control labels and status, with no untranslated user-facing text found.

## Assumptions

- Requires [001-shared-task-board](../001-shared-task-board/spec.md), including its two private accounts and shared saved tasks.
- This feature can ship without [003-scheduled-reminders](../003-scheduled-reminders/spec.md). It supplies notification enablement and delivery capabilities for that later feature.
- Task deletion, offline editing, notification history, and scheduled notifications are excluded.
- Delivery is best effort. On supported iPhones, users must add the app to the Home Screen to receive notifications; device permission and platform services still apply.
- Normal use by two partners must fit the selected services' free tiers without a paid subscription. Quota or service failures may affect delivery and must be disclosed when known.
- Constitution principles I–VI apply. Validate equal access, saved-task independence from delivery failures, privacy, Spanish and accessible controls, notification recipients, and free-tier assumptions before acceptance; retain the board's synchronization and offline-viewing guarantees.
