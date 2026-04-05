# scryfall-query-dsl

`scryfall-query-dsl` parses Scryfall-style query text and compiles it to Elasticsearch DSL.

It is designed for browser-based tools, private/internal web apps, and custom MTG search services that want familiar query syntax with runtime schema extensibility.

## 30-Second Pitch

- Parse query syntax into AST.
- Compile AST into Elasticsearch query DSL.
- Support runtime extension (`extend`, custom fields/aliases/compilers).
- Support multiple schemas via profiles (`default` and built-in `ctx.card`).
- Ship browser-friendly distributable bundles.

## Quick Start

### Install

```bash
npm install
```

### Basic Compile

```js
import { createEngine } from "scryfall-query-dsl";

const engine = createEngine();
const { dsl } = engine.compile("c:red mv<=3");

console.log(JSON.stringify(dsl, null, 2));
```

### Compile with Metadata

`compile()` always returns `{ dsl, meta }`. Use `meta` to inspect unknown tokens without throwing.

```js
const { dsl, meta } = engine.compile("is:rare is:unknown_token");
console.log(dsl);
console.log(meta.terms.valid);   // ["is:rare"]
console.log(meta.terms.invalid); // ["is:unknown_token"]
```

## Built-in Capability Snapshot

Current built-ins include:

- colors and identity (`c`, `color`, `id`, `identity`)
- numeric and price fields (`mv`, `cmc`, `usd`, `eur`, `tix`)
- numeric PT fields (`pow`, `power`, `tou`, `toughness`) via `power_num`/`toughness_num`
- rarity, set, frame/border, collector number
- legality/date/year (`f`, `format`, `legal`, `banned`, `restricted`, `date`, `year`)
- text families (`name`, `o`, `t`, `ft`)
- controls (`unique`, `order`, `prefer`, `direction`, `lang`)
- shortcut tokens (`is:`, `not:` with metadata support)
- baseline Scryfall-style bare-term semantics (`lightning bolt` => implicit `AND`; quote for phrase search)

See behavior details and known deviations in [docs/SYNTAX-COVERAGE.md](./docs/SYNTAX-COVERAGE.md).

## Documentation Map

- API reference: [docs/API.md](./docs/API.md)
- Profiles, field definitions, compiler helpers, custom schema flow: [docs/PROFILES.md](./docs/PROFILES.md)
- Syntax parity matrix and deviations: [docs/SYNTAX-COVERAGE.md](./docs/SYNTAX-COVERAGE.md)
- Maintenance and release runbook: [docs/MAINTENANCE.md](./docs/MAINTENANCE.md)
- Session checkpoint handoff: [docs/session-handoff.md](./docs/session-handoff.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)

## Scope

This library is a parser/compiler + extension runtime. It is not:

- a full Elasticsearch client
- a hosted search service
- a UI framework
- a crawler/importer/indexer

## License

MIT
