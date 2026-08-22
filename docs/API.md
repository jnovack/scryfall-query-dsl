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
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: (value) => {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) {
          throw new Error(`Cannot coerce "${value}" into a numeric value.`);
        }
        return numericValue;
      },
      compile: compileNumericField
    }
  }
});
```

`operators` is required — the registry throws `Field "<name>" must define a
non-empty "operators" array` without it (`searchControl` fields are the only
exception). `parseValue` is optional but effectively required for a `number`
field: without it, the raw string token from the query text is passed straight
to `compile`, so `compileNumericField`'s `term`/`range` clause runs against
whatever string the parser captured rather than a JS number. There is no
built-in numeric `parseValue` exported for reuse — `compileNumericField` is
exported, but its matching parse step is internal to `fields/defaults.js`, so
consumers must supply their own, as above.

Supports:

- `fields`
- `aliases`
- `override` (optional, default `false`)

## `engine.registerField(name, definition)`

Registers one field definition directly.

Use `engine.extend(...)` for batch updates and alias sets.

## `engine.registerAlias(alias, fieldName)`

Registers one alias directly against an existing field.

## `engine.describeFields(options?)`

Returns the keyword reference for one profile — every field that profile
actually compiles, grouped the way the [keyword reference page](../website/index.html)
groups them.

Build in-app syntax help from this rather than copying the reference page. A
copy has no failing test when a field is added here, so it goes stale silently;
this reflects whatever bundle the consumer actually loaded.

- `options.profile` (default `"default"`) selects the profile to describe
- throws on an unknown profile

```js
const { version, profile, groups } = engine.describeFields();

groups[0];
// {
//   id: "colors",
//   label: "Colors and Color Identity",
//   note: "",
//   fields: [
//     {
//       name: "colors",
//       names: ["colors", "c", "color"],   // canonical first, then aliases
//       aliases: ["c", "color"],
//       operators: [":", "=", ">", ">=", "<", "<="],
//       type: "color-set",
//       description: "Match card colors...",
//       examples: ["c:red", "c:azorius"],
//       searchControl: false
//     }
//   ],
//   unsupported: [{ label: "has:indicator", description: "..." }]
// }
```

Behavior worth knowing:

- **Every key is always present.** Missing `description` is `""`, missing
  `examples` is `[]`. Consumers never branch on `undefined`.
- **Aliases are live.** They come from the profile's alias map, so aliases added
  with `registerAlias()` or `extend({ aliases })` appear immediately, and a
  reassigned alias moves to the field it now resolves to. What the reference
  shows and what `resolveFieldName()` returns cannot disagree.
- **Custom fields are never invisible.** A field registered at runtime that
  belongs to no declared group appears in a trailing `other` group
  (`label: "Other Fields"`). The group is omitted when empty.
- **Shortcut cards appear as ordinary fields.** `is:foil`, `is:commander` and
  friends compile as token values of `is:` rather than as fields of their own,
  but they are described with the same descriptor shape, since a reader looking
  for them should not have to know that.
- **The result is detached.** Nothing aliases the registry or `KEYWORD_GROUPS`,
  so it is safe to `structuredClone()`, put in framework state, sort, or edit in
  place.
- Elasticsearch paths (`esPath`, `esPaths`) and compiler internals (`compile`,
  `parseValue`) are deliberately omitted. They are implementation details of the
  compiler, and exposing them would make this a wire contract.

## `KEYWORD_GROUPS`

The group skeleton `describeFields()` renders into — section ids, labels, notes,
and the unimplemented-syntax entries shown grayed out on the reference page.
Exported for consumers building a custom renderer that assembles fields itself.

The value is deep-frozen: it is shared by every engine instance in the realm, so
mutating it would change what other consumers see. Copy it if you need to
reshape it.

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
