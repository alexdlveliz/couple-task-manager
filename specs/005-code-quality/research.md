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
