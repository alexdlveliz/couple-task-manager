# MVP Validation: Consistent Code Quality

Date: 2026-11-13. Scope: T001–T009 only, on `feature/linter-and-formatter`.

## Commands and results

| Check                                                                                                  | Result                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Baseline `pnpm run typecheck`                                                                          | PASS                                                                                            |
| Baseline `pnpm run test:unit`                                                                          | 106/106 PASS outside sandbox                                                                    |
| Runner TDD, `pnpm exec vitest run --project unit tests/unit/make-lint.test.ts`                         | Initial 7/7 failed with missing runner/Make target; 7/7 passed after implementation             |
| No-install preflight regression                                                                        | 6 failures before child override; 7/7 passed afterward                                          |
| Fresh review regressions                                                                               | 8 credential-ignore tests and 1 descendant-cleanup test failed before fixes; final 16/16 passed |
| Final `pnpm run test:unit`                                                                             | 122/122 PASS, 12 files, with local port/process permissions                                     |
| Final `pnpm run typecheck`                                                                             | PASS                                                                                            |
| `pnpm exec eslint eslint.config.mjs scripts/quality.mjs tests/unit/make-lint.test.ts --max-warnings 0` | PASS                                                                                            |
| `pnpm exec eslint-config-prettier src/shared/contracts.ts src/client/App.tsx scripts/quality.mjs`      | PASS: no unnecessary/conflicting rules                                                          |
| `pnpm install --lockfile-only --offline --strict-peer-dependencies`                                    | PASS                                                                                            |
| Recursive package engine audit                                                                         | 130 packages checked, no conflicts at Node 22.12.0, 24.0.0, 26.0.0                              |
| `git diff --check`                                                                                     | PASS                                                                                            |

The initial sandbox unit run failed 17 pre-existing workflow tests because local port/process operations were restricted (EPERM). The same baseline suite passed with appropriate permissions. Node here was 24.20.0 and pnpm 12.16.1; older supported runtimes were audited through package engine metadata, not executed.

No integration, build or browser suite is claimed for this tooling MVP. Full baseline adoption and application regression verification remain T014–T019. No services, fixtures or migrations were run against production.

## Real isolated diagnostic checks

Executed `python3 /private/tmp/verify-quality-mvp.py` using a disposable directory containing copies of the policies, runner, Makefile and tsconfig, with independent per-package dependency links. It invokes real `make lint`, ESLint, Prettier and tsc. Initial fixture content is formatted once before taking hashes; each scenario changes only its named controlled input and restores it afterward. No real credentials are used. Raw logs and full per-file SHA-256 maps for this run are local artifacts at `/var/folders/gk/b24b3dln5yb4ny_l3pyfx12h0000gn/T/quality-mvp-8qas83xw`.

Every row attempted all three labeled stages. SHA-256 maps of every maintained fixture file were identical before/after each invocation. Make reports exit 2 for a failing recipe; the runner itself reports 1 for ordinary failure, 130/143 for interruption. The compiler-only scenario passed lint and formatting and failed with TS2322.

| Scenario                | Make exit | Expected diagnostic                        | Unchanged corpus SHA-256 (before = after)                          |
| ----------------------- | --------: | ------------------------------------------ | ------------------------------------------------------------------ |
| compliant               |         0 | none                                       | `3716855e11a5287f8b8c89d4ade0949ae9926360da3c7220cd2758acd84a7014` |
| unused-script           |         2 | no-unused-vars                             | `e2e72b8f4f23c389db0e5f791721b835761c32fc86cc8029bc995927534cf345` |
| explicit-any            |         2 | @typescript-eslint/no-explicit-any         | `4c776af7539b3c09f133bffde214256db4e080b64ee1a93abe33966ea5a183a7` |
| unsafe-test             |         2 | @typescript-eslint/no-unsafe-member-access | `ad782010b1fa0a831bc4fdaf21d42c75dc25bf71a2e0579bb15f9d7b0c6f4f34` |
| hooks                   |         2 | react-hooks/rules-of-hooks                 | `a06668e45f9006c600e4d3266e9296298fc7839126cd05d48a9d6831d6d0cbfd` |
| root-config             |         2 | @typescript-eslint/no-unused-vars          | `2affdd3a520bd14686fca77b956db6fa8331721cd16471268c4947f7f8329fa6` |
| compiler-only           |         2 | TS2322                                     | `8ed46bd341656a399f42f73db96d9bfea4d8c04db546baf335e016080a4425e1` |
| documentation           |         2 | README.md                                  | `793b8f8a836d0f3a1b74f9a3cad7f398ccb4700f92f749a5c101b038458d7e10` |
| configuration           |         2 | policy.json                                | `0f8360c0656b062ecf181cc75ac5383b4fbb4ca6665f9196c7f3fd1f8be6b352` |
| hidden-agents           |         2 | .agents/policy.md                          | `f452d584d561f18665ae79a752d3637f7b1bfb46c148e31fb1e20815f27a0c9b` |
| hidden-specify          |         2 | .specify/policy.json                       | `2cec350bfa8c3071afac24918a0711492b57f615a9a8b947e2baabcd8b868e6c` |
| warning                 |         2 | maximum: 0                                 | `be497747184a14f0db2d5187a6def497cbcf09854f59d064aa1e0fb2b493e32d` |
| unused-suppression      |         2 | Unused eslint-disable directive            | `75a107ba4f3e7b6525e2d79865ee8d2cc17db0cd33ed21e03fc8c09783423fd8` |
| invalid-eslint-config   |         2 | SyntaxError                                | `c9ffad9bd2776695b58b0d24f926eb9451365c1931f7df98a6b36ea354c126cc` |
| invalid-prettier-config |         2 | prettierrc                                 | `5bc6533baa83968d373167f0d010db449a8e16f7d1c8e563e900aa7e1185c4f3` |
| exclusions              |         0 | none                                       | `10a93da86f0e4a324ae2ad2fc5f419f9b2b34ab13f4569eccac1b0158673b569` |
| missing-tool            |         2 | not found                                  | `5b05f71aed8ed594d893e2cff75c8dd4da698175e837c1f384e09daeee2385a2` |

Corpus digests are SHA-256 over the sorted JSON object mapping relative file paths to their full SHA-256 content hashes. The excluded fixture includes malformed files under dist/build/coverage, reports, Worker/Firebase state, caches, worktrees, Spec Kit local integration state, secrets, environment paths, lockfile and AGENTS.md. It still succeeds, preserves all bytes, and reports AGENTS.md ignored through Prettier's file-info API. Separate automated checks verify `.secret.json`, `.secret.yaml`, `.secret.yml`, `.pem`, `.key`, `.p12`, `.pfx` and `.crt` exclusions using the actual ignore policy.

The command tests use controlled external children to verify order, diagnostics, aggregate status, missing pnpm, and signal handling. They verify both SIGINT/SIGTERM and a pnpm-like parent exiting before its signal-ignoring descendant; the runner waits for forced group cleanup and launches no further stages.

## Actual repository checkpoint

`make lint` returned 2 as expected before US3 cleanup. It attempted all stages and preserved all 149 maintained files in the checkpoint snapshot (tracked plus eligible untracked files). Before/after corpus SHA-256: `daa646c6fa267a08179dea5de6ff46f5ca57864ba4ad6171e90543bd5d5c4333`. This snapshot preceded creation of this validation document.

The diagnostic inventory found 62 linted files, 187 errors and 0 warnings. Prettier listed 97 files with existing formatting drift. The compiler passed. These baseline findings are deferred work, not waived or suppressed. The new lint config, runner and tests pass their own strict lint and formatting checks.

## Scope, review and completion

- T001–T009 completed; T010 onward remain unchecked. Correction scripts and `make format` are not implemented.
- Supported lint categories: maintained JS/MJS/CJS with recommended JavaScript checks; TS/TSX/MTS/CTS, including declarations, with strict typed checks. JavaScript is not type-checked. Client Hooks and environment globals are scoped.
- Supported formatting categories: maintained JS/TS, JSON/JSONC, YAML, Markdown, CSS, HTML, SVG and webmanifest via a JSON override, including eligible maintained dot-directories. Unsupported formats and exclusions are recorded in research.md.
- A fresh independent review found credential ignore syntax and descendant cleanup issues; both were reproduced with failing tests and fixed. No deferred review findings remain.
- pnpm install preflights are disabled explicitly; dependency installation is a separate prerequisite. This changes implicit installation behavior for other package commands as documented in research.md, without changing existing Make dispatch or application behavior.
- No extension configuration exists, so no before/after hooks are registered. Checklist markers and AGENTS.md are unchanged. No application code, runtime requirement, schema or API changed.
- Changes are uncommitted and await user diff review. No push or PR was performed.
