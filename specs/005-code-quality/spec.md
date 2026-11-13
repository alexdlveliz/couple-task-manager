# Feature Specification: Consistent Code Quality

**Feature Branch**: `feature/linter-and-formatter`

**Created**: 2026-11-13

**Status**: Draft

**Input**: Add ESLint and Prettier to enforce strict, standardized coding conventions, formatting, and typing throughout the project, with a Make command that runs the linter and formatter for the whole project.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check project conventions (Priority: P1)

A contributor checks all maintained project files against shared conventions before requesting review, receiving actionable findings without modifying files.

**Why this priority**: A consistent quality baseline prevents avoidable errors and review disagreements.

**Independent Test**: Introduce representative convention, formatting, and unsafe typing violations in isolated fixtures and run the documented check.

**Acceptance Scenarios**:

1. **Given** a compliant checkout, **When** the contributor runs the quality check, **Then** it succeeds without changing files.
2. **Given** a convention, formatting, or typing violation, **When** the contributor checks the project, **Then** the command fails and identifies the affected file and rule or diagnostic.
3. **Given** violations in application code, tests, scripts, or configuration, **When** checks run, **Then** every supported maintained file is covered regardless of directory.

### User Story 2 - Apply consistent formatting and safe fixes (Priority: P2)

A contributor uses one Make command to format the project and apply safe automatic lint corrections, leaving issues requiring judgment visible.

**Why this priority**: Automatic corrections reduce repetitive maintenance and make conventions easy to follow.

**Independent Test**: Run the correction command on representative noncompliant files, inspect its diff, and run it again.

**Acceptance Scenarios**:

1. **Given** fixable lint and formatting issues, **When** the correction command runs, **Then** it applies supported corrections throughout the project.
2. **Given** remaining issues requiring manual changes, **When** correction finishes, **Then** it reports them and exits unsuccessfully.
3. **Given** an already corrected checkout, **When** correction runs again, **Then** it produces no further changes.

### User Story 3 - Adopt the baseline confidently (Priority: P3)

A maintainer can review the initial cleanup and follow documentation explaining the conventions, scope, and commands.

**Why this priority**: Adoption requires the existing project to pass and contributors to understand the workflow.

**Independent Test**: Follow the documented setup on a clean checkout and run quality checks and existing project validation.

**Acceptance Scenarios**:

1. **Given** the initial adoption is complete, **When** all quality checks run, **Then** the existing maintained files pass without blanket exclusions or globally disabled strict rules.
2. **Given** a new contributor, **When** they follow the documentation, **Then** they can distinguish checking from correction and resolve reported findings.

### Edge Cases

- Generated output, dependency directories, caches, local service state, and secrets are excluded from checking and rewriting.
- Maintained files unsupported by either tool have explicitly documented coverage limitations rather than silently claimed coverage.
- Missing dependencies, invalid configuration, or tool failures produce actionable errors and a nonzero result.
- A failure in one stage cannot be hidden by a later successful stage.
- Deliberately invalid test fixtures or external boundary data require narrowly justified exceptions rather than weakened project-wide rules.
- Formatting and lint rules must not undo each other's changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST use ESLint for coding conventions and Prettier for formatting, with one shared, version-controlled policy for each responsibility.
- **FR-002**: Coverage MUST include maintained application code, tests, development scripts, configuration, and documentation wherever supported; documentation MUST identify supported file categories and exclusions.
- **FR-003**: Strict checks MUST detect unused code, violations of applicable framework correctness rules, explicit unrestricted typing, and unsafe operations on untyped values. Existing strict type checking MUST remain enabled and be included in the quality check workflow.
- **FR-004**: Contributors MUST have a documented check-only Make entry point that runs lint, formatting verification, and type checking across the project without changing files.
- **FR-005**: Contributors MUST have a documented Make correction entry point that runs automatic lint fixes and formatting across the project and checks for remaining violations, including typing errors.
- **FR-006**: Both workflows MUST return nonzero on unresolved violations, warnings, or execution failures and identify the failed stage and actionable diagnostics.
- **FR-007**: Linting and formatting policies MUST be compatible; repeated correction of compliant files MUST produce no changes.
- **FR-008**: Adoption MUST bring existing in-scope files into compliance while preserving application behavior, security controls, synchronization, offline viewing, Spanish content, accessibility, and notification behavior.
- **FR-009**: Exceptions MUST be narrow and justified; generated artifacts, dependencies, local state, and secrets MUST NOT be rewritten or inspected as project source.
- **FR-010**: Documentation MUST describe prerequisites, check and correction commands, coverage, exclusions, and the process for justified exceptions. Existing Make workflows MUST remain available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One documented command checks 100% of supported maintained files and returns success on the adopted baseline without modifying files.
- **SC-002**: Representative convention, formatting, and unsafe typing violations each produce a failing result and an actionable diagnostic in verification scenarios.
- **SC-003**: One documented correction command resolves all representative automatically correctable violations; a second run produces zero file changes.
- **SC-004**: Every verification scenario with an unresolved violation or failed stage returns a nonzero result.
- **SC-005**: Existing type checks, unit tests, integration tests, build, and browser scenarios pass after adoption with no intended product behavior changes.

## Assumptions

- Proposed entry points are `make lint` for check-only lint, formatting verification, and typing checks, and `make format` for automatic corrections followed by verification. These names are assumptions for review.
- Strictness means a documented recommended strict policy including type-aware safety checks, with narrowly justified exceptions; choosing individual rules and formatting options belongs to planning.
- Formatting covers all supported maintained text formats, including documentation. Linting and typing apply only where supported and appropriate.
- This feature includes the initial repository cleanup. New CI enforcement, commit hooks, editor integrations, and unrelated refactors are outside scope.
- The existing supported runtime and package manager remain prerequisites. These local maintenance tools add no production services, paid dependencies, or changes to free-tier operation.
