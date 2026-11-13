# Tasks: Consistent Code Quality

**Input**: Design artifacts in `specs/005-code-quality/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/commands.md, quickstart.md

**Organization**: Tasks follow user-story priorities. Verification scenarios are required by the specification; targeted command tests exercise behavior rather than configuration text.

**Format**: `- [ ] Tnnn [P?] [USn?] Description with path`. [P] denotes independent file work once stated prerequisites are complete.

## Phase 1: Setup

- [x] T001 Verify `feature/linter-and-formatter`, inspect callers and existing workflow tests, and inventory maintained tracked/untracked files and exclusions; record coverage and compatibility findings in specs/005-code-quality/research.md before changing functions.
- [x] T002 Install and pin mutually compatible development versions of ESLint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals, Prettier and eslint-config-prettier in package.json and pnpm-lock.yaml; verify peer dependencies and existing supported Node engine ranges without changing runtime requirements.

## Phase 2: Foundational

**Purpose**: Shared policies required by all workflows. Complete before story implementation.

- [x] T003 [P] Add eslint.config.mjs with flat recommended JavaScript rules, strictTypeChecked TypeScript rules, projectService and repository tsconfigRootDir, scoped client/Worker/Node globals, React Hooks correctness, zero tolerated warnings and unused suppression errors; keep tsconfig.json strict and declare narrow justified exceptions only.
- [x] T004 [P] Add .prettierrc.json and .prettierignore with two spaces, semicolons, double quotes, trailing commas, LF, 80-column width and preserved prose wrapping; cover supported maintained text including eligible dot-directories, excluding generated output, dependencies, caches, local state, secrets, pnpm-lock.yaml and protected AGENTS.md.
- [x] T005 Reconcile lint and format coverage in eslint.config.mjs and .prettierignore against T001 inventory, place eslint-config-prettier/flat last, and verify effective TS/TSX/MJS configurations with the conflict helper; document unsupported formats and justified exclusions in specs/005-code-quality/research.md.

## Phase 3: User Story 1 — Check project conventions (P1, MVP)

**Goal**: One read-only Make command reports lint, formatting and type findings across maintained files.

**Independent test**: Run against a compliant isolated fixture and controlled convention, formatting and compiler failures; all stages run, failures remain nonzero, and file hashes stay unchanged. Existing repository cleanup is delivered in US3, so pre-adoption repository findings are expected.

- [x] T006 [US1] Add failing behavioral checks in tests/unit/make-lint.test.ts for Make dispatch, all-stage execution, earlier failure preservation, labeled diagnostics, missing commands/configuration, and interruption stopping the active child and subsequent stages; use controlled child processes rather than real services.
- [x] T007 [US1] Implement check mode in scripts/quality.mjs using argument arrays and inherited output, labeled sequential lint/format-check/typecheck stages, aggregated failure, actionable spawn errors and signal cleanup without network, ENV selection, credentials or service startup; satisfy T006.
- [x] T008 [US1] Wire repository-local lint, format:check and quality package scripts in package.json and a phony lint target in Makefile invoking the runner; preserve existing typecheck and serve/test/migrate/deploy behavior.
- [x] T009 [US1] Execute isolated positive/negative coverage checks for unused script bindings, explicit any, unsafe TypeScript operations, Hooks violations, documentation/configuration drift and a compiler-only error across src/, tests/, scripts/ and root configuration; verify excluded fixtures are untouched and record commands, diagnostic identifiers, file hashes and outcomes in specs/005-code-quality/validation.md.

**Checkpoint**: US1 is demonstrable without automatic correction or whole-repository cleanup.

## Phase 4: User Story 2 — Apply consistent formatting and safe fixes (P2)

**Goal**: One Make command attempts safe lint fixes and formatting, then verifies remaining findings.

**Independent test**: An isolated fixable fixture is corrected and a second run is unchanged; a manual violation still causes failure while formatting and all verification stages execute.

- [x] T010 [US2] Add failing behavioral checks in tests/unit/make-format.test.ts for fix/format/check ordering, formatting after unresolved lint findings, final failure preservation, second-run idempotence, exclusions and interruption cleanup per specs/005-code-quality/contracts/commands.md.
- [x] T011 [US2] Extend scripts/quality.mjs with correction mode that attempts lint:fix and format despite ordinary stage failures, then all check stages, preserves any failed stage and stops on interruption; satisfy T010 while retaining US1 behavior.
- [x] T012 [US2] Add lint:fix and format package scripts to package.json and a phony format target in Makefile invoking correction mode; keep package format limited to Prettier as defined in contracts/commands.md.
- [x] T013 [US2] Run isolated mixed fixable/manual-finding, repeat-run, missing-prerequisite and protected-file scenarios from quickstart.md and record actual statuses and before/after hashes in specs/005-code-quality/validation.md.

**Checkpoint**: Both workflows work independently of local application services; full baseline adoption follows.

## Phase 5: User Story 3 — Adopt the baseline confidently (P3)

**Goal**: Existing maintained files comply and contributors can use the workflow without behavior changes.

**Independent test**: Follow README.md setup, run make lint successfully across the adopted checkout, prove make format idempotence and pass existing regression checks.

- [x] T014 [US3] Apply mechanical formatting to in-scope src/, tests/, scripts/, root configuration, README.md, QUICKSTART.md, specs/ and eligible maintained dot-directory files according to .prettierignore; isolate this diff from manual fixes and leave AGENTS.md unchanged.
- [x] T015 [US3] Resolve remaining lint findings in src/client/, src/worker/ and src/shared/ after inspecting callers and relevant tests; use validated unknown at untrusted boundaries, preserve authorization/revision/offline contracts and Spanish/accessibility behavior, and avoid assertions or blanket suppressions that hide unsafe code.
- [x] T016 [US3] Resolve remaining findings in tests/, scripts/, eslint.config.mjs, scripts/quality.mjs and root *.config.ts after caller/test inspection; justify narrow invalid-fixture exceptions without disabling project-wide strict rules or changing test meaning.
- [x] T017 [US3] Document setup, make lint versus make format, individual package scripts, supported formats, JavaScript typing limits, exclusions, AGENTS.md protection and exception policy in README.md; update specs/005-code-quality/quickstart.md to the actual commands and prerequisites.
- [x] T018 [US3] Run make lint and make format twice on the adopted checkout, verify zero warnings, read-only checks and no second-run changes, rerun effective configuration conflict checks, and record outcomes in specs/005-code-quality/validation.md.
- [x] T019 [US3] Run existing strict typecheck, unit and integration suites, build and browser scenarios using README.md local prerequisites or make test; verify access control, offline synchronization, Spanish content and accessibility, and record only actual results and blockers in specs/005-code-quality/validation.md.

**Checkpoint**: Existing files pass the policy, correction is stable, documentation is runnable and behavior preservation has evidence.

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 Audit FR-001–FR-010 and SC-001–SC-005 against implementation and evidence in specs/005-code-quality/validation.md; verify no secrets/local artifacts entered diffs, AGENTS.md is unchanged, no global rule weakening occurred and existing Make contracts remain intact.
- [ ] T021 Present focused tooling, mechanical formatting, manual correction, tests and documentation diffs for user review; record review/validation status in specs/005-code-quality/validation.md and make incremental Conventional Commits only after the relevant diff is reviewed. Do not push or create a PR without the separately required user confirmation.

## Dependencies & Execution Order

```text
T001 → T002 → (T003 ∥ T004) → T005
  → US1: T006 → T007 → T008 → T009
  → US2: T010 → T011 → T012 → T013
  → US3: T014 → T015 → T016 → T017 → T018 → T019
  → T020 → T021
```

US2 depends on the US1 runner and package entry points. US3 adoption requires both workflows, but US1 and US2 are independently verifiable using compliant isolated fixtures before the repository-wide cleanup. Do not parallelize commands that mutate the same checkout or run whole-project formatting while another task edits it.

## Parallel Execution Examples

- Foundation: T003 (eslint.config.mjs) and T004 (.prettierrc.json/.prettierignore) can run concurrently after T002; T005 reconciles their exclusions.
- US1: after T008, individual T009 fixture checks can run in separate disposable directories; aggregate evidence sequentially in validation.md. Runner edits and Make/package wiring remain sequential.
- US2: after T012, T013 fixable and manual-error scenarios can run in separate disposable directories; do not share fixtures or evidence writes.
- US3: after T014, independent client and Worker manual findings within T015 may be handled concurrently only after confirming no shared caller/contracts edits. Default to sequential T015/T016; whole-repository correction and validation must be serialized.

## Implementation Strategy

Deliver the foundation and US1 first as the MVP: reviewers can inspect a read-only policy and reliable diagnostics without accepting automatic rewriting. Add US2 correction behavior next, then deliver US3 as separated mechanical and semantic adoption diffs. Run meaningful command tests before runner changes; use existing regression suites for cleanup. At each logical unit, present the diff for review before committing; the final review task does not defer earlier review opportunities. No schema, API, production service, CI, hook or editor integration is part of this feature.
