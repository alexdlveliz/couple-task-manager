# Data Model: Consistent Code Quality

No persisted application entities, schema changes, migrations, or API payload changes are required.

## Configuration concepts

- **Quality policy**: version-controlled rule sets, file applicability, formatter options, and justified exclusions.
- **Diagnostic**: stage, file path, available location, rule or compiler identifier, and actionable message. Uses native tool output; no diagnostic database or custom schema.
- **Workflow result**: success only when all required stages succeed; otherwise nonzero. Corrections transition files toward compliance, with remaining manual findings reported.

The command contract defines observable workflow states. Existing task, partner, revision and offline snapshot models are unchanged.
