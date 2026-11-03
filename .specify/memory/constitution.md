<!--
Sync Impact Report (temporary; remove before commit)
Version change: unratified template → 1.0.0
Modified principles: template placeholders → I–VI below
Added sections: Technology and Operating Constraints; Development and Review
Removed sections: none
Deferred TODOs: none
-->
# Couple Task Manager Constitution

## Core Principles

### I. Shared Access and Equal Agency

Both authorized partners MUST have equal access to the shared board and MUST be able to
view and update its tasks, regardless of assignment. Features MUST support sharing work and
mental load without giving either partner privileged task-management powers.

### II. Consistent and Available Task Information

The server's task data MUST be authoritative. Changes MUST synchronize between partners,
and previously loaded tasks MUST remain available for offline viewing. The interface MUST
make connectivity or synchronization failures visible so users can understand when data
may be stale.

### III. Dependable, Transparent Reminders

Scheduled reminders and task-change notifications MUST follow the user's configured rules.
The product MUST communicate when notification permission or delivery is unavailable;
delivery depends on device permission, platform services, and free-tier availability.
Reminder behavior MUST be verifiable against the feature specification.

### IV. Privacy and Restricted Access

Only the two authorized partners MUST be able to access shared task data. Each MUST use a
separate account. Access checks MUST be enforced on the server, and credentials and task
data MUST NOT be exposed to unauthorized users or unnecessarily recorded in logs.

### V. Spanish and Accessible Mobile Use

All user-facing information MUST be in Spanish, including interface text, notifications,
reminders, errors, and onboarding. Code and project specifications MAY remain in English.
The product MUST support keyboard and assistive-technology use, readable text, and usable
touch targets on mobile screens.

### VI. Simple, Free-Tier Operation

The design MUST fit the free tiers of its selected services under the expected use of two
partners, without requiring a paid subscription for normal operation. It MUST minimize
operational complexity and make service limits and resulting availability constraints
visible in planning and review.

## Technology and Operating Constraints

The initial product MUST be a React and TypeScript progressive web app. Cloudflare Workers
and D1 MUST provide hosting, backend, scheduling, and storage; Firebase Authentication MUST
provide separate email-and-password accounts. Changes to this direction require a
constitution amendment. Free-tier quotas can affect availability. On iPhone, web push
requires adding the PWA to the Home Screen on iOS 16.4 or later, as documented by
[WebKit](https://webkit.org/blog/13878/).

## Development and Review

Specifications and plans MUST identify applicable principles, free-tier assumptions,
notification delivery limitations, and how compliance will be verified. Reviews MUST check
access control, synchronization and offline viewing, Spanish user-facing content,
accessibility, and notification behavior for affected changes. Exceptions MUST be resolved
through an approved amendment before conflicting work is accepted.

## Governance

This constitution governs project specifications, plans, implementation, and review. An
amendment MUST document its rationale and impact, receive approval from both partners, and
include a migration plan when existing work must change. Compliance MUST be reviewed before
accepting a specification, plan, or implementation change.

Constitution versions follow semantic versioning: MAJOR for incompatible principle or
governance changes or removals; MINOR for new principles or materially expanded guidance;
and PATCH for clarifications and other non-semantic corrections. The ratification date
remains fixed; the last-amended date changes when an amendment is approved.

**Version**: 1.0.0 | **Ratified**: 2026-11-02 | **Last Amended**: 2026-11-02
