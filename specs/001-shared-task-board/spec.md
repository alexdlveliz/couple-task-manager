# Feature Specification: Shared Task Board

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-11-02

**Status**: Draft

**Input**: A private shared board for two partners with separate accounts, assigned tasks, four states, optional due dates, synchronization, and offline viewing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share and update tasks privately (Priority: P1)

Each partner signs in with their own account and manages the same tasks, with equal ability to assign work and update progress.

**Why this priority**: A private, consistent board is the foundation for sharing responsibilities.

**Independent Test**: Sign in as each partner, create and update a task, and verify both see the same assignment and state; attempt access without an authorized account.

**Acceptance Scenarios**:

1. **Given** an authorized partner, **When** they create a task with a nonempty title and one authorized assignee, **Then** both partners see it in “Por hacer” after synchronization.
2. **Given** an existing task, **When** either partner edits its title, assignee, or state, **Then** both see the saved values after synchronization.
3. **Given** a task assigned to the other partner, **When** a partner marks it “Completada”, **Then** it appears completed for both.
4. **Given** no signed-in account or an account outside the two authorized partners, **When** someone attempts to access task data, **Then** access is denied.
5. **Given** a blank title or a missing or unauthorized assignee, **When** a partner saves a task, **Then** the save is rejected with a Spanish explanation.

### User Story 2 - Add a due date (Priority: P2)

Either partner optionally records when a task is due without needing notifications or reminders.

**Why this priority**: Due dates convey urgency while leaving the basic board useful without scheduling.

**Independent Test**: Save tasks with and without due dates, and verify both partners see the same deadline with a clear time zone.

**Acceptance Scenarios**:

1. **Given** a task, **When** either partner adds or changes a due date and time, **Then** both see the saved deadline and its displayed time zone.
2. **Given** a task with a due date, **When** a partner removes it, **Then** both see a task without a deadline.
3. **Given** no due date, **When** a partner saves the task, **Then** it remains valid.

### User Story 3 - View tasks without connectivity (Priority: P3)

A partner can consult previously loaded tasks offline and understand when information may be stale.

**Why this priority**: Temporary connection failures should not hide known responsibilities.

**Independent Test**: Load tasks, disconnect, reopen the board, then reconnect and verify it refreshes from saved authoritative data.

**Acceptance Scenarios**:

1. **Given** previously loaded tasks and no connection, **When** the partner opens the board, **Then** all those tasks remain viewable with a visible stale-data indication.
2. **Given** offline viewing, **When** a partner attempts to edit, **Then** the interface explains in Spanish that saving requires a connection.
3. **Given** changes saved by the other partner while disconnected, **When** connectivity returns, **Then** the board refreshes to authoritative saved values.
4. **Given** a synchronization failure while connected, **When** the board cannot refresh, **Then** it visibly reports the failure and identifies displayed data as potentially stale.

### Edge Cases

- Simultaneous changes resolve to the last successfully saved change; both partners see the resulting saved state.
- A due date includes a time; its time zone must be clear. Past due dates are allowed as task information.
- First use without a connection cannot show tasks that have never been loaded; the interface explains this limitation.
- A failed save must not be presented as successfully synchronized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Access to the board and task data MUST be restricted to two privately provisioned partners using separate email-and-password accounts. Access checks MUST be enforced on the server.
- **FR-002**: Either partner MUST be able to create and edit a task with a nonempty title and exactly one required assignee, who is one of the two partners.
- **FR-003**: Each task MUST have one of four states: “Por hacer”, “En progreso”, “Bloqueada”, or “Completada”. New tasks MUST start in “Por hacer”.
- **FR-004**: Either partner MUST be able to edit any task and change its assignee or state, including completing it, regardless of assignment.
- **FR-005**: Both partners MUST see saved task changes when connected; saved server data MUST be authoritative. Conflicting changes MUST resolve to the last successfully saved change.
- **FR-006**: All previously loaded tasks MUST remain viewable offline, with a stale-data indication. The product MUST expose synchronization failures and refresh authoritative data when connectivity returns. Offline editing is excluded.
- **FR-007**: Either partner MAY add, edit, or remove a task's optional due date and time. The interface MUST make the displayed time zone clear. Tasks without deadlines MUST remain valid.
- **FR-008**: All user-facing board, sign-in, onboarding, validation, and error content MUST be in Spanish.
- **FR-009**: The primary board flows MUST be usable on mobile screens, by keyboard, and with assistive technology, with readable text and usable touch targets.

### Key Entities *(include if feature involves data)*

- **Partner**: One of two authorized account holders, each with equal task-management rights.
- **Task**: A shared item with a nonempty title, exactly one authorized assignee, one of four states, and an optional due date and time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both partners can create, assign, and complete a task in under two minutes each without assistance.
- **SC-002**: In connected acceptance tests, 100% of successfully saved task changes appear on both boards after refresh.
- **SC-003**: Both partners can view all previously loaded tasks offline with a visible stale-data indication; after reconnection, both see the authoritative saved values.
- **SC-004**: In access-control tests, all unauthenticated and unauthorized attempts to read or change tasks are denied.
- **SC-005**: Both partners can complete board and due-date flows in Spanish on a mobile screen and by keyboard; an assistive-technology review finds labeled controls and exposed states, with no untranslated user-facing text in those flows.

## Assumptions

- Public registration, additional members, task deletion, offline editing, notifications, and reminder scheduling are outside this feature.
- This feature has no dependency on the notification or reminder specs and can ship on its own.
- [Task-change notifications](../002-task-change-notifications/spec.md) and [scheduled reminders](../003-scheduled-reminders/spec.md) extend this board separately.
- Expected use is two partners within the selected services' free tiers, without a paid subscription for normal operation; quota failures must remain visible as availability or synchronization problems.
- Constitution principles I, II, IV, V, and VI apply directly; principle III is delivered by the dependent notification and reminder features. Review access, saved-data consistency, offline viewing, Spanish content, accessibility, and free-tier assumptions before acceptance.
