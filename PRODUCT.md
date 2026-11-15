# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two partners share responsibility for tasks through separate, privately provisioned accounts. Mobile phones are their primary devices. The product is intended for people who value simple, easy-to-use interfaces.

## Product Purpose

Help both partners share work and mental load through a private, shared task board. Each partner can see responsibilities and update progress without one person having privileged control.

## Operating Context

Partners sign in separately, create and update shared tasks, assign each task to either partner, and optionally record a deadline. Previously loaded tasks can be consulted offline; saving changes requires a connection.

## Capabilities and Constraints

- Exactly two authorized partners have equal rights to every task. Access is enforced on the server.
- Tasks have a title, one assignee, one of four states, and an optional due date and time. The displayed time zone must be clear.
- Saved server data is authoritative. Offline information can be stale, and connectivity and synchronization failures must be visible.
- The base board excludes public registration, additional members, task deletion, and offline editing. Notifications and scheduled reminders are separately specified extensions; their specifications alone do not establish that they are implemented.
- Normal operation is intended to fit the selected services' free tiers.
- The existing web app uses React and TypeScript, Cloudflare Workers and D1, and Firebase Authentication.

## Brand Commitments

User-facing content is in Spanish. The interface should be simple and easy to use, with mobile use prioritized.

## Evidence on Hand

The current implementation and setup are described in [README.md](README.md). The base requirements and recorded validation are in [spec.md](specs/001-shared-task-board/spec.md) and [validation.md](specs/001-shared-task-board/validation.md); extension specifications are in `specs/002-task-change-notifications/` and `specs/003-scheduled-reminders/`.

## Product Principles

- Make common task management straightforward on a phone.
- Give both partners equal agency over shared work.
- Protect the privacy of the two authorized users.
- Make saved state, stale information, and synchronization failures understandable.
- Keep normal operation simple and within the expected free-tier limits.

## Accessibility & Inclusion

Primary flows must support mobile screens, keyboard use, and assistive technology, with readable text, labeled controls, exposed states, and usable touch targets.
