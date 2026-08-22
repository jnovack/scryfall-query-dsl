# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

- No unreleased entries yet.

## [0.2.0] - 2026-08-22

### Added

- `engine.describeFields({ profile })` — the keyword reference, readable at
  runtime from the loaded bundle. Returns every field the profile actually
  compiles (names, aliases, operators, type, description, examples), grouped
  the way the reference page groups them, as a detached JSON-safe snapshot.
  In-app syntax help should be built from this instead of copying the docs: a
  copy has no failing test when a field is added here, which is how `otag:`
  shipped in `0.2.0-rc.2` with no consumer awareness.
- `KEYWORD_GROUPS` export — the group skeleton (section ids, labels, notes,
  unimplemented-syntax entries) for consumers assembling their own renderer.
  Deep-frozen, since it is shared by every engine instance in the realm.
- Keyword reference cards for the `is:` shortcuts that previously existed only
  in prose: `is:commander`, `is:promo`, `is:spotlight`, `is:digital`,
  `is:default`. A test now fails if a semantic shortcut ships without a card.

### Changed

- The keyword group data moved from `scripts/generate-keyword-docs.mjs` to
  `src/fields/groups.js` so it ships in the browser bundle. The generator now
  renders that data instead of owning it, and both it and `describeFields()`
  derive group membership from one shared helper.
- Fields belonging to no declared group now render in a trailing `Other Fields`
  section instead of being warned about and dropped. A group entry naming an
  unknown field throws rather than rendering a silently shorter page.

## [0.2.0-rc.2] - 2026-08-20

### Added

- Oracle/function tag field family:
  - `otag:`, `oracletag:`, `function:` -> `term` query against `otag_terms`
    (one field, two aliases; ancestor expansion happens upstream at index
    time, so this field only ever emits a single exact-term query).
  - `normalizeOracleTagValue` canonicalizes slugs and human phrases
    (`otag:"mana rock"` -> `mana-rock`) to match moxfall's
    `canonicalOracleTagTerm` term contract exactly.
- Golden cross-repo regression test (`test/oracle-tag-golden.test.js`)
  comparing raw-corpus canonicalization against moxfall's landed Go
  normalizer output.

### Changed

- Keyword reference docs (`website/keywords.html`) and
  `docs/SYNTAX-COVERAGE.md` updated: Tagger Tags moved from Unsupported to
  Partial now that `otag:`/`oracletag:`/`function:` are supported. Art tags
  (`art:`, `atag:`) remain unimplemented.

### Known Limits

- Art/illustration tags (`art:`, `atag:`) remain unsupported; their
  association semantics differ from oracle-level function tags.
- Browser activation of `otag_terms` search in moxfall remains gated
  separately on that repository's index rollout; this release only ships the
  DSL-side support.

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
