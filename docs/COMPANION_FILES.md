# Companion Files

Use this file to decide which docs to read after `AGENTS.md`.

## Read only what the task needs

- `README.md`
  - Use for quick orientation, install, quick start, supported bundle outputs, and doc map.
- `docs/API.md`
  - Use for public API contracts, runtime methods, profile APIs, validation errors, and helper exports.
- `docs/PROFILES.md`
  - Use for field definition shape, compiler helpers, profile flow, custom schema guidance, and mapping prerequisites.
- `docs/SYNTAX-COVERAGE.md`
  - Use for supported syntax, known deviations from Scryfall, planned support, and query examples.
- `docs/MAINTENANCE.md`
  - Use for release workflow, validation expectations, and documentation sync requirements.
- `CHANGELOG.md`
  - Use for shipped history only.
- `docs/session-handoff.md`
  - Use only when continuing in-progress work across sessions.

## Common task routing

- API design or public method changes:
  - `docs/API.md`
  - `README.md`
- Parser, AST, compiler, or extension-system changes:
  - `docs/API.md`
  - `docs/PROFILES.md`
  - `docs/SYNTAX-COVERAGE.md`
- Syntax parity or deviation work:
  - `docs/SYNTAX-COVERAGE.md`
  - `docs/API.md`
- Build, release, or validation work:
  - `docs/MAINTENANCE.md`
  - `CHANGELOG.md`
- Session continuation:
  - `docs/session-handoff.md`

## What moved out of `AGENTS.md`

The following material is intentionally kept out of `AGENTS.md` to reduce prompt bloat:

- Product overview and newcomer orientation -> `README.md`
- Public API shapes and usage examples -> `docs/API.md`
- Field/profile/compiler-helper detail -> `docs/PROFILES.md`
- Syntax support, parity gaps, and examples -> `docs/SYNTAX-COVERAGE.md`
- Release and maintenance workflow -> `docs/MAINTENANCE.md`
- Session-specific status and next steps -> `docs/session-handoff.md`
