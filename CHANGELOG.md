# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

- No unreleased entries yet.

## [0.2.0-rc.1] - 2026-03-20

### Added

- Legality field family:
  - `f:`, `format:`, `legal:` -> `legalities.<format> = "legal"`
  - `banned:` -> `legalities.<format> = "not_legal"`
  - `restricted:` -> `legalities.<format> = "restricted"`
- Date and year fields against `released_at`:
  - `date` with `:`, `=`, `>`, `>=`, `<`, `<=` (expects `YYYY-MM-DD`)
  - `year` with `:`, `=`, `>`, `>=`, `<`, `<=` (compiled as year-bounded date ranges)
- New helper exports:
  - `compileLegalityField`
  - `compileDateField`
  - `compileYearField`
- Goal-level engine tests for legality equality semantics and date/year equality behavior.

### Changed

- `name=` / `n=` now use include-style weighted name search behavior (same family as `name:`).
- Quoted name input (`name="..."`) remains phrase behavior.
- Exact-name bang (`!fire`) remains strict keyword exact matching.

### Fixed

- Documentation sync for renamed `docs/SYNTAX-COVERAGE.md`.
- RC maintenance and handoff checklists aligned to current validation/release flow.

### Known Limits

- `date` does not currently support set-code style shortcuts (for example `date>ori`).
- Fielded bang forms (`!name:...`, `!o:...`) remain intentionally unsupported.
- Full Scryfall parity for `has:`/regex/expanded shortcut families remains out of scope for this RC.
