# Validation Guide: Consistent Code Quality

These commands describe the planned implementation; they are not available until implementation is complete.

## Prerequisites

Use the supported Node runtime and pnpm 12.16.1 from README.md, plus Make. Run `pnpm install --frozen-lockfile` from the repository root after the new lockfile is available. Quality checks need no local services or credentials.

## Baseline

1. Run `make lint`. Expect labeled lint, formatting and compiler checks, zero warnings and exit status zero.
2. Compare maintained file contents before and after checking; expect no changes.
3. Run `make format`, review the diff, then run it again. Expect the second invocation to produce no changes and succeed.
4. Confirm documented coverage includes src, tests, scripts, root configuration, Markdown and eligible dot-directories; confirm excluded artifacts and secrets are untouched. See [commands](contracts/commands.md).

## Negative scenarios

Use an isolated disposable copy or fixture; never change production configuration or seed production data.

- Introduce unused code in a script, explicit any and unsafe operations in TypeScript, a Hooks violation in a component, formatting drift in documentation/configuration, and a compiler-only type error. Test each separately and expect a nonzero result with the relevant diagnostic.
- Introduce multiple categories together. Expect all verification stages to run and overall failure even if the last stage passes.
- Introduce fixable whitespace plus a manual lint issue. Run `make format`; expect formatting to apply, verification to run and final failure for unresolved issues.
- Simulate missing executables or invalid configuration with controlled command-runner fixtures; expect labeled failures and no false success.
- Place invalid content in excluded generated/secret fixture paths. Confirm those paths are neither inspected nor rewritten. Do not use real secrets as fixtures.
- Interrupt a controlled long-running stage; expect child termination, nonzero status and no subsequent stages.

Restore or discard fixtures after each scenario. Never globally relax rules to make a negative scenario pass.

## Regression validation

Follow README.md local test prerequisites. Run `pnpm run typecheck`, `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run build`, and `pnpm run test:browser` against the local auth emulator and Worker preview on port 8787. Alternatively use the existing `make test` workflow, which orchestrates these checks and local services. Stop conflicting dev processes first. Verify access, offline synchronization, Spanish content and accessibility remain intact. Record actual outcomes and any environment blockers; planning alone does not validate implementation.
