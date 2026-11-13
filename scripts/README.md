# Local fixtures

Use these credentials only with the local Firebase Auth emulator:

| Account | Password |
| --- | --- |
| partner-a@example.test | local-demo-password-a |
| partner-b@example.test | local-demo-password-b |
| outsider@example.test | local-demo-password-outsider |

The seeder only connects to the local demo project and local D1. It refuses to replace existing partner UIDs ; display-name updates advance the board revision atomically.

Versioned SQL migrations are authored and reviewed manually in `migrations/`. Use `make migrate` (or `ENV=local`) for local D1; `make migrate ENV=dev` applies pending migrations to the configured remote dev database without an additional interactive prompt. Review the SQL and database destination and supply Cloudflare authorization before running the remote command.
