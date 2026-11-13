# Feature Specification: Makefile Development Commands

**Feature Branch**: feature/makefile-commands

**Created**: 2026-11-13

**Status**: Draft

**Input**: Provide Makefile commands to serve the local environment, run the project test suite, apply recorded database migrations, and deploy to selected environments.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Serve the local environment (Priority: P1)

A developer starts the local demonstration environment with `make serve` so they can work on the application without coordinating each service manually.

**Why this priority**: A repeatable local environment supports everyday development.

**Independent Test**: With documented prerequisites installed and ports available, run the command and open the local application.

**Acceptance Scenarios**:

1. **Given** the documented local prerequisites and configuration, **When** the developer runs `make serve`, **Then** local data is prepared, the authentication emulator and application start, and the application is available for use.
2. **Given** a missing prerequisite or occupied required port, **When** the developer runs `make serve`, **Then** the command fails with an actionable indication of the problem.
3. **Given** the environment is running, **When** the developer stops the command, **Then** the services started by that command stop.

### User Story 2 - Run project checks (Priority: P2)

A developer runs `make test` to assess the project with one command and obtain a reliable result.

**Why this priority**: A consistent check reduces the chance of overlooking a suite before review.

**Independent Test**: Run the command with its documented prerequisites, then introduce a controlled failing check and verify the failure is reported.

**Acceptance Scenarios**:

1. **Given** the documented prerequisites, **When** the developer runs `make test`, **Then** type checking, unit and integration tests, the build, and browser tests run with the local services they require.
2. **Given** any required check fails, **When** the command finishes, **Then** it reports failure and identifies the failed step.
3. **Given** the checks finish or fail, **When** the command exits, **Then** services started by the command are stopped.

### User Story 3 - Deploy to a selected environment (Priority: P3)

An authorized developer deploys the application to an explicitly selected configured environment using `make deploy ENV=dev`, avoiding an implicit destination.

**Why this priority**: A repeatable deployment command makes the intended destination visible.

**Independent Test**: Verify destination selection and rejection of invalid inputs without publishing, then deploy to an authorized configured environment when appropriate.

**Acceptance Scenarios**:

1. **Given** a configured environment, required credentials, and its deployment configuration, **When** the developer selects it with `make deploy ENV=<environment>`, **Then** the application is built and deployed to that environment.
2. **Given** no environment or an unsupported environment, **When** the developer runs the deployment command, **Then** it fails before building or publishing and explains the selection needed.
3. **Given** pending remote database migrations, **When** the application is deployed, **Then** the deployment command does not apply them.

### User Story 4 - Apply migrations (Priority: P2)

A developer writes and reviews versioned SQL migrations using the existing workflow and applies recorded migrations using `make migrate`. With `ENV` omitted or set to `local`, migration application targets local D1; `ENV=dev` targets the configured remote dev database. An explicitly empty or unsupported value is rejected.

**Independent Test**: Write a representative migration and apply it to an isolated local database. Check environment routing using controlled substitutes before any remote operation.

**Acceptance Scenarios**:

1. **Given** recorded pending migrations, **When** the developer runs `make migrate` with no `ENV`, **Then** the migrations are applied to local D1 only.
2. **Given** a supported, configured environment and appropriate authorization, **When** the developer runs `make migrate ENV=<environment>`, **Then** pending migrations are applied to that environment's database.
3. **Given** an unsupported or incomplete environment, **When** the developer runs `make migrate ENV=<environment>`, **Then** the command fails before applying migrations without falling back to another database.
4. **Given** no pending migrations, **When** the developer runs `make migrate`, **Then** it reports that there is nothing to apply and succeeds.

### Edge Cases

- Missing local configuration, dependencies, credentials, or required ports result in an actionable failure; the commands do not silently use production services for local work.
- Service startup or any preparation step fails: the command reports failure and stops services it started.
- An interrupted command stops services it started without stopping services it did not start.
- An environment exists in name but lacks required configuration: deployment or migration fails rather than targeting a different environment.
- Migration application fails: report the failure without silently claiming success or targeting another database.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide `make serve`, `make test`, `make deploy ENV=<environment>`, and `make migrate [ENV=<environment>]` as documented entry points.
- **FR-002**: Serving MUST prepare the local demonstration data and start the local authentication and application services using local-only configuration.
- **FR-003**: Testing MUST run type checking, unit tests, integration tests, the application build, and browser tests, providing their required local services.
- **FR-004**: Serving and testing MUST report failures and clean up services started by their invocation on completion, failure, or interruption.
- **FR-005**: Deployment MUST require an explicit supported, configured environment and build and publish the application to that destination without falling back to another environment.
- **FR-006**: Deployment MUST NOT apply remote database migrations; documentation MUST explain that migrations are a separate operation.
- **FR-007**: The commands MUST communicate missing prerequisites, configuration, port conflicts, and failed steps with actionable messages and a nonzero result on failure.
- **FR-008**: Project documentation MUST explain each command, its prerequisites, supported environments, and any separately required deployment preparation.
- **FR-009**: Local preparation and automated tests MUST NOT target production services, and command output MUST NOT expose credentials, tokens, or task contents.

- **FR-010**: `make migrate` MUST apply recorded pending migrations to local D1 when `ENV` is omitted, and to the explicitly selected supported, configured environment when `ENV` is supplied (`local` for local D1, `dev` for remote dev); an explicitly empty value is invalid, and it MUST reject invalid destinations without fallback.
- **FR-011**: Migration application MUST report failures and MUST NOT expose credentials, tokens, or task contents. Documentation MUST identify review, authorization, and destination prerequisites.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With documented prerequisites satisfied, a developer can start the local environment using one command and reach the application.
- **SC-002**: One test command executes all five required categories of checks and returns failure for each deliberately failing category.
- **SC-003**: Every deployment attempt with a missing or unsupported environment is rejected before publishing; a valid selected environment is the deployment destination.
- **SC-004**: All services started by a command are stopped after normal completion, failure, or interruption in verification scenarios.
- **SC-005**: A developer following the documentation can identify the prerequisites and separate migration step for all four workflows.
- **SC-006**: Applying a hand-written representative migration to an isolated local database produces the intended schema.
- **SC-007**: Migration application with no environment targets only local D1; a valid selected environment is the sole target, and invalid selections are rejected before application.

## Assumptions

- Developers install the documented dependencies, configure local environment files, and have authorization and credentials for the chosen deployment environment.
- The existing `dev` environment is the initial deployment destination; additional environments require valid configuration before they are supported. A production environment is not currently configured.
- Developers continue to author and review numbered SQL migration files manually; migration generation is outside this feature.
- Remote migrations and production readiness checks remain separate, deliberate operations. This feature does not provision accounts, databases, or environments.
- The workflows support project maintenance and do not change board access, synchronization, user-facing Spanish content, accessibility, or notification behavior. Existing service limits and free-tier constraints remain applicable.
