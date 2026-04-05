# API Reference

This file is the API contract for `scryfall-query-dsl`.

For schema/profile wiring and helper usage, see [PROFILES.md](./PROFILES.md).  
For behavior/parity details, see [SYNTAX-COVERAGE.md](./SYNTAX-COVERAGE.md).

## `createEngine(options?)`

Creates an engine instance with parser, compiler, registry, and built-in profiles.

```js
import { createEngine } from "scryfall-query-dsl";

const engine = createEngine();
```

Built-in profiles always include:

- `default`
- `ctx.card`

## `engine.version`

Exposes the current release string for the engine instance.

- type: string
- value: same as exported `RELEASE`

## `engine.parse(query)`

Parses a query string into an AST.

- input: non-empty string
- output: AST node
- throws on malformed syntax

## `engine.compile(queryOrAst, options?)`

Compiles a query string or AST into Elasticsearch DSL.

Always returns `{ dsl, meta }`.

```js
const { dsl, meta } = engine.compile("c:red mv<=3 pow>=2");
```

Options:

- `profile` (optional): profile name, default is `default`

`dsl` shape:

- plain query clause when no search controls are present
- full search body (`{ query, sort?, collapse?, aggs? }`) when controls like `unique`, `order`, `prefer`, `direction`, `lang` are present
- when `unique:cards` or `unique:art` is active, `aggs.collapsed_total` is emitted as a `cardinality` aggregation on the collapse field

`meta` includes:

- `terms.valid` — list of successfully compiled full terms (for example `["is:rare"]`)
- `terms.invalid` — list of skipped unknown terms (for example `["is:unknownthing"]`)
- `warnings` — array of warning objects (for example `{ code: "UNKNOWN_IS_NOT_TOKEN", term: "is:unknownthing" }`)

```js
const { dsl, meta } = engine.compile("is:rare is:unknownthing");
// meta.terms.valid   → ["is:rare"]
// meta.terms.invalid → ["is:unknownthing"]
// meta.warnings      → [{ code: "UNKNOWN_IS_NOT_TOKEN", ... }]
```

## `engine.extend(extension)`

Extends the active registry (default profile) with fields/aliases.

```js
engine.extend({
  fields: {
    inclusion_percent: {
      aliases: ["ip"],
      esPath: "edhrec.inclusion_percent",
      type: "number",
      compile: compileNumericField
    }
  }
});
```

Supports:

- `fields`
- `aliases`
- `override` (optional, default `false`)

## `engine.registerField(name, definition)`

Registers one field definition directly.

Use `engine.extend(...)` for batch updates and alias sets.

## `engine.registerAlias(alias, fieldName)`

Registers one alias directly against an existing field.

## Profile APIs

### `engine.registerProfile(name, extension, options?)`

Registers a named profile with isolated field registry/compiler context.

- `options.override` (default `false`) controls replacement behavior

### `engine.extendProfile(name, extension)`

Extends an already-registered profile.

### `engine.listProfiles()`

Returns profile names.

```js
engine.listProfiles(); // ["default", "ctx.card", ...]
```

## Errors and Validation

The API fails loudly when:

- query syntax is invalid
- unknown fields are referenced
- unsupported operators are used for a field
- field definitions are malformed
- value coercion fails for a field parser

## Public Helper Exports

Common helper exports are available for custom schemas, including:

- `compileKeywordField`
- `compileNumericField`
- `compileTextField`
- `compileColorField`
- `compileOrderedKeywordField`
- `compileCollectorNumberField`
- `compileLegalityField`
- `compileDateField`
- `compileYearField`
- `compileSearchUniqueField`
- `compileSearchOrderField`
- `compileSearchPreferField`
- `compileSearchDirectionField`
- `compileSearchLangField`
- `compileIsShortcutField`
- `compileNotShortcutField`
- `parseColorExpression`

See [PROFILES.md](./PROFILES.md) for helper intent and usage patterns.
