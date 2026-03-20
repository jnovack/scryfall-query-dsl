# Session Handoff

Use this file to bootstrap the next Codex session.

## Read First

Start the next session by reading these files in order:

1. `AGENTS.md`
2. `README.md`
3. `docs/syntax-coverage.md`
4. `docs/session-handoff.md`

## Current State

This project is a browser-friendly JavaScript library that parses a subset of Scryfall-style syntax into an AST and compiles that AST into Elasticsearch DSL.

The current source layout is:

- `src/parser` style logic in `src/parser/index.js`
- AST factories in `src/ast/index.js`
- compiler entrypoint in `src/compiler/index.js`
- compiler helpers in `src/compiler/helpers.js`
- built-in field definitions in `src/fields/defaults.js`
- registry and extension logic in `src/registry/index.js`
- public runtime API in `src/runtime/createEngine.js`
- version metadata in `src/runtime/version.js`

## Verified Behavior

These commands passed most recently:

- `npm test`
- `npm run build`

The build outputs:

- `dist/scryfall-query-dsl.js`
- `dist/scryfall-query-dsl.esm.js`
- `dist/scryfall-query-dsl.cjs`

The build script injects:

- `VERSION`
- `RELEASE`
- `BUILD_DATE`

The browser bundle logs a load announcement once in browser environments.

## Important Assumptions

The base built-ins must match raw Scryfall card data, not pipeline-enriched fields from other repositories.

Specifically:

- do not assume custom fields such as `slugs`
- `colors` is a keyword array of uppercase symbols: `W/U/B/R/G`
- `card_faces.colors` is a keyword array of uppercase symbols: `W/U/B/R/G` when card faces are indexed
- `color_identity` is a keyword array of uppercase symbols: `W/U/B/R/G`
- `cmc` is numeric
- `name`, `type_line`, and `oracle_text` are text fields
- `card_faces.type_line` is searchable text
- `card_faces.oracle_text` is searchable text when present in the index mapping

This assumption was validated against:

- `mtg-bulk-import/configs/cards/mappings.json`
- `mtg-bulk-import/test/cards.json`

## Built-in Syntax Supported Today

Parser-level support:

- `field:value`
- `field=value`
- `field>value`
- `field>=value`
- `field<value`
- `field<=value`
- bare terms as implicit `name:` searches
- quoted field values with escaping, such as `name:"Lightning Bolt"` and `o:"choose one or both"`
- implicit `AND`
- explicit `and`
- explicit `or`
- parentheses
- unary negation with `-`

Built-in field support:

- `c`, `color` -> `colors` OR `card_faces.colors`
- `id`, `identity` -> `color_identity`
- `mv`, `cmc` -> `cmc`
- `r`, `rarity` -> `rarity`
- `is` -> cross-referenced token shortcuts
- `not` -> cross-referenced token shortcuts
- `set` -> `set`
- `st`, `set_type` -> `set_type`
- `border`, `border_color` -> `border_color`
- `frame` -> `frame` OR `frame_effects`
- `cn` -> `collector_number`
- `usd` -> `prices.usd`
- `eur` -> `prices.eur`
- `tix` -> `prices.tix`
- `unique` -> search collapse controls
- `order` -> search sort controls
- `prefer` -> search preference controls
- `direction` -> search sort direction controls
- `lang`, `language` -> search language preference sort controls
- `o`, `oracle`, `text` -> `oracle_text` OR `card_faces.oracle_text`
- `t`, `type` -> `type_line` OR `card_faces.type_line`
- `kw`, `keyword`, `keywords` -> `keywords`
- `name`, `n` -> `name`

When search directives are present, `compile()` returns a search body with `query` plus `collapse` and/or `sort` settings instead of a plain query clause.
`unique:cards` applies an implicit ascending `name` sort when no explicit `order:` is supplied.
`lang:xx` ranks matching `lang` values first via sort without filtering out non-matching language prints.

`compileWithMeta()` is available for graceful `is:` / `not:` handling:

- returns `{ dsl, meta }`
- `meta.terms.valid` includes successfully compiled full terms (for example `is:rare`)
- `meta.terms.invalid` includes skipped unknown full terms (for example `is:bibbityboppityboo`)
- `meta.warnings` includes `UNKNOWN_IS_NOT_TOKEN` entries

Name-specific behavior:

- quoted name input compiles to `match_phrase` (for example `"lightning bolt"` or `name:"Lightning Bolt"`)
- multi-word bare input compiles to a single `name` `match` with `operator: "and"` (for example `lightning bolt`)
- single bare words still compile to `match` on `name` (for example `lightning`)

`is:` / `not:` cross-reference currently maps tokens across:

- `frame_effects`
- `promo_types`
- `set_type`
- `rarity`
- `layout`
- `image_status`
- `games`
- `finishes`
- `all_parts.component`

`is:default` is explicitly expanded as:

- `not:showcase`
- `not:extendedart`
- `-border:borderless`
- `not:fracturefoil`
- `not:etched`
- `not:stamped`
- `not:datestamped`
- `not:fullart`
- `not:surgefoil`
- `not:galaxyfoil`
- `-st:masterpiece`
- `-frame:future`
- `-frame:colorshifted`
- `not:playtest`
- `-frame:inverted`
- `-border:yellow`

Color support currently includes:

- single colors like `c:red`
- compact sets like `c:uw`
- named groups like `c:azorius`, `id:esper`
- popular nicknames across guilds, shards, wedges, colleges, and four-color groups (for example `c:altruism`)
- colorless via `c:c` and `id:c`
- multicolor via `c:m` / `c:multicolor` and `id:m` / `id:multicolor`
- comparisons with `:`, `=`, `>`, `>=`, `<`, `<=`
- `id:c` compiles to missing/empty `color_identity`
- `c:c` compiles to missing/empty `colors` and missing/empty `card_faces.colors`
- collector number comparisons are numeric-only and intentionally avoid lexicographic `keyword` ranges

## Known Gaps

The implementation is still far from full Scryfall parity.

Major missing areas:

- exact-name `!`
- regex syntax
- `!=`
- full Scryfall-parity `is:` / `not:` semantics
- `has:` / `include:` families
- mana syntax
- power/toughness/loyalty syntax
- remaining display keywords

See `docs/syntax-coverage.md` for the authoritative breakdown.

## Documentation Status

Documentation was explicitly aligned with the current code in this session.
Follow the rule in `AGENTS.md`: code changes first, then tests/build, then docs.

Files that should remain synchronized after future syntax changes:

- `README.md`
- `docs/syntax-coverage.md`
- `docs/session-handoff.md`
- `test/engine.test.js`

If syntax support changes, update those files in the same turn.

## Recommended Next Work

Highest-value next steps:

1. Add `!=` support.
2. Add exact-name `!` search behavior.
3. Expand `is:` / `not:` shortcut coverage beyond current token families (for example broader `is:*` semantic shortcuts).
4. Add first-class `has:` / `include:` syntax families.
5. Expand conformance tests section-by-section from the Scryfall syntax reference.

## Integration Gotcha

Consumer code must preserve full compiler output when present.

- `compile()` can return a full search body with top-level `query`, `collapse`, and `sort`.
- If a consumer always wraps output as `{ query: compileResult }` or always rebuilds `sort`, `unique:cards` and directive behavior will silently break.

## Notes For The Next Session

- prefer base Scryfall semantics for built-ins
- keep schema-specific enrichments behind runtime extension points
- do not let `c` drift away from Scryfall printed-color semantics again
- update `docs/syntax-coverage.md` whenever syntax support changes
