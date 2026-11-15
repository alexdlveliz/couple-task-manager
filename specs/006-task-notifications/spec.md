# Feature Specification: Task Notifications

**Feature Branch**: `feature/notifications-management`

**Created**: 2026-11-15

**Status**: Draft

**Input**: Extend the task-change notification draft with notifications to both partners for task creation, completion, and every incomplete task reaching its deadline; use standard Web Push with Cloudflare.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learn about saved task changes (Priority: P1)

Both partners learn when a task is created or completed, while the partner who did not make another covered edit learns about that edit.

**Why this priority**: Timely awareness helps both partners coordinate shared work.

**Independent Test**: Enable notifications for both partners, create, complete, and edit tasks as each partner, and check the intended recipients and Spanish messages.

**Acceptance Scenarios**:

1. **Given** a task is successfully created, **When** the change is saved, **Then** a creation notification identifying the task is addressed to both partners, including the creator.
2. **Given** an incomplete task is successfully marked complete, **When** the change is saved, **Then** a completion notification identifying the task is addressed to both partners, including the actor.
3. **Given** a saved change to a task's title, assignee, state other than completion, or deadline, **When** the change is saved, **Then** a notification identifying the task and the covered change is addressed only to the other partner.
4. **Given** a save that completes a task and also changes other covered fields, **When** it succeeds, **Then** both partners are addressed by a completion notification and the other partner is also informed of the other changes, without duplicate completion notices.
5. **Given** a rejected, failed, or unchanged save, **When** it does not produce a saved change, **Then** no successful-change notification is generated.

### User Story 2 - Learn when tasks are overdue (Priority: P1)

Both partners learn when any incomplete task reaches its deadline, without configuring a reminder.

**Why this priority**: Deadlines need attention even when neither partner has the app open.

**Independent Test**: Let incomplete and completed tasks with and without deadlines pass their deadlines and inspect intended recipients and repeat processing.

**Acceptance Scenarios**:

1. **Given** an incomplete task with a deadline, **When** that deadline arrives, **Then** one overdue notification identifying the task is addressed to each partner, regardless of assignment or reminder configuration.
2. **Given** a task is complete when its deadline is processed, or has no deadline, **When** overdue eligibility is evaluated, **Then** no overdue notification is generated for it.
3. **Given** an overdue notification has been generated for a partner and deadline cycle, **When** eligibility is processed again or the task is reopened after the deadline, **Then** no additional overdue notification is generated for that partner in that cycle.
4. **Given** a deadline is moved to a future instant, **When** that new deadline arrives and the task remains incomplete, **Then** a new overdue notification is addressed to each partner.
5. **Given** a task is saved with an already-past deadline or reopened after its deadline without a prior overdue event for that cycle, **When** eligibility is next processed, **Then** an overdue notification is addressed to each eligible partner.

### User Story 3 - Enable and understand notifications (Priority: P2)

Each partner can enable notifications on supported devices and understand permission and availability limitations.

**Why this priority**: Partners need to know whether their devices can receive notices.

**Independent Test**: Exercise enabled, not-yet-granted, denied, and unsupported states for each partner and on multiple devices.

**Acceptance Scenarios**:

1. **Given** a supported device without permission, **When** a partner chooses to enable notifications and grants permission, **Then** notifications are enabled for that partner on that device and the resulting status is shown.
2. **Given** denied permission, unsupported notifications, or a known service failure, **When** a partner reviews notification controls, **Then** Spanish guidance explains the limitation and available corrective steps.
3. **Given** a supported iPhone requiring installation, **When** a partner reviews notification guidance, **Then** it explains the Home Screen installation requirement before enablement.
4. **Given** multiple enabled devices for a partner, **When** a notification is addressed to that partner, **Then** it is submitted to each currently registered eligible device.

### Edge Cases

- A notification failure or lack of permission never reverses or blocks a successful task save.
- Notifications already dispatched cannot be recalled when a task is completed or its deadline changes.
- Moving a deadline into the future starts a new cycle; unrelated edits and reopening do not reset a cycle. Removing a deadline cancels future eligibility for it.
- If a notification service is unavailable at the deadline, eligible events are processed when service resumes; delivery and exact arrival are not guaranteed.
- Device permission and registration are device-specific; stale or invalid registrations must not prevent delivery attempts to other devices.
- Notification content may appear on lock screens; only the two authorized partners may manage registrations and access task data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Successfully creating a task MUST generate a Spanish notification identifying the task and creation addressed to both authorized partners.
- **FR-002**: Successfully changing an incomplete task to complete MUST generate a Spanish notification identifying the task and completion addressed to both partners, regardless of assignment.
- **FR-003**: Successfully changing a title, assignee, deadline, or state other than completion MUST generate a Spanish notification identifying the task and change addressed only to the partner who did not make the change. A save that includes completion and other covered changes MUST satisfy both recipient rules without duplicate completion notices.
- **FR-004**: Failed, rejected, and unchanged saves MUST NOT generate successful-change notifications. Notification failures MUST NOT change saved tasks or prevent normal board use.
- **FR-005**: Every incomplete task with a deadline MUST generate one overdue event addressed to each partner when its deadline arrives, without requiring an optional reminder. Tasks without a deadline or complete at eligibility processing MUST NOT generate an overdue event.
- **FR-006**: The product MUST generate at most one overdue event per partner per task deadline cycle, including on repeated processing and reopening after a prior event. Moving a deadline to a future instant MUST begin a new cycle; other edits and reopening MUST NOT reset it.
- **FR-007**: Already-past deadlines and tasks reopened after their deadline MUST be evaluated on the next eligibility check, subject to the per-cycle limit. Removing a deadline MUST stop future overdue eligibility for it.
- **FR-008**: Each partner MUST be able to enable notifications on each supported device, review its status, and receive guidance in Spanish for unsupported, denied, and known unavailable states, including iPhone Home Screen installation where required.
- **FR-009**: Notifications addressed to a partner MUST be submitted to that partner's currently registered eligible devices. Device failures MUST NOT prevent attempts to other eligible devices.
- **FR-010**: Notification controls and related task and device data MUST be limited to the two authenticated and authorized partners. Saved server data, synchronization, and read-only offline viewing MUST remain authoritative and intact.
- **FR-011**: All user-facing notifications, controls, guidance, and errors MUST be in Spanish and support mobile, keyboard, and assistive-technology use.
- **FR-012**: The product MUST communicate that delivery depends on permission, connectivity, device and platform services, and service availability, and MUST disclose known delivery or service problems without guaranteeing receipt.
- **FR-013**: Under normal service availability, overdue notifications MUST be submitted for delivery within approximately one minute of the deadline or, for an already-past deadline, the next eligibility check.

### Key Entities *(include if feature involves data)*

- **Partner**: One of two authorized users who can act on tasks and receive notifications on enabled devices.
- **Device notification registration**: A device-specific association with a partner and its notification availability.
- **Task notification**: A creation, completion, other covered change, or overdue message, with recipients determined by event type.
- **Deadline cycle**: A task's deadline period used to prevent repeated overdue events; a deadline moved to a future instant begins a new cycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In controlled tests, 100% of saved creation and completion events are addressed to both partners; 100% of other covered changes are addressed only to the other partner.
- **SC-002**: In controlled tests, every eligible overdue cycle generates one event per partner, with no duplicates after repeat processing or reopening following an event, and none for tasks without deadlines or complete at processing.
- **SC-003**: Under normal service availability, 100% of tested overdue events are submitted for delivery within approximately one minute of the deadline or the next eligibility check for an already-past deadline.
- **SC-004**: Both partners can enable and review notification status on supported devices using mobile and keyboard flows; tested denied, unsupported, and known-unavailable states provide Spanish guidance and assistive technology exposes labels and status.
- **SC-005**: In all tested notification-failure and permission scenarios, successful task saves remain intact and usable; unauthorized users cannot manage registrations or access task data.

## Assumptions

- This specification supersedes conflicting recipient and overdue rules in the drafts [002-task-change-notifications](../002-task-change-notifications/spec.md) and [003-scheduled-reminders](../003-scheduled-reminders/spec.md). The latter's optional recurring reminders remain a separate future feature; implementing it must reuse the single overdue event defined here rather than duplicate it.
- Existing shared-board accounts, task states, deadlines, synchronization, and offline-viewing behavior are prerequisites. Task deletion, public registration, extra members, offline editing, notification history, and recurring pre-deadline reminders are outside this feature.
- The selected operating constraint is standards-based Web Push using the existing Cloudflare services for backend, scheduling, and storage; no separate paid notification provider is required. Planning must validate Worker CPU, request, and database quotas for normal two-partner usage.
- Delivery is best effort. Supported iPhones require installation to the Home Screen and permission; platform services and free-tier availability affect delivery. A generated event is not proof of receipt.
- Constitution principles I–VI apply. Validate equal and restricted access, saved-task independence, synchronization, Spanish and accessible controls, recipients, timing, and free-tier assumptions before acceptance.
