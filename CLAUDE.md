# CLAUDE.md

This is the canonical instruction file for `scryfall-query-dsl`. Repo-specific
rules are below; shared conventions (core rules, Node.js, documentation,
response expectations) come from the templates block at the bottom and the
inherited `~/.claude/CLAUDE.md`.

Goal: align and maintain parity with Scryfall search syntax.

## Scope

- Repository scope: `scryfall-query-dsl` only.
- This repo is a standalone parser/compiler library. It is not a UI app, service, crawler, or indexer.
- Primary deliverable: a reusable browser-safe JavaScript library that parses Scryfall-style syntax into an AST and compiles that AST into Elasticsearch DSL.

## Query Language Parity

- Maintain behavioral parity with Scryfall query language.
- When adding or changing query parsing, prefer Scryfall-compatible syntax and semantics over inventing new forms.
- If behavior intentionally differs from Scryfall, document the deviation in code comments or parser docs near the change.
- Do not break existing Scryfall-like queries without an explicit reason.

## Session start

- Read `docs/COMPANION_FILES.md` next, then only the companion docs relevant to
  the task.

## Repo-specific rules

- Prefer small composable modules over broad rewrites.
- Do not introduce UI, service, crawler, or app concerns unless explicitly requested.
- Keep runtime code browser-safe; do not add Node-only runtime dependencies to shipped bundle paths.
- Prefer base Scryfall semantics for built-ins.

## Architecture rules

- Keep parser, AST, compiler, and registry concerns separate.
- Keep AST nodes generic; do not bake Elasticsearch DSL structure into the AST unless there is a strong reason.
- Treat runtime extensibility as a first-class feature.
- Prefer explicit field/profile configuration over hardcoded special cases.
- Keep the public API stable unless a breaking change is explicitly required.

## Extension rules

- Consumers must be able to register fields, aliases, profiles, and compile behavior without editing core source.
- Do not silently replace built-ins.
- On collisions, fail loudly or require explicit override behavior.
- Keep merge behavior deterministic and documented.
- Keep schema-specific enrichments behind runtime extension points.

## Compiler rules

- Emit predictable Elasticsearch DSL.
- Do not assume every field is a simple term field.
- Preserve control/filter separation where the library already distinguishes search-body controls from boolean query clauses.
- When behavior differs from Scryfall, keep it internally consistent and document the deviation.

## Testing and validation

- For meaningful code changes, run `npm test` and `npm run build`.
- For syntax/compiler changes, add or update focused tests.
- Test both built-in behavior and runtime extension behavior when relevant.
- Do not change tests merely to bless incorrect behavior; resolve against documented behavior.

## Documentation sync

- Code and tests first; docs last. Update only the docs affected by the shipped change.
- Keep user-facing detail in `README.md` and `docs/`.
- Keep temporary session state in `docs/session-handoff.md` (task-specific), not here.
- Do not document planned behavior as if it already ships.
- When adding or modifying a query field in `src/fields/defaults.js`, include `description`
  and `examples` properties on the field definition object. The keyword reference page
  (`website/keywords.html`) is auto-generated from these properties at build time — no
  separate documentation file needs updating for field-level changes.
- Keyword docs anti-drift rules:
  - For first-order query fields (for example `stamp:`), update `src/fields/defaults.js`
    and keep `description` + `examples` current.
  - For token values under existing shortcut fields (for example `is:reprint`, `is:foil`),
    update `GROUPS` in `scripts/generate-keyword-docs.mjs` so section placement and
    supported/unsupported classification match shipped behavior.
  - Keep keyword docs classification aligned with engine behavior; do not leave supported
    tokens listed as unsupported.
- Update `docs/SYNTAX-COVERAGE.md` only for coverage *status* changes (new section supported,
  partial → full, etc.), not for individual field descriptions.

<!-- templates: lang-nodejs -->

<!-- BEGIN TEMPLATES v:1 hash:cd6a1ad9acaa -->
## node.js

### Module system

- Respect the repo's existing choice of ESM (`import`/`export`) or CJS (`require`/`module.exports`). Do not mix them.
- Match the `"type"` field in `package.json` — do not add or remove it.

### Package management

- Use whichever package manager the repo already uses (npm, yarn, pnpm). Do not switch.
- Commit the lockfile. In CI and clean checkouts, install with `npm ci` (or the
  manager's frozen-lockfile equivalent) — never `npm install`, which can silently
  rewrite the lockfile.
- Do not add a dependency without calling it out explicitly. Prefer packages already in `package.json`.
- Audit any new package before adding: `npm view <pkg>` for last publish date and maintenance signals,
  `npm audit` for known CVEs after installing.

### Async and error handling

- Use `async`/`await` throughout. Do not mix with raw `.then()`/`.catch()` chains in the same file.
- Every `async` function that can fail must have error handling at the call site or propagate explicitly.
- Do not swallow errors with empty `catch` blocks. At minimum, log and rethrow.
- Register `process.on('unhandledRejection', ...)` at the application entry point
  to log context before exiting. (Node already crashes on unhandled rejections by
  default — the handler exists for diagnostics, not to keep the process alive.
  Do not use it to suppress the crash.)
- Do not use synchronous `fs` methods (`readFileSync`, `writeFileSync`) in request handlers or hot paths.

### Code style

- `const` by default. `let` only when reassignment is required. Never `var`.
- Import Node builtins with the `node:` prefix (`import fs from 'node:fs'`,
  `require('node:path')`) — unambiguous and immune to registry typosquats.
- Prefer named functions over anonymous arrow functions for non-trivial logic — stack traces are more readable.
- Remove all `console.log` debug statements before committing. Use the repo's structured logger if one exists.
- Do not use `eval`, `new Function()`, or `vm.runInNewContext` with untrusted input.

### Security

- Validate and sanitize all user-supplied input before use in queries, file paths, or shell commands.
- Never pass user input directly to `child_process.exec` — use `execFile` with an argument array instead.
- Do not hardcode secrets, API keys, or credentials. Read from environment variables.
- If the repo is an HTTP server without security headers, flag it and suggest the
  framework-appropriate package (`helmet` for Express, `@fastify/helmet` for
  Fastify) — do not add it silently; dependency additions must be called out.

### Testing

- Match the existing test runner (Jest, Vitest, Mocha, etc.). Do not introduce a second one.
- For a new project with no runner, default to the built-in `node --test` (stable
  since Node 20) — zero dependencies; reach for Vitest/Jest only when the project
  needs their ecosystem (component testing, rich mocking, coverage UI).
- Use fake timers rather than real delays when a test must advance time (the
  no-arbitrary-sleeps rule is in Testing Philosophy).

### Validation

```bash
node --check src/index.js   # syntax check without running
npm test                    # run test suite
npm run lint                # if a lint script exists
```
<!-- END TEMPLATES -->
