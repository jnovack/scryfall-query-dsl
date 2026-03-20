# AGENTS.md

## Project Purpose

This project compiles Scryfall-style search syntax into Elasticsearch DSL and ships the result as a browser-loadable JavaScript module.

The primary deliverable is a distributable JS file that:

- can be hosted on a CDN,
- can be loaded privately into user webpages,
- can run fully client-side,
- can be extended at runtime with custom field definitions, aliases, operators, and compilers,
- does not require edits to core source code for downstream customization.

This project should be treated as a reusable parser/compiler library, not as a tightly coupled application.

---

## Core Product Goals

1. **Parse Scryfall-like syntax into an AST**
2. **Compile AST into Elasticsearch DSL**
3. **Support runtime extension**
4. **Work in browser environments**
5. **Produce a clean distributable bundle for CDN delivery**
6. **Remain framework-agnostic**
7. **Preserve predictable behavior across consumers**

---

## Architectural Principles

### 1) Separate parser from compiler

The parser must not contain Elasticsearch-specific field knowledge when avoidable.

Preferred separation:

- **Tokenizer / parser**: understands query syntax
- **AST layer**: represents parsed intent
- **Compiler**: converts AST into Elasticsearch DSL
- **Registry / plugin layer**: defines fields, aliases, value coercion, and custom compilation behavior

Do not hardcode downstream schema knowledge into grammar logic unless there is no better abstraction.

### 2) Runtime extensibility is a first-class feature

Consumers must be able to extend the module at page load or app bootstrap time.

Support extension patterns like:

- register new fields
- register aliases
- override or add compilers
- add synthetic fields/macros
- add custom value parsers
- define new operator handling where appropriate

The base package must remain usable without custom fields, but must not resist them.

### 3) Browser-first compatibility

The final output must run in modern browsers without requiring Node.js runtime features at execution time.

Avoid runtime dependence on:

- `fs`
- `path`
- `Buffer` unless polyfilled by the build
- Node-only APIs in the shipped browser bundle

Build-time tooling may use Node.js freely. Runtime code for the distributed artifact must remain browser-safe.

### 4) Keep the public API stable and boring

The API should be easy to understand and hard to misuse.

Preferred public API shape:

- `createEngine(...)`
- `parse(...)`
- `compile(...)`
- `registerField(...)`
- `registerAlias(...)`
- `extend(...)`

Avoid exposing fragile internal parser state unless there is a compelling reason.

### 5) Favor explicit configuration over magic

Custom fields should be defined by schema/config where possible rather than scattered conditionals.

Example shape:

- field name
- aliases
- ES path
- data type
- supported operators
- parse/coerce function
- compile function

---

## Expected Project Structure

This structure is preferred unless there is a good reason to change it:

```text
/src
  /parser
  /ast
  /compiler
  /registry
  /fields
  /plugins
  /runtime
  index.ts|js

/dist
  bundled outputs for CDN/browser use

/examples
  simple consumer examples
  browser usage examples
  extension examples

/test
  parser tests
  compiler tests
  extension tests
  browser-facing behavior tests
````

If new directories are introduced, keep naming obvious and responsibility narrow.

---

## Public API Expectations

The library should support workflows like:

```js
const engine = createEngine();

engine.extend({
  fields: {
    inclusion_percent: {
      aliases: ["ip", "edhrec"],
      esPath: "edhrec.inclusion_percent",
      type: "number"
    }
  }
});

const ast = engine.parse("c:red inclusion_percent>1.4");
const dsl = engine.compile(ast);
```

The following must remain possible without editing core source:

- adding custom fields
- remapping aliases
- compiling enriched fields to nested ES paths
- coercing user-friendly values into ES-native values
- composing multiple extensions

---

## Extension System Rules

### Required behavior

Extensions should be able to:

- register new fields
- add aliases to existing fields
- override default field compilation intentionally
- register synthetic or computed fields
- supply custom parsing/coercion logic

### Extension safety

Extensions must not silently break core behavior.

If there is a naming collision:

- fail loudly, or
- require an explicit override flag

Never silently replace a built-in field definition.

### Merge semantics

Extension merges should be deterministic.
If multiple extensions are applied:

- later explicit overrides may win,
- but collisions should be visible and predictable.

Document merge behavior clearly.

---

## Elasticsearch DSL Rules

### Compiler output should be predictable

Compilation should consistently emit valid Elasticsearch DSL objects.

Common mappings should include:

- `:` / `=` -> exact or field-appropriate match behavior
- `>` / `>=` / `<` / `<=` -> `range`
- negation -> `must_not`
- conjunction -> `must`
- disjunction -> `should`
- grouping -> nested bool queries

### Do not assume every field is a simple term field

Some fields may compile to:

- `term`
- `terms`
- `match`
- `range`
- `exists`
- `bool`
- `nested`
- custom compound clauses

That is why field-level compiler hooks exist.

### Keep AST generic where possible

The AST should describe search meaning, not Elasticsearch implementation details.

Bad:

- AST node that already looks like ES DSL

Better:

- AST node describing field/operator/value/grouping
- compiler decides how to map it

---

## Syntax Behavior Expectations

This project targets Scryfall-style search semantics, but may not need perfect 1:1 compatibility on day one.

Prioritize:

1. obvious syntax behavior,
2. internal consistency,
3. extension support,
4. testability,
5. documented deviations from Scryfall if necessary.

---

## Documentation Synchronization Rule

Documentation must never be ahead of the code and must never be stale after code changes.

Required workflow for every feature/fix:

1. Implement code changes first.
2. Add/update tests and ensure they pass.
3. Run build verification.
4. Only then update documentation (`README.md`, `docs/syntax-coverage.md`, `docs/session-handoff.md`, and `docs/MAINTENANCE.md` when applicable) so docs exactly match shipped behavior.

Do not pre-document planned behavior. Document only implemented, tested behavior.

If exact Scryfall behavior is unclear:

- do not guess silently,
- document the chosen behavior,
- keep the design flexible enough to refine later.

---

## Build and Distribution Expectations

The final artifact should support CDN hosting and private webpage inclusion.

Preferred outputs:

- ESM bundle
- UMD or IIFE bundle for direct browser `<script>` usage if needed
- optionally a minified production bundle

The browser bundle should:

- expose a clean entry point,
- avoid leaking internals to global scope unless intentionally using a global build,
- keep extension registration easy from plain browser code.

A consumer should be able to do one of these:

```html
<script src="https://cdn.example.com/scryfall-es.js"></script>
<script>
  const engine = window.ScryfallES.createEngine();
</script>
```

or

```js
import { createEngine } from "scryfall-es";
```

---

## Testing Requirements

Every meaningful behavior change should include tests.

### Required test areas

- tokenizer behavior
- parser behavior
- AST shape stability
- compiler output
- field extension registration
- alias resolution
- custom field coercion
- negation / grouping / operator precedence
- browser bundle smoke test if practical

### Especially important

Test both:

- built-in fields
- runtime-injected custom fields

If custom field support breaks, the project is failing one of its main promises.

### Query-matrix coverage expectations

For DSL features that can compose, tests should include overlap and combination coverage, not only isolated atoms.

- include same-field overlap combinations (multiple terms targeting the same ES field)
- include cross-field overlap combinations (terms targeting different ES fields)
- include control + filter combinations that exercise result-shaping controls with query clauses
- include matrix combinations for `unique`, `order`, `direction`, and `prefer`, including repeated controls where last value should win
- include combinations where `prefer` appends additional sort clauses after explicit `order`

When adding tests for shortcut expansions (for example `is:default`), include:

- explicit per-atom tests for important atoms
- combined expansion tests with overlapping atoms
- combined tests that include search controls (`unique`, `order`, `prefer`, `direction`)

### Test correctness guardrail

Do not treat tests as snapshots of current behavior when behavior is potentially wrong.

- validate intended behavior first against source requirements (Scryfall docs/spec)
- do not change tests just to match implementation output without validating correctness
- adding incorrect code and then writing tests to confirm that incorrect code is an anti-pattern
- if implementation and tests disagree, resolve against requirements and document the decision in the PR/commit notes

---

## Documentation Requirements

Documentation should help users do three things quickly:

1. parse and compile a basic query
2. load the bundle in a webpage
3. extend the schema at runtime

At minimum, keep examples for:

- basic usage
- browser usage
- custom field registration
- numeric custom fields
- nested ES field path usage
- synthetic field compilation
- alias registration

If behavior differs from Scryfall proper, document it plainly.

---

## Code Style Expectations

### General

- Prefer small, composable modules
- Prefer descriptive names over clever ones
- Avoid overly magical metaprogramming
- Keep parser logic readable
- Keep public API surface intentional

### Error handling

- Fail loudly on malformed extension definitions
- Fail loudly on unknown operators where applicable
- Provide useful error messages for invalid query syntax
- Do not swallow parser/compiler errors unless the API explicitly supports recovery mode

### Comments

Comment the why, not the obvious what.
Parser edge cases and DSL mapping decisions should be documented where they are non-obvious.

---

## Performance Expectations

Performance matters, but correctness and extensibility come first.

Priorities:

1. correct parsing
2. stable AST
3. correct DSL generation
4. extension safety
5. optimization

Do not prematurely micro-optimize parser/compiler code in ways that make extension behavior harder to understand or maintain.

If performance work is done:

- benchmark before and after
- keep behavior identical
- avoid sacrificing debuggability

---

## Backward Compatibility Expectations

Because this project is intended for CDN use and private embedding:

- avoid breaking the public API casually
- avoid changing AST shape without a strong reason
- avoid changing compiler semantics silently

If a breaking change is necessary:

- document it clearly
- note migration steps
- preserve compatibility shims where practical

---

## Non-Goals

Unless explicitly requested, do not turn this project into:

- a full Elasticsearch client
- a hosted search service
- a UI framework
- a deckbuilder app
- a backend crawler/indexer
- a database migration tool

This repo is about parsing, compiling, bundling, and extending search syntax.

---

## Decision Heuristics for Agents

When making changes, prefer:

- cleaner extension points over hardcoded special cases
- AST cleanliness over shortcutting directly to ES DSL
- browser compatibility over Node-only convenience
- explicit user configuration over hidden assumptions
- documented behavior over “probably fine”

If forced to choose, optimize for:
**reusability + extension safety + predictable browser distribution**

---

## Good Changes

Examples of changes that align with this project:

- adding a field registry
- adding runtime alias registration
- adding percent coercion support
- adding nested field compiler hooks
- improving browser bundle output
- adding tests around enriched custom fields
- adding AST support for grouped boolean expressions

---

## Bad Changes

Examples of changes that should be avoided:

- hardcoding one user’s custom ES field directly into core parser logic
- making the browser build depend on Node runtime APIs
- collapsing parser and compiler into one opaque function
- silently overriding built-in field names during extension
- introducing framework-specific assumptions into the core library

---

## Example Custom Field Goal

A downstream consumer should be able to register something like:

```js
engine.extend({
  fields: {
    inclusion_percent: {
      aliases: ["inclusion_percent", "ip"],
      esPath: "edhrec.inclusion_percent",
      type: "number",
      parseValue: (v) => Number(v),
      compile: compileNumericField
    }
  }
});
```

and then successfully compile:

```txt
c:red inclusion_percent>1.4
```

without modifying the base library source.

That is not a bonus feature. That is a core design requirement.

---

## Final Rule

If a proposed implementation makes the core library harder to extend downstream, it is probably the wrong implementation.
