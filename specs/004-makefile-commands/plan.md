# Implementation Plan: Makefile Development Commands

**Branch**: `004-makefile-commands` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

## Summary

Provide `make serve`, `make test`, explicit-environment `make deploy`, and `make migrate` as thin entry points to supervised workflows. Reuse existing pnpm commands, local Firebase emulator and D1 migration/seeding; supervise only processes started by the invocation. Validate the deployment destination before build or publish and keep remote migrations separate.

## Technical Context

**Language/Version**: Make and shell or Node.js 22.12+; existing TypeScript project  
**Primary Dependencies**: pnpm 12.16.1, Firebase CLI/emulator, Wrangler, Vite, Playwright, OpenSSL, Java for Firebase emulator  
**Storage**: local D1 for local workflows; selected remote D1 remains untouched by migration commands during deployment  
**Testing**: existing typecheck, Vitest unit and integration, Vite build, Playwright browser suites; workflow-level tests with controlled command stubs and local end-to-end verification  
**Target Platform**: developer systems with make, Node and the documented local tooling; Worker deployment via Wrangler  
**Project Type**: development and deployment command orchestration for a web application  
**Performance Goals**: bounded readiness checks with actionable timeout; no additional performance target  
**Constraints**: local-only preparation; no secret or task content in command output; no implicit deployment destination or remote migrations during deployment; cleanup on exit, failure and interruption  
**Scale/Scope**: four developer entry points; `dev` is the sole initial deployment candidate, contingent on complete configuration.

## Constitution Check

**Pre-research: PASS.** Shared access, authoritative data and offline behavior remain unchanged. Local-only guards and redacted diagnostics protect privacy; the existing application and its Spanish accessibility behavior are unchanged. No notification behavior is added or altered: existing delivery limitations and free-tier quotas continue to apply. Existing React, Worker, D1 and Firebase architecture remains in place; deployment does not provision resources. Verification includes the existing suites and checks for local isolation, cleanup, selected destination, migration application and secret-free diagnostics. No paid service is required for normal operation; real deployment remains subject to existing service quotas.

**Post-design: PASS.** The command contracts keep deployment and migrations separate and require explicit local configuration and process ownership. Review affected access, sync, offline, Spanish, accessibility and notification behavior through existing checks; investigate any regressions without claiming these checks establish production readiness. No exception or amendment is required.

## Project Structure

```text
Makefile                     # public entry points
scripts/                     # workflow supervision and helpers
README.md                    # command and prerequisite documentation
wrangler.jsonc               # existing environment configuration
firebase.json                # local emulator configuration
package.json                 # existing project checks and builds
tests/                       # workflow checks alongside existing suites
specs/004-makefile-commands/ # plan, research, model, contract, quickstart
```

**Structure Decision**: Keep Make targets thin and put lifecycle and validation logic in focused helpers under `scripts/`; preserve the existing application and test layout. Define the developer-facing command interface in [contracts/commands.md](contracts/commands.md). No application API change is planned. Existing numbered SQL migrations remain hand-authored. Migration application defaults to local D1, accepts explicit `ENV=local`, and selects remote dev only with `ENV=dev`; reject an explicitly empty or unsupported value.
