# Agent Guide

## Project

This repository contains a private, Spanish-language task board for exactly two partners. The browser app uses React and TypeScript; a Cloudflare Worker serves the app and API; D1 is the authoritative task store; Firebase Authentication provides separate email-and-password accounts. The client keeps a UID-scoped copy of the last authorized board for offline viewing. Saving requires a connection.

Read [README.md](README.md) for current setup and production guidance. The feature specifications in `specs/` describe requirements and planned extensions; check implementation and [specs/001-shared-task-board/validation.md](specs/001-shared-task-board/validation.md) before claiming a requirement is implemented or validated. The notification and scheduled-reminder specs are separate extensions; do not assume they are implemented merely because their specs exist. Consult `.specify/memory/constitution.md` for project principles.

## Architecture and invariants

- `src/client` contains the Spanish UI, authentication, synchronization, and offline behavior; `src/worker` contains API routing, authentication checks, and D1 access; `src/shared` holds types and shared contracts.
- `migrations/` contains versioned D1 schema changes. `tests/unit`, `tests/integration`, and `tests/browser` cover progressively broader behavior. `scripts/` contains local development helpers; see `scripts/README.md` for fixture account details.
- The server must authenticate and authorize each request against the two provisioned partner identities. Both partners have equal rights to every task. Never trust client-side authorization.
- Saved server data is authoritative. Preserve revision and synchronization behavior; a partial mutation response is not a complete offline snapshot. Offline mode is read-only and must communicate stale data and synchronization failures.
- Keep user-facing board, authentication, validation, and error content in Spanish. Preserve mobile, keyboard, and assistive-technology accessibility.
- Do not log credentials, tokens, or task contents. Keep local environment files and secrets out of version control. Production uses real Firebase configuration and D1; the local Worker and auth emulator are for local development only.
- Respect feature boundaries: task deletion, public registration, extra members, offline editing, notifications, and reminders are not part of the base shared-board specification. Check the relevant spec before extending these boundaries.

## Local development and checks

Use Node.js 22.12+ and pnpm 12.16.1. Follow the README's local setup: install from the frozen lockfile, copy the example environment files, start the Firebase Auth emulator for `demo-shared-task-board`, apply local D1 migrations, seed local fixtures, then run the dev server. Do not point local seeding or automated tests at production services.

Available checks are `pnpm run typecheck`, `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run build`, and `pnpm run preview:worker`. Run browser tests with `pnpm run test:browser` against the Worker preview on port 8787 while the auth emulator is running; stop the dev Worker first if it occupies that port. Use the README and feature quickstart for prerequisites and scenario details. Report only checks actually run and their results.

## Change workflow

- Before changing a function, find and inspect its callers and relevant tests.
- Read the applicable spec, API contract, data model, and validation notes before changing behavior. Keep implementation and documentation aligned; flag unclear or contradictory requirements before coding.
- Make focused changes and stage specific paths only; never use `git add .`. Use Conventional Commit messages and incremental commits for completed logical units. Do not commit until the user has reviewed the diff.
- Do not modify this `AGENTS.md` unless the user explicitly asks. Do not push directly to `main` or `master`.
- Create a pull request only after the user explicitly confirms implementation is complete and tested. At that point, push the working branch and create the PR using the GitHub MCP when available, otherwise `gh`; use `.github/pull_request_template.md` if present.

## Useful references

- `specs/001-shared-task-board/spec.md`: base product requirements.
- `specs/001-shared-task-board/plan.md`, `data-model.md`, `contracts/`, and `quickstart.md`: architecture, data, API/UI contracts, and acceptance scenarios.
- `specs/001-shared-task-board/validation.md`: recorded checks and outstanding validation.
- `specs/002-task-change-notifications/spec.md` and `specs/003-scheduled-reminders/spec.md`: separately specified extensions.
- `scripts/README.md`: local test identities and helper details.
