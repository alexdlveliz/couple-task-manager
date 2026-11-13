# Research: Consistent Code Quality

## Strict linting and typing

**Decision**: ESLint flat configuration, @eslint/js recommended and typescript-eslint strictTypeChecked; retain strict compiler checking separately.

**Rationale**: Typed lint rules detect unsafe operations beyond compiler checks. The existing tsconfig includes src, tests, scripts and root *.config.ts. Use projectService with repository tsconfigRootDir. Use ordinary JavaScript linting for .mjs maintenance scripts rather than claiming type coverage they do not have.

**Alternatives considered**: recommendedTypeChecked is less strict; untyped checks omit unsafe operations. Broad allowDefaultProject is unsuitable: recursive ** patterns are prohibited, matching files cannot already belong to a project, and per-file overhead grows. No new JavaScript typing migration is required.

Sources checked through Context7: [Typed linting](https://typescript-eslint.io/getting-started/typed-linting/), [Shared configurations](https://typescript-eslint.io/users/configs/), [Project Service](https://typescript-eslint.io/blog/project-service/), [Parser options](https://typescript-eslint.io/packages/parser/#allowdefaultproject).

## Formatting interoperability

**Decision**: Run Prettier separately; apply eslint-config-prettier/flat last, with canonical plugin names. Check effective configuration on representative TS, TSX and MJS files using `pnpm exec eslint-config-prettier <file>`.

**Rationale**: Formatting has one owner and cannot compete with lint fixes. Native formatter verification fits the check-only contract.

**Alternatives considered**: Running formatting inside ESLint adds coupling; maintaining overlapping style rules risks repeated changes. Formatter defaults with explicit repository options are sufficient without SQL or Make plugins.

Sources checked through Context7: [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier#readme), [Conflict helper](https://github.com/prettier/eslint-config-prettier#cli-helper-tool).

## Workflow and coverage

**Decision**: `make lint` invokes aggregate read-only checks; `make format` attempts automatic fixes and formatting followed by verification. Use a small process runner to attempt all stages and preserve failures.

**Rationale**: Plain sequential Make recipes stop at the first failed stage, preventing formatting when lint leaves manual findings. The existing make test workflow needs local services, so the new quality commands remain independent. Explicit ignores protect generated artifacts, secrets and AGENTS.md.

**Alternatives considered**: Shell chaining can skip stages or hide earlier failure; reusing service orchestration is unnecessary. New CI, editor integration and commit hooks are outside scope.

## Compatibility and remaining work

Use development-only dependencies and lock compatible releases during implementation, checking ESLint/plugin peer dependencies and every supported Node line. No unresolved design clarifications remain; exact install versions are an implementation compatibility check, not a promise about current registry releases. Baseline diagnostics and cleanup size must be measured after installation; no claim is made that existing files already pass.

The setup script reports its logical feature selector as BRANCH=005-code-quality. Git itself was verified on feature/linter-and-formatter; plan metadata uses the actual Git branch. No extension hooks are configured.

## MVP execution inventory (2026-11-13)

**Current scope update:** The user subsequently excluded all Markdown files and all content under `specs/`, `.specify/` and `.agents/` from formatting; `.agents/` is also excluded from linting. Earlier inventory and fixture-coverage statements in this section are historical and do not describe the current ignore policy.

- Clean starting checkout: `feature/linter-and-formatter`, commit `cfb3882`. Work remains on this requested feature branch; no additional worktree or commits are created. The existing linked base-feature worktree is unrelated and excluded.
- Inventory: 143 maintained tracked files, no eligible untracked files initially. Supported categories include 49 `.ts`, five `.tsx`, five `.mjs`, JSON/JSONC, YAML, Markdown, CSS, HTML and SVG; `.webmanifest` is formatted with the JSON parser. Maintained `.agents/skills` and `.specify` templates/configuration remain covered.
- SQL, Makefiles, shell scripts, environment examples, Git ignore files, package-manager lockfiles and binary icons have no lint/format promise. No additional format plugins are introduced.
- Existing callers inspected: Make `serve` and `test` call their respective scripts, which consume `Supervisor` from `workflow-common.mjs`; migrate/deploy have their own runners. Existing `make-*.test.ts` tests exercise those contracts. No existing runner function needs modification: the new quality runner has different continuation/output requirements and no service dependencies.
- Baseline: `pnpm run typecheck` passed. All 106 unit tests passed outside the restricted sandbox; the initial sandbox run failed 17 existing port/process-dependent tests (EPERM), not application assertions.
- Runtime here: Node 24.20.0, pnpm 12.16.1. ESLint 10.14.0 requires Node 22.13 on the 22.x line and therefore excludes the project's 22.12 floor. Select ESLint/@eslint/js 9.39.5 instead, typescript-eslint 8.50.0, React Hooks 7.1.1, globals 17.14.0, Prettier 3.10.1 and eslint-config-prettier 10.1.8. Initially installed typescript-eslint 8.72.2 was rejected after recursive engine inspection found its eslint-visitor-keys 5.0.1 dependency also excludes Node 22.12; 8.50.0 uses visitor keys 4.2.1. The final dependency audit covered 130 packages with no engine conflicts at 22.12.0, 24.0.0 or 26.0.0; strict peer validation passed. Existing runtime requirements remain unchanged. ESLint 9 is deprecated upstream, retained here to preserve the declared Node floor.
- Ignore policy will exclude dependency/build/report/cache output, Firebase/Worker local state, worktrees, machine-local Spec Kit integration state, environment/credential material and protected `AGENTS.md`, without excluding all dot-directories. This private package requires no `.npmignore`; Docker, Terraform, Helm, and separate ESLint ignore files are not applicable.
- MVP boundary is T001–T009 only. Existing baseline violations remain visible; correction mode, repository cleanup and full-baseline adoption are deferred to US2/US3. No before/after implementation extension hooks are configured.

### Execution rulings and review

- pnpm 12 defaults `verifyDepsBeforeRun` to `install`. A disposable fixture initially linked the entire dependency directory; pnpm's preflight altered that shared local install. Restored it with `pnpm install --frozen-lockfile`, then used an independent fixture directory with per-dependency links. No application or tracked source was affected. Set `verifyDepsBeforeRun: false` in the workspace so direct package checks do not install; the runner also forces `pnpm_config_verify_deps_before_run=false` for children. Missing tools produce native diagnostics instead. This intentionally removes implicit dependency installation from other package commands too; explicit installation remains the prerequisite. See [pnpm's setting](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/settings/build.md).
- Fresh review found unsupported brace expansion in Prettier ignore patterns and cancellation of group cleanup when pnpm exited before a signal-ignoring descendant. Added failing behavioral tests, split credential exclusions into individual gitignore patterns, and await forced group cleanup using the captured PID even after the immediate child exits. All regression tests passed afterward.
- Existing feature artifacts remain the implementation plan and progress ledger; no redundant superpowers design/plan files are added. User-required diff review takes precedence over skill commit steps: changes remain uncommitted for review.
