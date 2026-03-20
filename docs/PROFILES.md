# Profiles

Profiles allow one `scryfall-query-dsl` engine instance to compile the same query language against multiple document layouts.

Typical use case:

- profile `default`: native Scryfall-like card index fields (`colors`, `frame`, `color_identity`, etc.)
- profile `moxfield_collection`: collection-entry layout where most searchable card fields live under `card.*`

With profiles, consumers can toggle data sources without changing parser logic or user query syntax.

---

## Why Profiles Exist

Runtime `extend()` is useful when you have one schema.

Profiles solve a different problem: one application may target multiple schemas where field paths and semantics differ.

Examples:

- `frame:2015` would hit `frame` and `frame_effects` in the default profile, but `card.frame` in a collection profile
- `inclusion_percent>1` may exist only in enriched collection docs (for example `slugs.inclusion_percent`), not in the default index
- `is:`/`not:` tokens may be valid in one schema and unknown in another

---

## Engine API

`createEngine()` now supports profile-aware compile and registration methods.

### `engine.registerProfile(name, extension, options?)`

Registers a named profile with its own registry and compiler context.

- `name`: profile name (string)
- `extension`: same shape as `engine.extend(...)`
- `options.override` (default `false`): allow replacing an existing profile with the same name

### `engine.extendProfile(name, extension)`

Extends an already-registered profile.

### `engine.listProfiles()`

Returns all profile names (always includes `default`).

### `engine.compile(queryOrAst, { profile })`

Compiles against the selected profile.

If `profile` is omitted, `default` is used.

### `engine.compileWithMeta(queryOrAst, { profile })`

Same as `compile`, but returns DSL plus metadata/warnings for unknown shortcut tokens.

---

## Profile Semantics

Each profile has:

- its own field registry
- its own alias map
- its own parser->compiler interpretation of fields/shortcuts

This means profile overrides are isolated:

- changing `frame` in `moxfield_collection` does not change `frame` in `default`
- adding custom fields to one profile does not leak into another profile

---

## Example: Moxfield-Style Collection Profile

Below is a concrete profile that supports:

- `color<=mardu`
- `legal:commander`
- `is:legendary` / `not:legendary`
- `frame:2015`
- `inclusion_percent>1`

```js
import {
  createEngine,
  compileColorField,
  compileIsShortcutField,
  compileKeywordField,
  compileNotShortcutField,
  compileNumericField,
  compileLegalField,
  parseColorExpression,
} from "scryfall-query-dsl";

function compileLegalField({ fieldName, operator, value }) {
  if (operator !== ":" && operator !== "=") {
    throw new Error(
      `Field "${fieldName}" does not support operator "${operator}". Supported operators: :, =`
    );
  }

  return {
    term: {
      [`card.legalities.${value}`]: "legal",
    },
  };
}

const engine = createEngine();

engine.registerProfile("moxfield_collection", {
  override: true,
  fields: {
    colors: {
      aliases: ["c", "color"],
      esPath: "card.colors",
      esPaths: ["card.colors", "card.card_faces.colors"],
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    color_identity: {
      aliases: ["id", "identity"],
      esPath: "card.color_identity",
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    legal: {
      aliases: ["f", "format"],
      esPath: "card.legalities",
      type: "keyword",
      parseValue: (value) => String(value).trim().toLowerCase(),
      compile: compileLegalField,
    },
    frame: {
      aliases: ["frame"],
      esPath: "card.frame",
      type: "keyword",
      parseValue: (value) => String(value).trim().toLowerCase(),
      compile: compileKeywordField,
    },
    inclusion_percent: {
      aliases: ["ip"],
      esPath: "slugs.inclusion_percent",
      type: "number",
      parseValue: Number,
      compile: compileNumericField,
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      type: "keyword",
      parseValue: (value) => String(value).trim().toLowerCase(),
      compile: compileIsShortcutField,
      tokenFieldMap: {
        legendary: ["card.type_line"],
      },
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      type: "keyword",
      parseValue: (value) => String(value).trim().toLowerCase(),
      compile: compileNotShortcutField,
      tokenFieldMap: {
        legendary: ["card.type_line"],
      },
    },
  },
});

const query = "color<=mardu legal:commander is:legendary frame:2015 inclusion_percent>1";
const dsl = engine.compile(query, { profile: "moxfield_collection" });
```

---

## Recommended Usage Pattern in Apps

In applications that can search multiple data sources:

1. Initialize one engine.
2. Register one profile per source/index schema.
3. Store active source setting (for example in local storage).
4. Compile with `engine.compile(query, { profile: activeProfile })`.
5. Send compiled DSL to the corresponding Elasticsearch index.

This keeps query UX consistent while preserving schema correctness.

---

## Error Behavior

- Unknown profile at compile time throws `Unknown profile "<name>"`.
- Registering an existing profile without `options.override: true` throws.
- Field-definition validation remains the same as base registry validation.
- Unknown `is:` / `not:` tokens remain non-fatal when using `compileWithMeta()` and are reported in metadata.

---

## Notes on Scope

Profiles support both simple path remaps and semantic overrides, but the implementation is still field-definition driven:

- use built-in helper compilers for common behavior
- add custom compilers for schema-specific semantics (for example legalities layout)
- keep token shortcuts explicit per profile for clarity

For first-order support, profile token maps should stay explicit and single-field where possible; aggregate shortcuts can be added later as dedicated profile behavior.
