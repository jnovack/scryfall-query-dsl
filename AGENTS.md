# AGENTS.md

## Scope

- Repository scope: `scryfall-query-dsl` only.
- This repo is a standalone parser/compiler library. It is not a UI app, service, crawler, or indexer.
- Primary deliverable: a reusable browser-safe JavaScript library that parses Scryfall-style syntax into an AST and compiles that AST into Elasticsearch DSL.

## Session start

- Read this file first.
- Read `docs/COMPANION_FILES.md` next.
- Then read only the companion docs relevant to the task.
- Do not load unrelated docs by default.

## Core rules

- Keep changes minimal, localized, and review-friendly.
- Preserve existing naming, file layout, and module boundaries unless a change is required.
- Prefer small composable modules over broad rewrites.
- Do not introduce UI, service, crawler, or app concerns unless explicitly requested.
- Keep runtime code browser-safe; do not add Node-only runtime dependencies to shipped bundle paths.

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

## Compiler rules

- Emit predictable Elasticsearch DSL.
- Do not assume every field is a simple term field.
- Preserve control/filter separation where the library already distinguishes search-body controls from boolean query clauses.
- When behavior differs from Scryfall, keep it internally consistent and document the deviation.

## Testing and validation

- For meaningful code changes, run `npm test` and `npm run build`.
- For syntax/compiler changes, add or update focused tests.
- Test both built-in behavior and runtime extension behavior when relevant.
- If tests are not run, state exactly what was not run and why.
- Do not change tests merely to bless incorrect behavior; resolve against documented behavior.

## Documentation sync

- Code and tests first; docs last.
- Update only the docs affected by the shipped change.
- Keep user-facing detail in `README.md` and `docs/`.
- Keep temporary session state in `docs/session-handoff.md`, not here.
- Do not document planned behavior as if it already ships.

## Response expectations

- Summarize exactly what changed.
- Mention assumptions briefly.
- Call out breaking changes, migration steps, or Scryfall-parity deviations when relevant.
