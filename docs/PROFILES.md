# Profiles, Field Definitions, and Custom Schemas

Profiles let one query language compile against multiple Elasticsearch document layouts.

If you need method signatures (`createEngine`, `compile`, `registerProfile`, etc.), use [API.md](./API.md).
This document focuses on schema wiring: field definitions, compiler helpers, and profile composition.

## Why Profiles Exist

Use profiles when the same user query syntax must target different field paths.

Common pattern:

- `default` profile for native Scryfall-shaped docs
- `ctx.card` profile for card-nested docs (`card.*`)
- custom profile(s) for downstream/enriched collections

## Built-in Profiles

- `default`: base Scryfall-oriented built-ins
- `ctx.card`: built-in alternate profile that remaps built-in query paths to `card.*`

`ctx.card` is derived from built-ins, not manually copied. It is intended to stay in parity as built-ins evolve.

## Field Definition Shape

A field definition typically includes:

- `aliases`: alternate query names
- `esPath`: primary Elasticsearch field path
- `esPaths` (optional): multiple paths for disjunction behavior
- `type`: semantic field type label
- `operators`: explicitly supported operators
- `parseValue` (optional): input coercion/parser
- `compile`: compiler function
- optional behavior metadata depending on compiler (for example `legalityStatus`, `tokenFieldMap`)
- optional behavior metadata depending on compiler (for example `legalityStatus`, `tokenFieldMap`, `semanticShortcuts`)

Example:

```js
{
  aliases: ["ip"],
  esPath: "slugs.inclusion_percent",
  type: "number",
  operators: [":", "=", ">", ">=", "<", "<=", "!="],
  parseValue: Number,
  compile: compileNumericField
}
```

## Compiler Helper Guide

These helpers are exported to make profile wiring predictable.

### Callback Contract

Compiler helpers receive:

```js
{
  fieldName,   // parsed field key (can be alias)
  definition,  // resolved field definition
  operator,    // parsed operator
  value,       // parsed/coerced value
  node,        // parser metadata (quoted, negated, exactNameBang)
  registry     // registry access (used by shortcut compilers)
}
```

### `compileKeywordField`

Use for categorical exact matching (`set`, `st`, `border`, `frame`, custom enums).

### `compileNumericField`

Use for numeric fields (`mv`, `pow`/`power`, `tou`/`toughness`, prices, custom metrics). Supports range/equality behavior.

### `compileTextField`

Use for free-text fields (`name`, `oracle`, `type`, `flavor`).

Note: built-in `name` uses include-style behavior for both `:` and `=`.

### `compileColorField` + `parseColorExpression`

Use for color and identity semantics (`c`/`color`, `id`/`identity`).

### `compileCollectorNumberField`

Use when collector-number comparisons must behave numerically on string-backed fields.

### `compileOrderedKeywordField`

Use for ranked keyword domains (for example rarity order).

### `compileLegalityField`

Use for legality-map fields where value is a format key and status is configured.

Typical status mapping:

- `"legal"` for `legal`/`f`/`format`
- `"not_legal"` for `banned`
- `"restricted"` for `restricted`

### `compileDateField` and `compileYearField`

Use for release date/year behavior over a date field (usually `released_at`).

- `compileDateField`: direct date comparisons (`YYYY-MM-DD`)
- `compileYearField`: year-to-date-range expansion

### `compileIsShortcutField` / `compileNotShortcutField`

Use for token shortcut families (`is:...`, `not:...`) with `tokenFieldMap`.
`compileIsShortcutField` also supports token-specific semantic handlers via `semanticShortcuts` (for example built-in `is:commander`).

### Search Control Helpers

- `compileSearchUniqueField`
- `compileSearchOrderField`
- `compileSearchPreferField`
- `compileSearchDirectionField`
- `compileSearchLangField`

These emit control directives, not direct filter clauses.

## Minimum Profile Flow

This is the minimum custom schema flow:

1. Create engine.
2. Register profile with schema-appropriate field paths.
3. Compile query using `profile` option.

```js
import {
  createEngine,
  compileColorField,
  compileKeywordField,
  compileNumericField,
  compileLegalityField,
  parseColorExpression
} from "scryfall-query-dsl";

const engine = createEngine();

engine.registerProfile("collection", {
  override: true,
  fields: {
    colors: {
      aliases: ["c", "color"],
      esPath: "card.colors",
      esPaths: ["card.colors", "card.card_faces.colors"],
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField
    },
    legal: {
      aliases: ["f", "format"],
      esPath: "card.legalities",
      type: "keyword",
      operators: [":", "="],
      parseValue: (v) => String(v).trim().toLowerCase(),
      compile: compileLegalityField,
      legalityStatus: "legal"
    },
    frame: {
      aliases: ["frame"],
      esPath: "card.frame",
      type: "keyword",
      operators: [":", "="],
      parseValue: (v) => String(v).trim().toLowerCase(),
      compile: compileKeywordField
    },
    inclusion_percent: {
      aliases: ["ip"],
      esPath: "slugs.inclusion_percent",
      type: "number",
      operators: [":", "=", ">", ">=", "<", "<=", "!="],
      parseValue: Number,
      compile: compileNumericField
    }
  }
});

const { dsl } = engine.compile("color<=mardu legal:commander frame:2015 ip>1", {
  profile: "collection"
});
```

## Custom Schema Support Guidelines

- Keep operators explicit; reject unsupported operators loudly.
- Keep `parseValue` deterministic and minimal.
- Prefer helper compilers for common behavior.
- Use custom compilers only when helper semantics do not fit your schema.
- Keep token shortcuts explicit (`tokenFieldMap`) so behavior stays explainable.

## Mapping Prerequisites (Common Gotchas)

Some built-in behaviors assume corresponding subfields exist in mappings:

- loose text behavior uses `.prefix` / `.infix` subfields where configured
- exact-name bang behavior expects keyword paths like `name.keyword`
- numeric PT behavior expects `power_num` / `toughness_num` mappings
- profile remaps (such as `ctx.card`) require corresponding nested fields to exist at target paths

If mappings do not provide those fields, behavior may degrade or fail depending on query/operator.

## Error Behavior

Expect loud failures for:

- unknown profile names at compile time
- malformed field definitions
- unsupported operators per field
- parse/coercion failures in field parsers

For non-fatal shortcut token handling (`is:` / `not:` unknown tokens), use `compile()` from [API.md](./API.md). Unknown tokens are surfaced in `meta.terms.invalid` and `meta.warnings` without throwing.

## Related Docs

- API details: [API.md](./API.md)
- Syntax parity/deviations: [SYNTAX-COVERAGE.md](./SYNTAX-COVERAGE.md)
- Maintenance workflow: [MAINTENANCE.md](./MAINTENANCE.md)
- Current project checkpoint: [session-handoff.md](./session-handoff.md)
