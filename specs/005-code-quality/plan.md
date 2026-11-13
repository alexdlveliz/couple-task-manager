# Implementation Plan: Consistent Code Quality

**Branch**: `feature/linter-and-formatter` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: `specs/005-code-quality/spec.md`

## Summary

Add ESLint flat configuration, strict type-aware TypeScript checks, React correctness checks, and independent Prettier formatting. Provide `make lint` for read-only verification and `make format` for corrections followed by verification. Adopt the policy across existing maintained files with reviewed, behavior-preserving cleanup.

## Technical Context

**Language/Version**: TypeScript 5.9.3, ESM JavaScript; existing Node support (^22.12.0, ^24.0.0, >=26.0.0) and pnpm 12.16.1.

**Primary Dependencies**: Development-only ESLint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals, Prettier, eslint-config-prettier. Resolve and pin mutually compatible releases during installation; verify peer and engine support rather than assuming latest releases support every existing runtime.

**Storage**: Version-controlled configuration only; no application data or schema changes.

**Testing**: Existing TypeScript check, Vitest unit/integration suites, build, Playwright browser scenarios; targeted isolated command and diagnostic verification.

**Target Platform**: Contributor machines supporting the existing Node/pnpm/Make workflow.

**Project Type**: Development tooling for an existing React PWA and Cloudflare Worker.

**Performance Goals**: One command per workflow; deterministic results and idempotent formatting. No new timing SLA.

**Constraints**: No services or secrets needed for quality checks; zero warnings accepted; no blanket strict-rule suppression; no modification of AGENTS.md without explicit authorization.

**Scale/Scope**: Maintained source, tests, scripts, configuration, documentation, and supported text assets throughout the repository.

## Constitution Check

Pre-research gate: PASS. Principles I–II require preserving equal access, authoritative storage, revisions and offline behavior. Principle III requires preserving existing notification behavior without implementing extensions. Principle IV requires excluding secrets and local state and avoiding sensitive diagnostic content. Principle V requires preserving Spanish UI and accessibility. Principle VI is satisfied by local development-only tools with no new hosted or paid services. Existing platform choices remain unchanged.

Post-design gate: PASS. No API, data model, deployment, authorization, or product changes are designed. Validate behavior-preserving cleanup using existing suites and review sensitive paths. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/005-code-quality/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/commands.md
```

### Source Code (repository root)

```text
eslint.config.mjs          # new flat lint configuration
.prettierrc.json            # new formatting policy
.prettierignore             # new explicit coverage exclusions
package.json               # tool dependencies and scripts
pnpm-lock.yaml             # resolved dependency versions
Makefile                   # lint and format targets
README.md                  # conventions and commands
scripts/quality.mjs         # small stage runner with reliable status handling
src/                       # baseline lint and format adoption
tests/                     # adoption plus meaningful command checks
scripts/                   # JavaScript/TypeScript adoption
*.config.ts                # tooling configuration adoption
specs/                     # supported documentation formatting
```

**Structure Decision**: Extend the existing single package. No new application subsystem. Inventory tracked and eligible untracked maintained files, including dot-directories, before defining ignore patterns. Do not exclude all hidden directories or all specs.

## Design Decisions

- Use flat ESLint configuration with @eslint/js recommended rules for JavaScript and typescript-eslint strictTypeChecked for TypeScript. Retain tsc strict checking. Use projectService for files included in tsconfig; root TypeScript configs already match its include patterns. Declaration files remain covered. Fail on unused disable directives and warnings.
- Scope browser globals to client files and Node globals to maintenance/config files. Use appropriate Worker globals without enabling unrestricted browser or Node globals everywhere. Apply React Hooks recommended correctness rules to React code.
- Use ESLint recommended checks for maintained .js/.mjs/.cjs files; do not claim type-aware checking for JavaScript or enable checkJs across the repository as part of this feature.
- Place eslint-config-prettier last; run Prettier independently rather than as an ESLint rule. Use two spaces, semicolons, double quotes, trailing commas, LF and 80-column print width. Preserve Markdown prose wrapping to minimize editorial churn.
- Prettier covers supported TS/JS, JSON/JSONC, YAML, Markdown, CSS and HTML. SQL, Makefiles, shell scripts, lockfiles and binary assets have no promised formatting or lint coverage; document this limit. Do not add unrelated format plugins.
- Exclude dependencies, build output, coverage, reports, caches, local emulator/Worker state, environment secrets and generated files explicitly. Exclude pnpm-lock.yaml from formatting because the package manager owns it. Exclude AGENTS.md from rewriting because repository instructions require explicit permission; document this policy exception.
- Add package scripts lint, lint:fix, format:check, format and quality; names and behavior are specified in the command contract. Keep existing Make entry points unchanged.
- Implement a small process runner using inherited output and argument arrays. Run each requested stage even after a prior lint failure, aggregate failure, and label stages. Corrections must still format when lint fixes leave unresolved errors, then run all read-only checks. No network, service setup, ENV selection, or deployment behavior.

## Implementation Sequence and Review

1. Add pinned compatible tools, policies, coverage rules, package commands and Make entry points.
2. Apply mechanical formatting separately from manual lint corrections. Before modifying functions inspect callers and relevant tests. Prefer unknown plus validation at untrusted boundaries; preserve runtime contracts and avoid assertions that merely silence diagnostics.
3. Verify command aggregation, representative diagnostics, coverage, exclusions and idempotence; update contributor documentation.
4. Run the existing complete validation workflow after cleanup. Record commands, results and blockers accurately.

Show logical diffs for user review before each incremental Conventional Commit. Never commit without review, push, or create a PR during this workflow. Generate implementation tasks separately with speckit-tasks.

## Validation Strategy

Use isolated scratch worktrees or fixture copies for intentional violations so project source is restored reliably. Demonstrate unused bindings, explicit any, unsafe typed access, broken Hooks usage, formatting drift, and a compiler-only error. Include application, test, script, and configuration examples. Check command statuses, read-only file hashes, formatting idempotence, exclusions, and failure aggregation. Test the runner with controlled child commands rather than mirroring configuration text in brittle tests. Existing regression suites validate actual behavior after cleanup; no new product tests are needed solely for whitespace.
