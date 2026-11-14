# Nuestro día Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver approved concept B with A’s status and partner filters, preserving fast shared task management.

**Architecture:** Client-only presentation and derived grouping over the authoritative board snapshot. Keep existing API, persistence, authentication, and save/reconciliation contracts.

**Tech Stack:** Existing React, TypeScript, CSS, Temporal, Vitest, and Playwright.

**Spec:** Approved conversation design brief and `specs/001-shared-task-board/contracts/ui.md`. Visual reference: generated comparison, concept B with concept A filters.

## Global Constraints

- Spanish UI; both partners retain equal task rights. No new backend schema or dependencies.
- Preserve explicit offline/stale feedback, last synchronization time, disabled saving states, and full deadline time-zone/offset details.
- Minimum 44px targets, 16px base text, keyboard operation, 320px width, 200% text zoom, reduced motion.
- Existing user changes to DESIGN.md and .impeccable/design.json must be preserved. No commits before user diff review; no push or PR.

## Approved Design and Defaults

Warm ivory canvas, forest-green actions, apricot emphasis, expressive serif heading and readable sans-serif controls. Header shows date, “Nuestro día,” and real partner initials/names. Keep sign-out accessible. Compact synchronization feedback expands visibly for errors/offline conditions.

Daily summary counts unfinished tasks due on the current local date and all tasks in progress across the board; filters affect the list/result count, not this summary. Keep summary informational for this iteration.

Labeled status and partner filter chips include every existing status, all tasks, both real partner names, and an explicit reset. Default: no filters. Group the filtered list in order: Vencidas, Hoy, Próximas, Sin fecha, Completadas. Omit empty groups. Completed status takes precedence over deadline. “Vencidas” means unfinished deadlines before today's local calendar date; earlier times today remain in Hoy. Preserve source order within groups. Refresh date grouping at local midnight and on window focus. Display a total filtered result count.

Retain direct labeled status selection and editing rather than interpreting the mockup’s decorative checkboxes as a new completion shortcut. Keep Nueva tarea reachable on mobile without obscuring rows. No list/board toggle for this iteration. Subtle confirmation motion occurs only after confirmed saves; avoid animated row removal or focus loss on regrouping.

## Review Focus

- Local midnight and time-zone changes must not misclassify deadlines.
- Completed overdue tasks belong only to Completadas.
- Filters must retain blocked tasks and distinguish empty board from empty results.
- Long titles/names, zoom, and narrow screens must retain every action.
- Saves/reconciliation and offline states must remain truthful and keyboard focus stable.

## Task 1: Derived board presentation

**Files:** create `src/client/board-view.ts`; extend `tests/unit/board-view.test.ts`.

**Interface:** `groupTasks(tasks: Task[], now: string, zone: string): { key: string; label: string; tasks: Task[] }[]`; `summarizeTasks(tasks: Task[], now: string, zone: string): { today: number; inProgress: number }`.

- [ ] Inspect existing board-view tests and deadline callers before editing.
- [ ] Add failing tests for all five groups, completed precedence, source order, empty groups, local midnight, DST/device zones, summary excluding completed today and including blocked due today.
- [ ] Run `pnpm run test:unit` and confirm new tests fail for missing behavior.
- [ ] Implement pure derivation using existing Temporal date conversion; rerun unit tests.
- [ ] Present logical diff for user review before any incremental commit (`feat(board): add daily task grouping`).

## Task 2: Daily board and filter interactions

**Files:** modify `src/client/Board.tsx`, `src/client/App.tsx`, `src/client/styles.css`; extend `tests/browser/board.spec.ts`.

- [ ] Inspect callers, browser fixtures, applicable spec/validation, current DESIGN.md, and Impeccable craft-floor before UI edits.
- [ ] Add browser scenarios for group order, combined status/partner filtering, reset, result count, empty results, and completing an overdue task.
- [ ] Implement approved hierarchy, real partner initials with name labels, all-status chips, summary, grouped semantic lists, date clock, and responsive creation action. Preserve App save/auth/sync logic.
- [ ] Preserve focus when a status change moves a task between groups; suppress unnecessary announcements during polling.
- [ ] Apply visual tokens consistently to board and existing task dialog; retain labeled native status controls and deadline details.
- [ ] Run browser scenarios against local fixtures only; present diff for review before commit (`feat(board): introduce Nuestro día interface`).

## Task 3: Validate and document

**Files:** existing browser accessibility/offline/deadline suites; design documentation after the required document workflow choice.

- [ ] Run typecheck, unit tests, integration tests, build, and browser tests with local Worker/auth emulator prerequisites from README. Record actual results and blockers.
- [ ] Inspect rendered desktop and mobile at 320px and a typical phone size; check long content, keyboard navigation, 200% text zoom, offline/reconciliation feedback, and reduced motion.
- [ ] Capture desktop/mobile evidence, run Impeccable detector on changed UI targets, and obtain the skill-required independent finish review. Resolve material findings and recapture.
- [ ] Ask the required refresh/merge/overwrite choice before updating existing DESIGN.md; preserve user changes and regenerate sidecar consistently.
- [ ] Provide final diff and validation evidence for user review. Commit reviewed logical units only. Do not push or create a PR without explicit completion confirmation.
