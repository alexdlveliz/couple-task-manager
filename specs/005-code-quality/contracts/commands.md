# Quality Command Contract

Run from the repository root with installed frozen-lockfile dependencies. No credentials, ENV argument, auth emulator, Worker or database is required.

| Entry point | Required behavior | Writes maintained files |
| --- | --- | --- |
| `pnpm run lint` | ESLint repository coverage, zero warnings, unused suppression errors | No |
| `pnpm run lint:fix` | Same coverage with supported automatic corrections | Yes |
| `pnpm run format:check` | Verify Prettier coverage | No |
| `pnpm run format` | Apply Prettier coverage | Yes |
| `pnpm run typecheck` | Existing strict compiler verification | No |
| `pnpm run quality` | Run lint, formatting verification and typecheck; aggregate status | No |
| `make lint` | Invoke quality workflow | No |
| `make format` | Run lint fixes and formatting, then all quality checks | Yes |

Every required stage is labeled and attempted even when another stage reports violations. Any failed correction, unresolved violation, warning, or execution failure yields nonzero final status; later success never clears earlier failure. A correction command may therefore require a second invocation after manual resolution. Interruptions return failure and terminate the active child; do not continue launching stages after interruption.

Use repository-local binaries via package scripts. Ignore policies apply equally to check and correction. Native diagnostics identify offending files and issues; missing prerequisites/configuration produce actionable errors. No tool downloads or remote operations occur during these commands. Existing serve/test/migrate/deploy contracts remain unchanged.
