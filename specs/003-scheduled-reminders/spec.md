# Feature Specification: Scheduled Reminders

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-11-02

**Status**: Draft

**Input**: Let either partner configure optional daily or hourly task reminders for both partners, stopping at completion or the deadline and ending with one final overdue notification per partner and due-date cycle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure and receive reminders (Priority: P1)

Either partner adds a reminder to a task with a future deadline so both can stay aware of time-sensitive responsibilities.

**Why this priority**: Configurable reminders provide the main value of this feature.

**Independent Test**: On the shared board with notification delivery available, configure daily and hourly reminders and verify both partners receive the eligible scheduled notices.

**Acceptance Scenarios**:

1. **Given** an incomplete task with a future due date and time, **When** either partner saves a daily local-time reminder, **Then** both receive reminders on that schedule strictly before the deadline, using the configuring partner's time zone and its daylight-saving changes.
2. **Given** an incomplete task with a future deadline, **When** a partner saves a positive whole-number interval of hours, **Then** both receive reminders at that interval, starting one interval after the reminder was saved.
3. **Given** no deadline or an already-past deadline, **When** a partner tries to configure a reminder, **Then** it is rejected with Spanish guidance to supply a future due date and time.
4. **Given** a task without a reminder, **When** either partner saves it with or without a deadline, **Then** it remains valid and generates no scheduled notices.
5. **Given** an existing reminder, **When** either partner changes or removes it, **Then** future reminders follow the saved configuration and the other partner receives a task-change notification.

### User Story 2 - Receive one final overdue notice (Priority: P2)

Both partners learn when an incomplete task reaches its deadline without receiving continuing regular reminders afterward.

**Why this priority**: A clear endpoint prevents an overdue task from generating indefinite reminders.

**Independent Test**: Advance a reminder-enabled incomplete task through its deadline and verify one final event per partner with no regular events at or after that deadline.

**Acceptance Scenarios**:

1. **Given** an incomplete task with a configured reminder, **When** its deadline arrives, **Then** regular reminders stop and one final overdue notification is addressed to each partner.
2. **Given** a regular occurrence exactly at the deadline, **When** that instant arrives, **Then** only the final overdue notification is generated.
3. **Given** a final overdue event already generated for a due-date cycle, **When** scheduling is processed again, **Then** no additional final event is generated for either partner for that cycle.
4. **Given** a task whose deadline is moved into the future, **When** its new deadline arrives while it remains incomplete with a reminder, **Then** it is eligible for a new final overdue event for each partner.

### User Story 3 - Stop and resume reminders with task progress (Priority: P3)

Either partner can complete or reopen a task without leaving inappropriate reminders running.

**Why this priority**: Reminder behavior must reflect the current shared task state.

**Independent Test**: Complete and reopen a task before and after its deadline, and remove its reminder, checking subsequent notification eligibility.

**Acceptance Scenarios**:

1. **Given** a task with a reminder, **When** either partner marks it done before the deadline, **Then** no subsequent regular or final overdue notifications are generated while it remains done.
2. **Given** a completed task with a reminder, **When** it is reopened before the deadline, **Then** its configured schedule resumes for future eligible occurrences.
3. **Given** a task reopened after its deadline, **When** scheduling is processed, **Then** reopening does not generate an additional final notice for that due-date cycle.
4. **Given** a configured reminder, **When** either partner removes it, **Then** its future regular and final overdue events are canceled.

### Edge Cases

- Removing a due date while keeping a reminder is invalid; the partner must remove the reminder as well or supply a future deadline.
- A task already past its deadline cannot receive a new reminder until its due date is moved into the future.
- A due-date cycle is tied to a due date and time. Changing it to a future value begins a new cycle; editing other fields does not reset final-event eligibility.
- Notification delivery failures do not change tasks or schedules and cannot guarantee receipt. Reprocessing must not generate another final event for the same partner and cycle.
- Marking a task done or removing a reminder cannot retract notifications already dispatched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Either authorized partner MUST be able to add, edit, or remove an optional reminder on any shared task, regardless of assignment. Saving a reminder MUST require a future due date and time.
- **FR-002**: A reminder MUST be either a daily local time using the configuring partner's time zone, including local daylight-saving changes, or a positive whole-number interval of hours anchored when the reminder is saved. The interface MUST make the time zone clear.
- **FR-003**: For an incomplete task, each scheduled occurrence strictly before its deadline MUST generate a reminder addressed to both partners. Regular reminders MUST stop at the deadline; an occurrence exactly at the deadline MUST be replaced by the final overdue event.
- **FR-004**: At the deadline, an incomplete task with a reminder MUST generate one final overdue notification per partner, at most once per partner per due-date cycle.
- **FR-005**: Marking a task done MUST stop future regular and final overdue notifications while it remains done. Reopening before the deadline MUST resume its configured schedule; reopening afterward MUST NOT generate another final notice for that cycle.
- **FR-006**: Moving a deadline to a future value MUST begin a new due-date cycle. Removing the reminder MUST cancel its future regular and final events. A task without a reminder MUST remain valid with or without a deadline.
- **FR-007**: Saved reminder changes MUST notify the other partner, never the actor as a change notification, using the behavior defined in spec 002. Scheduled reminders and final overdue events MUST target both partners regardless of who configured the reminder.
- **FR-008**: Under normal service availability, scheduled notifications MUST be submitted for delivery within approximately one minute of their scheduled time; exact arrival time and successful device delivery are not guaranteed. Permission and known availability problems MUST use the guidance defined in spec 002.
- **FR-009**: All reminder controls, validation, errors, regular notifications, and final overdue notifications MUST be in Spanish. Configuration flows MUST be usable on mobile screens, by keyboard, and with assistive technology, with readable text and usable touch targets.
- **FR-010**: Reminder configuration and related task data MUST remain restricted to the two authorized partners and preserve the board's equal access, authoritative saved data, and offline-viewing guarantees. Offline reminder editing is excluded.

### Key Entities *(include if feature involves data)*

- **Task**: The shared board item whose current state and optional deadline determine reminder eligibility.
- **Reminder**: An optional daily time and time zone or hourly interval, associated with a task and its schedule anchor.
- **Due-Date Cycle**: A task's current deadline cycle used to distinguish final overdue eligibility; moving the deadline into the future begins a new cycle.
- **Scheduled Notification**: A regular reminder occurrence or final overdue event addressed to both authorized partners; distinct from a change notification to the other partner only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In controlled tests with delivery available, 100% of eligible regular occurrences and the single final overdue event are addressed to both partners; no regular events are generated at or after the deadline.
- **SC-002**: Controlled tests show no reminders while tasks remain done, correct resumption before the deadline, no duplicate final events after reopening or repeated processing, and renewed eligibility after moving the deadline into the future.
- **SC-003**: All tested missing/past deadlines and invalid hourly intervals are rejected with Spanish guidance; tasks with no reminders remain valid with or without deadlines.
- **SC-004**: Under normal service availability, every controlled scheduled-event test submits its eligible notification for delivery within approximately one minute of the scheduled time.
- **SC-005**: Both partners can configure, change, and remove reminders on mobile and by keyboard; assistive technology exposes labels and validation, with no untranslated user-facing text in reminder flows or messages.
- **SC-006**: In controlled tests, every saved reminder change generates a task-change notification to the other partner and none to the actor as a change notification.

## Assumptions

- Requires [001-shared-task-board](../001-shared-task-board/spec.md) for accounts, shared tasks, states, and deadlines, and [002-task-change-notifications](../002-task-change-notifications/spec.md) for notification enablement, availability guidance, delivery capabilities, and change notices.
- This feature adds scheduling to the existing board; it does not independently redefine authentication, synchronization, notification permissions, or delivery infrastructure.
- Task deletion, public registration, additional members, offline editing, and notification history remain excluded.
- Delivery is best effort and depends on permission, device/platform services, connectivity, and free-tier availability. Existing iPhone Home Screen guidance applies.
- Normal use by two partners must fit the selected services' free tiers without a paid subscription; quota and service failures can delay or prevent delivery.
- Constitution principles I–VI apply. Review equal and restricted access, saved-state eligibility, Spanish and accessible controls, reminder timing and recipient rules, delivery limitations, and free-tier assumptions before acceptance.
