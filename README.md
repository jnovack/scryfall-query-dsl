# scryfall-query-dsl

A browser-friendly JavaScript library for parsing **Scryfall-style card search syntax** and compiling it into **Elasticsearch DSL**.

The goal is simple:

- write familiar card-search queries,
- compile them into Elasticsearch queries,
- ship a JS bundle that can be loaded from a CDN,
- allow downstream users to **extend the field registry at runtime** without modifying core source.

This project is designed to be used privately in webpages, internal tools, and custom card search UIs.

---

## Why this exists

Scryfall-style syntax is ergonomic and familiar for Magic: The Gathering search interfaces, but Elasticsearch expects JSON DSL.

This library sits in the middle:

**Scryfall-like query** → **AST** → **Elasticsearch DSL**

It is intended to support:

- browser-based search UIs,
- CDN-hosted private scripts,
- custom Elasticsearch schemas,
- runtime field extensions,
- enriched card indices with additional metadata.

For example, if your index includes:

- `edhrec.inclusion_percent`
- `cube.frequency`
- `price.usd_foil`
- `stats.drawn_win_rate`

you should be able to extend the parser/compiler without editing core code.

---

## Features

- Parse Scryfall-style query syntax
- Compile parsed queries into Elasticsearch DSL
- Support quoted string values with escaping
- Support bare terms as implicit `name:` searches
- Support `is:` / `not:` token shortcuts with cross-referenced keyword fields
- Support built-in rarity, set, collector number, and price fields
- Support search directives for `unique`, `order`, `prefer`, and `direction`
- Runtime field registration and aliasing
- Browser-friendly output
- CDN-friendly distribution
- Framework-agnostic
- Extendable compiler behavior for custom fields
- Suitable for enriched/custom card indices

---

## Status

Early-stage library design with a strong focus on:

- parser/compiler separation
- stable extension points
- browser compatibility
- custom field support

Exact 1:1 Scryfall compatibility is a goal where practical, but internal consistency and extensibility come first.

Current built-in behavior targets the base Scryfall card data shape:

- `colors`, `card_faces.colors`, and `color_identity` are treated as keyword arrays containing `W/U/B/R/G`
- text fields such as `name`, `type_line`, `card_faces.type_line`, `oracle_text`, and `card_faces.oracle_text` are compiled as Elasticsearch text queries by default
- downstream schema-specific enrichments should be added through `extend()` rather than baked into the base package

---

## Installation

### npm

```bash
npm install
````

### CDN

Example with a global build:

```html
<script src="https://cdn.example.com/scryfall-query-dsl.js"></script>
<script>
  const engine = window.ScryfallQueryDSL.createEngine();
</script>
```

> Replace the CDN URL with your actual published bundle path.

---

## Quick Start

### ESM

```js
import { createEngine } from "scryfall-query-dsl";

const engine = createEngine();

const ast = engine.parse("c:red mv<=3");
const dsl = engine.compile(ast);

console.log(JSON.stringify(dsl, null, 2));
```

### One-shot compile

```js
import { createEngine } from "scryfall-query-dsl";

const engine = createEngine();

const dsl = engine.compile("c:red t:dragon mv<=5");
console.log(dsl);
```

Quoted values are supported when a field value contains spaces or reserved words:

```js
const dsl = engine.compile('name:"Lightning Bolt" o:"choose one or both"');
```

Bare words are treated as implicit `name:` searches:

```js
const dsl = engine.compile("lightning unique:cards not:showcase");
```

Name search behavior also distinguishes quoted vs unquoted multi-word input:

```js
engine.compile('"lightning bolt"'); // -> match_phrase on name
engine.compile("lightning bolt"); // -> match on name with operator: "and"
```

---

## Example

### Input

```txt
c:red t:dragon mv<=5
```

### Example AST

```js
{
  type: "boolean",
  operator: "and",
  clauses: [
    { type: "term", field: "c", operator: ":", value: "red", negated: false },
    { type: "term", field: "t", operator: ":", value: "dragon", negated: false },
    { type: "term", field: "mv", operator: "<=", value: "5", negated: false }
  ]
}
```

### Example Elasticsearch DSL

```js
{
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                must: [{ term: { colors: "R" } }],
                must_not: [
                  { term: { colors: "W" } },
                  { term: { colors: "U" } },
                  { term: { colors: "B" } },
                  { term: { colors: "G" } }
                ]
              }
            },
            {
              bool: {
                must: [{ term: { "card_faces.colors": "R" } }],
                must_not: [
                  { term: { "card_faces.colors": "W" } },
                  { term: { "card_faces.colors": "U" } },
                  { term: { "card_faces.colors": "B" } },
                  { term: { "card_faces.colors": "G" } }
                ]
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      {
        bool: {
          should: [
            { match: { type_line: "dragon" } },
            { match: { "card_faces.type_line": "dragon" } }
          ],
          minimum_should_match: 1
        }
      },
      { range: { cmc: { lte: 5 } } }
    ]
  }
}
```

> Exact DSL output depends on the active field registry and compiler rules.

---

## Core Concepts

This library is split into four logical layers:

### 1. Parser

Understands Scryfall-like query syntax and turns it into an AST.

### 2. AST

A neutral representation of the query.

### 3. Compiler

Converts AST nodes into Elasticsearch DSL.

### 4. Registry / Extensions

Defines:

- available fields,
- aliases,
- type coercion,
- custom compilers,
- custom field behavior.

This separation is what makes runtime extension possible.

## Built-in Fields

The base registry is intentionally small and Scryfall-shaped:

- `c`, `color` -> `colors` OR `card_faces.colors`
- `id`, `identity` -> `color_identity`
- `mv`, `cmc` -> `cmc`
- `r`, `rarity` -> `rarity`
- `set` -> `set`
- `st`, `set_type` -> `set_type`
- `border`, `border_color` -> `border_color`
- `frame` -> `frame` OR `frame_effects`
- `cn` -> `collector_number`
- `usd` -> `prices.usd`
- `eur` -> `prices.eur`
- `tix` -> `prices.tix`
- `lang`, `language` -> language preference sort control
- `o`, `oracle`, `text` -> `oracle_text` OR `card_faces.oracle_text`
- `t`, `type` -> `type_line` OR `card_faces.type_line`
- `kw`, `keyword`, `keywords` -> `keywords`
- `name`, `n` -> `name`

Search directives are also built in:

- `unique:cards` collapses on `oracle_id`
- `unique:art` collapses on `illustration_id`
- `unique:prints` leaves print-level results unchanged
- `order:` controls the primary sort field
- `prefer:` adds tie-breaker and preference sorts
- `direction:` applies `asc` or `desc` to the active order
- `lang:` heavily prefers matching `lang` values first (without filtering out other languages)
- `prefer:default` applies native sort tie-breakers over default-print-adjacent fields, then newer releases and higher collector numbers

When one of those directives is present, `compile()` returns a search body containing `query` plus the relevant `collapse` and `sort` settings.
When `unique:cards` is used without an explicit `order:`, the compiler defaults to `order:name` with ascending direction for deterministic card-level grouping.

The built-in color compiler supports:

- single colors like `c:red`, `id:u`
- compact color sets like `c:uw`
- named groups like `c:azorius`, `id:esper`
- popular nicknames across guilds, shards, wedges, colleges, and four-color names like `c:altruism`
- colorless with `c:c` / `id:c`
- multicolor with `m` or `multicolor`, such as `c:m`, `c:multicolor`, `id:m`, and `id:multicolor`
- set comparisons with `:`, `=`, `>`, `>=`, `<`, `<=`

Colorless handling is field-specific:

- `id:c` / `identity:colorless` compiles as missing/empty `color_identity`
- `c:c` / `color:colorless` compiles as missing/empty for both `colors` and `card_faces.colors`

See [docs/syntax-coverage.md](/Users/jnovack/Source/scryfall-query-dsl/docs/syntax-coverage.md) for the current parity matrix.

Quoted string values currently support:

- spaces inside a field value
- literal `and` / `or` inside a value
- escaped double quotes with `\"`

The built-in rarity field supports `common`, `uncommon`, `rare`, `mythic`, `special`, and `bonus` with comparison operators.
Set lookups use Scryfall set codes, collector numbers support exact matching plus numeric comparisons for purely numeric collector numbers, `is:` / `not:` resolve across configured keyword shortcut fields, `kw`/`keyword`/`keywords` compile to the `keywords` field, and `usd` / `eur` / `tix` compile as numeric price fields.
`lang` / `language` is compiled as a sort preference control using the raw requested value (for example `lang:en`, `lang:es`, `lang:ja`) and does not perform built-in language-code validation.
`is:default` is implemented as an explicit shortcut expansion of:
`not:showcase not:extendedart -border:borderless not:fracturefoil not:etched not:stamped not:datestamped not:fullart not:surgefoil not:galaxyfoil -st:masterpiece -frame:future -frame:colorshifted not:playtest -frame:inverted -border:yellow`.

## Metadata Interface

Use `compileWithMeta()` when you want graceful handling of unknown `is:` / `not:` tokens.

```js
const result = engine.compileWithMeta("is:rare is:bibbityboppityboo");

console.log(result.dsl);
console.log(result.meta);
```

`meta` includes:

- `terms.valid`: full parsed terms that compiled successfully (for example `is:rare`)
- `terms.invalid`: full parsed terms that were skipped (for example `is:bibbityboppityboo`)
- `warnings`: machine-friendly warning objects (`UNKNOWN_IS_NOT_TOKEN`)

---

## Default Usage

```js
import { createEngine } from "scryfall-query-dsl";

const engine = createEngine();

const query = "c:red o:draw mv>2";
const dsl = engine.compile(query);

console.log(dsl);
```

---

## Runtime Extension

One of the main goals of this project is allowing consumers to add fields without modifying the core library.

For example, suppose your Elasticsearch card index includes:

```json
{
  "edhrec": {
    "inclusion_percent": 1.4
  }
}
```

You can register a custom field at runtime:

```js
import {
  createEngine,
  compileNumericField
} from "scryfall-query-dsl";

const engine = createEngine();

engine.extend({
  fields: {
    inclusion_percent: {
      aliases: ["inclusion_percent", "ip", "edhrec"],
      esPath: "edhrec.inclusion_percent",
      type: "number",
      compile: compileNumericField
    }
  }
});

const dsl = engine.compile("c:red inclusion_percent>1.4");
console.log(JSON.stringify(dsl, null, 2));
```

## Profiles (Multi-Schema)

Use profiles when you need one query language but different index layouts (for example native Scryfall docs vs a collection layout).

```js
import {
  createEngine,
  compileColorField,
  compileIsShortcutField,
  compileKeywordField,
  compileNotShortcutField,
  compileNumericField,
  parseColorExpression
} from "scryfall-query-dsl";

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
      compile: compileColorField
    },
    frame: {
      aliases: ["frame"],
      esPath: "card.frame",
      type: "keyword",
      compile: compileKeywordField
    },
    inclusion_percent: {
      aliases: ["ip"],
      esPath: "slugs.inclusion_percent",
      type: "number",
      compile: compileNumericField
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      type: "keyword",
      compile: compileIsShortcutField,
      tokenFieldMap: { legendary: ["card.type_line"] }
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      type: "keyword",
      compile: compileNotShortcutField,
      tokenFieldMap: { legendary: ["card.type_line"] }
    }
  }
});

const dsl = engine.compile("color<=mardu is:legendary frame:2015 ip>1", {
  profile: "moxfield_collection"
});
```

See [docs/PROFILES.md](/Users/jnovack/Source/scryfall-query-dsl/docs/PROFILES.md) for full profile API and examples.

### Example output

```js
{
  bool: {
    must: [
      {
        bool: {
          should: [
            {
              bool: {
                must: [{ term: { colors: "R" } }],
                must_not: [
                  { term: { colors: "W" } },
                  { term: { colors: "U" } },
                  { term: { colors: "B" } },
                  { term: { colors: "G" } }
                ]
              }
            },
            {
              bool: {
                must: [{ term: { "card_faces.colors": "R" } }],
                must_not: [
                  { term: { "card_faces.colors": "W" } },
                  { term: { "card_faces.colors": "U" } },
                  { term: { "card_faces.colors": "B" } },
                  { term: { "card_faces.colors": "G" } }
                ]
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      { range: { "edhrec.inclusion_percent": { gt: 1.4 } } }
    ]
  }
}
```

---

## Browser Runtime Extension

This library is intended to work in private webpages loaded from a CDN or local bundle.

Example:

```html
<script src="/js/scryfall-query-dsl.js"></script>
<script>
  const engine = window.ScryfallQueryDSL.createEngine();

  engine.extend({
    fields: {
      inclusion_percent: {
        aliases: ["ip", "inclusion_percent"],
        esPath: "edhrec.inclusion_percent",
        type: "number",
        compile: window.ScryfallQueryDSL.compileNumericField
      }
    }
  });

  const dsl = engine.compile("c:red ip>1.4");
  console.log(dsl);
</script>
```

This allows each consuming page to define its own custom schema mapping.

The browser bundle also exposes version metadata and announces itself when loaded:

```js
console.log(window.ScryfallQueryDSL.VERSION);
console.log(window.ScryfallQueryDSL.RELEASE);
```

---

## API

## `createEngine(options?)`

Creates a new parser/compiler engine instance.

```js
const engine = createEngine();
```

### Expected responsibilities

- hold the field registry
- parse query strings
- compile queries/AST into DSL
- accept runtime extensions

---

## `engine.parse(query)`

Parses a query string into an AST.

```js
const ast = engine.parse("c:red mv<=3");
```

---

## `engine.compile(queryOrAst, options?)`

Compiles a query string or AST into Elasticsearch DSL.

```js
const dsl = engine.compile("c:red mv<=3");
const moxfieldDsl = engine.compile("c:red", { profile: "moxfield_collection" });
```

---

## `engine.compileWithMeta(queryOrAst, options?)`

Compiles while returning DSL + metadata, optionally against a named profile.

```js
const result = engine.compileWithMeta("is:legendary is:showcase", {
  profile: "moxfield_collection"
});
```

---

## `engine.extend(extension)`

Adds custom fields, aliases, or compiler behavior to the current engine.

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

---

## `engine.registerProfile(name, extension, options?)`

Registers a named compile profile with its own field registry.

```js
engine.registerProfile("moxfield_collection", {
  override: true,
  fields: {
    frame: {
      aliases: ["frame"],
      esPath: "card.frame",
      type: "keyword",
      compile: compileKeywordField
    }
  }
});
```

---

## `engine.extendProfile(name, extension)`

Extends an existing named profile after registration.

```js
engine.extendProfile("moxfield_collection", {
  fields: {
    inclusion_percent: {
      aliases: ["ip"],
      esPath: "slugs.inclusion_percent",
      type: "number",
      compile: compileNumericField
    }
  }
});
```

---

## `engine.listProfiles()`

Returns the list of registered profile names.

```js
console.log(engine.listProfiles()); // ["default", "moxfield_collection"]
```

---

## `engine.registerField(name, definition)`

Registers a single field manually.

```js
engine.registerField("inclusion_percent", {
  aliases: ["ip"],
  esPath: "edhrec.inclusion_percent",
  type: "number",
  compile: compileNumericField
});
```

---

## Field Definitions

A field definition typically looks like this:

```js
{
  aliases: ["ip", "edhrec"],
  esPath: "edhrec.inclusion_percent",
  type: "number",
  compile: compileNumericField
}
```

Common properties may include:

- `aliases` — alternate query names
- `esPath` — target Elasticsearch field path
- `type` — semantic type
- `operators` — allowed operators
- `parseValue` — optional value coercion
- `compile` — custom AST-to-DSL compiler hook

For raw Scryfall card data, the base built-ins assume:

- `colors` is a keyword array of `W/U/B/R/G`
- `card_faces.colors` is a keyword array of `W/U/B/R/G` when card faces are indexed
- `color_identity` is a keyword array of `W/U/B/R/G`
- `cmc` is numeric
- `name`, `type_line`, and `oracle_text` are text fields
- `card_faces.type_line` is searchable text
- `card_faces.oracle_text` is searchable text when present in the index mapping

---

## Built-in Compiler Helpers

Example helper usage:

```js
import {
  compileNumericField,
  compileTextField
} from "scryfall-query-dsl";
```

These helpers are intended to make common custom fields trivial to add.

Typical use cases:

- numeric fields
- text fields
- exact match fields
- range fields
- boolean flags

---

## Supported Syntax

This project aims to support familiar Scryfall-like patterns such as:

- `field:value`
- `field=value`
- `field>value`
- `field>=value`
- `field<value`
- `field<=value`
- negation
- grouped conditions
- boolean composition

Current built-in examples:

- `c:red`
- `c:azorius`
- `id<=esper`
- `id:c`
- `t:dragon`
- `mv<=3`
- `-o:draw`
- `(c:red or c:white) t:angel`

Examples:

```txt
c:red
t:dragon
mv<=3
-o:draw
(c:red or c:white) t:angel
```

> Exact coverage depends on the current parser version.

---

## Custom Schema Support

This library is explicitly designed for indices that do **not** exactly match Scryfall’s schema.

Examples of custom fields that should work well:

- `edhrec.inclusion_percent`
- `prices.cardkingdom.retail`
- `cube.frequency`
- `meta.play_rate`
- `stats.drawn_win_rate`

The intended pattern is:

- keep the core parser generic,
- register custom fields in the consuming app,
- compile them through field-level compilers.

---

## Design Goals

- **Browser-first**
- **CDN-friendly**
- **Runtime-extendable**
- **Elasticsearch-focused**
- **Stable public API**
- **Minimal assumptions about downstream schema**

---

## Non-Goals

This library is **not** intended to be:

- a full Elasticsearch client,
- a card database crawler,
- a deckbuilder,
- a hosted API,
- a replacement for Scryfall,
- a UI framework.

It is a parser/compiler/runtime-extension library.

---

## Error Handling

The library should fail loudly when:

- query syntax is invalid,
- unknown fields are used,
- a field definition is malformed,
- an operator is unsupported for a field,
- a value cannot be coerced correctly.

Bad input should not silently produce nonsense DSL.

---

## Development

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Dev mode

```bash
npm run dev
```

> Adjust script names to match the actual project setup.

## GitHub Pages Deployment

This repository includes a Pages workflow at `.github/workflows/github-pages.yml` that:

- installs dependencies with `npm ci`
- runs `npm test`
- runs `npm run build`
- publishes the `dist/` directory to GitHub Pages

If your GitHub Pages site is configured for Actions-based deployment, the bundle URLs will look like:

```txt
https://<owner>.github.io/<repo>/scryfall-query-dsl.js
https://<owner>.github.io/<repo>/scryfall-query-dsl.esm.js
```

The generated bundles include a top-of-file version banner and export `VERSION`, `RELEASE`, and `BUILD_DATE`.

---

## Suggested Project Structure

```text
src/
  parser/
  ast/
  compiler/
  registry/
  fields/
  plugins/
  index.js

dist/
examples/
test/
```

---

## Example Use Cases

### Private card search UI

Load the bundle privately into a webpage and compile user queries into Elasticsearch DSL before making a search request.

### Enriched card database

Add custom fields like:

- EDHREC metrics
- cube data
- pricing data
- internal metadata

without touching the core parser.

### Search-as-a-library

Use this package as a syntax module that downstream apps can extend at startup.

---

## Roadmap Ideas

- more complete Scryfall syntax coverage
- better grouped boolean expression support
- macro/synthetic field registration
- nested field helpers
- browser demo page
- minified CDN builds
- compatibility mode toggles
- AST inspection/debug utilities

---

## Contributing

Contributions should preserve the central design goals:

- parser/compiler separation
- runtime extensibility
- browser compatibility
- stable public API

If a change makes downstream field extension harder, it is probably the wrong change.

Please prefer:

- small focused changes,
- tests with behavior changes,
- explicit documentation for syntax and compiler behavior.

---

## License

Add your preferred license here.

For example:

```txt
MIT
```

---

## Trademark / Naming Note

This project parses **Scryfall-style** syntax, but is an independent project and not affiliated with Scryfall.

If you mirror their syntax closely, keep that distinction clear and don’t accidentally cosplay as official.

---

## Example Minimal Flow

```js
import {
  createEngine,
  compileNumericField
} from "";

const engine = createEngine();

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

const dsl = engine.compile("c:red ip>1.4");
console.log(JSON.stringify(dsl, null, 2));
```

That is the core promise of this library:
**base syntax + runtime extension + Elasticsearch DSL output**.
