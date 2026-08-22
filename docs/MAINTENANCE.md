# Maintenance Runbook

This document is for fast, repeatable updates when upstream card data behavior changes (for example Scryfall adds new tokens).

## Scope

Use this runbook when any of the following change upstream:

- new values in `frame_effects`
- new values in `promo_types`
- new values in `set_type`
- new values in `rarity`
- new values in `layout`
- new values in `image_status`
- new values in `games`
- new values in `finishes`
- new values in `all_parts.component`

These values feed `is:` / `not:` token cross-reference behavior via:

- `src/fields/is-not-token-index.js`

`is:default` atom expansion is also maintained in:

- `src/fields/is-not-token-index.js` (`IS_DEFAULT_ATOMS`)

## Required Tasks

1. Pull the latest token values from a real cards index.

```bash
node --input-type=module -e "import https from 'node:https'; const body=JSON.stringify({size:0,aggs:{frame_effects:{terms:{field:'frame_effects',size:200}},promo_types:{terms:{field:'promo_types',size:200}},set_type:{terms:{field:'set_type',size:200}},rarity:{terms:{field:'rarity',size:50}},layout:{terms:{field:'layout',size:100}},image_status:{terms:{field:'image_status',size:50}},games:{terms:{field:'games',size:20}},finishes:{terms:{field:'finishes',size:20}},all_parts_component:{terms:{field:'all_parts.component',size:20}}}}); const req=https.request('https://elasticsearch.domain.local/cards/_search',{method:'POST',rejectUnauthorized:false,headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},(res)=>{let raw=''; res.on('data',d=>raw+=d); res.on('end',()=>{const data=JSON.parse(raw); const a=data.aggregations; const map={'frame_effects':'frame_effects','promo_types':'promo_types','set_type':'set_type','rarity':'rarity','layout':'layout','image_status':'image_status','games':'games','finishes':'finishes','all_parts_component':'all_parts.component'}; const out={}; for (const [agg,field] of Object.entries(map)){ out[field]=a[agg].buckets.map(b=>b.key);} console.log(JSON.stringify(out,null,2));});}); req.on('error',e=>{console.error(e.message); process.exit(1);}); req.write(body); req.end();"
```

1. Update token arrays in `src/fields/is-not-token-index.js` to match upstream.
2. Keep values lowercase and exact (no normalization guesses).
3. Do not remove existing tokens unless upstream removed them and you are intentionally making behavior stricter.
4. If a token appears in multiple fields (for example `etched`), ensure it stays in all relevant arrays.
5. If upstream `is:default` semantics change, update `IS_DEFAULT_ATOMS` to match Scryfall's current definition exactly.
6. After changing `IS_DEFAULT_ATOMS`, update tests for explicit `is:default` expansion terms.

## Validation

Run all of the following:

```bash
npm test
npm run build
```

`ctx.card` note:

- The test suite includes contract/parity checks for the built-in `ctx.card` profile.
- If built-in fields or control mappings drift, those tests should fail before release.
- Do not bypass those failures by weakening assertions; fix derivation/control mappings instead.

Then run ad-hoc checks:

```bash
node --input-type=module -e "import { createEngine } from './src/index.js'; const e=createEngine(); console.log(JSON.stringify(e.compile('is:rare'), null, 2));"
node --input-type=module -e "import { createEngine } from './src/index.js'; const e=createEngine(); console.log(JSON.stringify(e.compile('not:playtest'), null, 2));"
node --input-type=module -e "import { createEngine } from './src/index.js'; const e=createEngine(); console.log(JSON.stringify(e.compile('is:rare is:totallynewtoken'), null, 2));"
```

Goal-first validation reminder:

- tests should encode user-facing behavior goals, not just current implementation details
- do not change expected assertions just to match incorrect code paths
- if a test fails, confirm intended syntax behavior first, then fix code or tests accordingly

Expected:

- known tokens compile to DSL
- unknown tokens do not throw
- unknown tokens appear in `compile().meta.terms.invalid`
- known terms appear in `compile().meta.terms.valid`

## Documentation Sync (Required)

When token behavior changes, update all of:

- `README.md`
- `docs/SYNTAX-COVERAGE.md`
- `docs/API.md`
- `docs/session-handoff.md`
- `docs/PROFILES.md` (if profile/field/helper behavior is touched)
- `docs/MAINTENANCE.md` (this file)
- `test/engine.test.js`
- `test/ctx-card-profile.test.js` (if built-in profile behavior is touched)

## Versioning

**The git tag is the version.** Do not edit `version` in `package.json` or
`package-lock.json` by hand, and do not write a version heading in
`CHANGELOG.md` — `git release` produces all three at tag time.

While working, changelog entries go under `## [Unreleased]`. The release step
retitles that section to the version being tagged, because the number is not
decided until then.

`git release` calls `.githooks/version write <x.y.z>`, which applies the version
to `package.json`, both `package-lock.json` entries, and `CHANGELOG.md`, then
runs the tests and rebuilds `dist/` and `website/index.html` so every generated
artifact carries the released version. It commits that as
`chore(release): vX.Y.Z` and pushes before tagging.

`.githooks/pre-push` refuses to push a version tag that disagrees with
`package.json` at that commit — the backstop for a hand-typed `git tag`. Git has
no pre-tag hook, so a bad tag is caught at push; remove it with `git tag -d`.

Hooks activate through `core.hooksPath`, set by the `prepare` script on
`npm install`. A fresh clone is unprotected until someone installs.

The contract these files implement is documented in
`~/Source/dotfiles/docs/git-release.md`.

## Release Checklist

1. Update behavior, tests, and docs in the same commit.
   `is:default` specific reminder: if shortcut semantics changed upstream, update `IS_DEFAULT_ATOMS` and the explicit `is:default` tests together.
   `is:commander` specific reminder: if semantic criteria change, update `semanticShortcuts.commander` in default field definitions and keep engine + `ctx.card` compile-shape tests in sync.
2. Add entries under `## [Unreleased]` in `CHANGELOG.md`.
3. Ensure docs are synchronized with behavior:
   - `README.md`
   - `docs/SYNTAX-COVERAGE.md`
   - `docs/API.md`
   - `docs/PROFILES.md`
   - `docs/session-handoff.md`
4. Run `npm test` and `npm run build`.
5. Verify one known token and one unknown token using `compile()` and inspecting `meta.terms`.
6. `git autocommit` — the working tree must be clean before releasing; `git release` refuses a dirty tree rather than sweeping unrelated work into the release commit.
7. `git release minor` (or `major` / `patch`, or an explicit `git release vX.Y.Z`
   to land a final release after RCs — tag math counts up from the newest tag,
   including prereleases).
8. Confirm GitHub Pages redeployed with the new version. The Pages bundle is
   rebuilt in CI at the pushed commit and is what downstream consumers pin:

   ```bash
   curl -sL https://jnovack.github.io/scryfall-query-dsl/dist/scryfall-query-dsl.js | grep -o 'RELEASE = true ? "[^"]*"'
   ```

The `dist/` committed in the repo embeds `version+<short sha>` where the sha is
read at build time, so it names the release commit's *parent*. That is expected:
the committed copy exists for parity review, while CI rebuilds the bundle Pages
actually serves.
