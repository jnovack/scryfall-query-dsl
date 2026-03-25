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
node --input-type=module -e "import https from 'node:https'; const body=JSON.stringify({size:0,aggs:{frame_effects:{terms:{field:'frame_effects',size:200}},promo_types:{terms:{field:'promo_types',size:200}},set_type:{terms:{field:'set_type',size:200}},rarity:{terms:{field:'rarity',size:50}},layout:{terms:{field:'layout',size:100}},image_status:{terms:{field:'image_status',size:50}},games:{terms:{field:'games',size:20}},finishes:{terms:{field:'finishes',size:20}},all_parts_component:{terms:{field:'all_parts.component',size:20}}}}); const req=https.request('https://elasticsearch.oz.local/cards/_search',{method:'POST',rejectUnauthorized:false,headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},(res)=>{let raw=''; res.on('data',d=>raw+=d); res.on('end',()=>{const data=JSON.parse(raw); const a=data.aggregations; const map={'frame_effects':'frame_effects','promo_types':'promo_types','set_type':'set_type','rarity':'rarity','layout':'layout','image_status':'image_status','games':'games','finishes':'finishes','all_parts_component':'all_parts.component'}; const out={}; for (const [agg,field] of Object.entries(map)){ out[field]=a[agg].buckets.map(b=>b.key);} console.log(JSON.stringify(out,null,2));});}); req.on('error',e=>{console.error(e.message); process.exit(1);}); req.write(body); req.end();"
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
node --input-type=module -e "import { createEngine } from './src/index.js'; const e=createEngine(); console.log(JSON.stringify(e.compileWithMeta('is:rare is:totallynewtoken'), null, 2));"
```

Goal-first validation reminder:

- tests should encode user-facing behavior goals, not just current implementation details
- do not change expected assertions just to match incorrect code paths
- if a test fails, confirm intended syntax behavior first, then fix code or tests accordingly

Expected:

- known tokens compile to DSL
- unknown tokens do not throw
- unknown tokens appear in `compileWithMeta().meta.terms.invalid`
- known terms appear in `compileWithMeta().meta.terms.valid`

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

## Quick Release Checklist

1. Update `src/fields/is-not-token-index.js`.
2. Update tests and docs in the same commit.
   `is:default` specific reminder: if shortcut semantics changed upstream, update `IS_DEFAULT_ATOMS` and the explicit `is:default` tests together.
   `is:commander` specific reminder: if semantic criteria change, update `semanticShortcuts.commander` in default field definitions and keep engine + `ctx.card` compile-shape tests in sync.
3. Run `npm test`.
4. Run `npm run build`.
5. Verify one known token and one unknown token with `compileWithMeta()`.
6. Tag/release.

## RC Closeout Checklist

Use this before cutting a release candidate:

1. Confirm package version is an RC tag (for example `0.2.0-rc.1`) in `package.json` and `package-lock.json`.
2. Run `npm test` and `npm run build`.
3. Ensure docs are synchronized with behavior:
   - `README.md`
   - `docs/SYNTAX-COVERAGE.md`
   - `docs/API.md`
   - `docs/PROFILES.md`
   - `docs/session-handoff.md`
4. Ensure `docs/session-handoff.md` includes a dated checkpoint with the most recent validation commands.
5. Verify the release notes section in `README.md` accurately describes shipped behavior and known limits.
6. Commit `dist/` artifacts for RC parity review.
