# Local fixtures

Use these credentials only with the local Firebase Auth emulator:

| Account | Password |
| --- | --- |
| partner-a@example.test | local-demo-password-a |
| partner-b@example.test | local-demo-password-b |
| outsider@example.test | local-demo-password-outsider |

The seeder only connects to the local demo project and local D1. It refuses to replace existing partner UIDs ; display-name updates advance the board revision atomically.
