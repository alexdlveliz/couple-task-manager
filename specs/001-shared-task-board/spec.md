# Feature Specification: Shared Task Board and Reminders

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-11-02

**Status**: Draft

**Input**: A private shared board for two partners with assigned tasks, four states, task-change notifications, and optional scheduled reminders ending with a final overdue notification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share and update tasks (Priority: P1)

Either partner records work on a shared board, assigns it to one partner, and updates its progress so both can see the same responsibilities.

**Why this priority**: The board is the foundation for sharing work and mental load.

**Independent Test**: Sign in as each partner, create and update a task, and verify both see the same assignment and state.

**Acceptance Scenarios**:

1. **Given** an authorized partner, **When** they create a task with a title and assignee, **Then** both partners can see it in the to-do state.
2. **Given** a task assigned to either partner, **When** either partner changes its state or assignee, **Then** both see the updated task after synchronization.
3. **Given** a task assigned to the other partner, **When** a partner marks it done, **Then** the task appears done for both.
4. **Given** previously loaded tasks and no connection, **When** a partner opens the board, **Then** those tasks remain viewable and are identified as potentially stale.

### User Story 2 - Learn about changes (Priority: P2)

A partner receives notice when the other changes a shared task, helping them stay aware without continuously checking the board.

**Why this priority**: Change awareness supports coordination after the board exists.

**Independent Test**: With notifications enabled, change a task as one partner and verify the other receives a notice identifying the task and change.

**Acceptance Scenarios**:

1. **Given** both partners can receive notifications, **When** one creates or changes a task, **Then** the other receives a Spanish notification identifying the task and change.
2. **Given** notifications are unavailable or permission is denied, **When** a partner views notification settings, **Then** they can see that notifications are unavailable and how to enable them where possible.

### User Story 3 - Schedule reminders (Priority: P3)

A partner optionally sets a due date and a reminder cadence so both partners receive reminders while a task remains incomplete.

**Why this priority**: Reminders help keep time-sensitive work visible without being necessary for every task.

**Independent Test**: Set a future due date and daily or hourly reminder for an incomplete task, then verify scheduled and final notices for both partners.

**Acceptance Scenarios**:

1. **Given** an incomplete task with a future due date, **When** a partner selects a daily time or a positive whole-number interval of hours, **Then** both partners receive reminders on that schedule before the due date.
2. **Given** an incomplete task with a reminder, **When** its due date arrives, **Then** regular reminders stop and one final overdue notification is sent to each partner.
3. **Given** a task with a reminder, **When** either partner marks it done before the due date, **Then** subsequent regular and final overdue notifications are not sent while it remains done.
4. **Given** a task without a due date, **When** a partner saves it, **Then** the task is valid without a reminder.

### Edge Cases

- A reminder requires a future due date and cannot be saved without one; due dates without reminders are allowed.
- A task already past its due date cannot receive a new reminder until its due date is moved into the future.
- A regular reminder scheduled exactly at the due date is replaced by the final overdue notification.
- If an incomplete task is reopened after its due date, no additional final notification is sent for the same due date. Moving the due date to the future starts a new reminder cycle.
- A failed or unavailable delivery does not alter the task; notification availability is disclosed and delivery cannot be guaranteed.
- When connectivity returns, the board refreshes from authoritative saved task data. Offline editing is outside this feature.
- Simultaneous changes resolve to the last successfully saved change; both partners see the resulting saved state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST restrict the board and task data to the two authorized partners using separate email-and-password accounts.
- **FR-002**: Either partner MUST be able to create and edit a task with a nonempty title and exactly one required assignee, who is one of the two partners.
- **FR-003**: Each task MUST have one of four states: to do, in progress, blocked, or done, displayed respectively as “Por hacer”, “En progreso”, “Bloqueada”, and “Completada”. New tasks MUST start in to do.
- **FR-004**: Either partner MUST be able to change any task's assignee or state, including marking it done, regardless of assignment.
- **FR-005**: Both partners MUST see saved task changes on the shared board when connected; saved server data MUST be authoritative.
- **FR-006**: Previously loaded tasks MUST be viewable offline, with an indication that they may be stale; the product MUST indicate when it cannot synchronize.
- **FR-007**: A task MAY have a due date and time, a reminder, both, or neither, except that a reminder MUST require a future due date and time.
- **FR-008**: A reminder MUST be configured as either a daily local time or an interval of a positive whole number of hours. The daily schedule uses the configuring partner's time zone, including local daylight-saving changes; hourly intervals start when the reminder is saved.
- **FR-009**: For an incomplete task, each scheduled reminder strictly before its due date MUST be sent to both partners; regular reminders MUST stop at the due date.
- **FR-010**: At the due date, one final overdue notification MUST be sent to each partner if the task is incomplete and a reminder is configured. It MUST be sent at most once per partner per due-date cycle.
- **FR-011**: Marking a task done MUST stop its future reminders and final overdue notification while it remains done. Reopening it before the due date resumes its configured schedule; reopening it afterward MUST NOT generate another final notification for that due date.
- **FR-012**: Creating or editing a task, including its assignment, state, due date, or reminder, MUST send a notification identifying the task and change to the other partner, not the actor.
- **FR-013**: The product MUST show notification permission or availability problems and guidance to enable notifications when possible. Notifications depend on permission, device and platform services, and service availability.
- **FR-014**: All user-facing content, including board labels, onboarding, errors, reminders, and notifications, MUST be in Spanish.
- **FR-015**: The board and notification controls MUST be usable on mobile screens, by keyboard, and with assistive technology.

### Key Entities *(include if feature involves data)*

- **Partner**: One of two authorized account holders, either of whom can manage any task.
- **Task**: A shared item with a title, required assignee and state, and optional due date and reminder.
- **Reminder**: A task's selected daily time or hourly interval, its time zone where applicable, and its current due-date cycle.
- **Notification**: A message to a partner describing a task change, scheduled reminder, or final overdue event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In an acceptance test, both partners can create, assign, and complete a task in under two minutes each without assistance.
- **SC-002**: In connected acceptance tests, 100% of successfully saved task changes appear on both partners' boards after refresh.
- **SC-003**: In controlled tests with notification delivery available, 100% of scheduled reminder events before the due date and the single final overdue event are addressed to both partners, and no regular events are generated at or after the due date.
- **SC-004**: In controlled tests, 100% of task changes generate a notification addressed to the other partner, and none is addressed to the actor as a change notification.
- **SC-005**: Both partners can view all tasks previously loaded on their device during an offline acceptance test, with a visible stale-data indication.
- **SC-006**: Both partners can complete the primary board and reminder flows in Spanish using a mobile screen and keyboard, with no untranslated user-facing text found in those flows.

## Assumptions

- The two authorized partners and their accounts are provisioned privately; public registration and additional members are out of scope.
- A due date includes a time, and the configured time zone determines its meaning. The interface makes the chosen time zone clear.
- A reminder cycle is tied to a due date and time; changing it to a future value begins a new cycle. Removing a reminder cancels its future events.
- Task deletion, offline editing, and notification history are outside this feature.
- Delivery is best effort and depends on permissions, platform services, connectivity, and free-tier availability. On supported iPhones, users must add the app to the Home Screen to receive web push.
- Expected usage is limited to two partners and must fit the selected services' free tiers.
