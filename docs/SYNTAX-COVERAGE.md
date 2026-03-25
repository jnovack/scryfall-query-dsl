# Syntax Coverage

This document compares the current `scryfall-query-dsl` implementation against the syntax documented on Scryfall's search syntax page.

Status is based on the current source implementation, not on intended future behavior.

## Summary

This project currently supports a small but useful subset of Scryfall-style syntax:

- fielded terms like `field:value`, `field=value`, `field>value`, `field>=value`, `field<value`, `field<=value`
- bare terms like `lightning` (compiled as `name:lightning`)
- bare exact-name bang terms like `!fire`
- format legality fields (`f`, `format`, `legal`, `banned`, `restricted`)
- release date and year fields (`date`, `year`)
- quoted field values like `name:"Lightning Bolt"`, `o:"choose one or both"`, and `ft:"factory floor"`
- language preference sorting with `lang:` / `language:`
- implicit `AND`
- explicit `and`
- explicit `or`
- grouping with parentheses
- negation with `-`
- runtime registration of additional fields, aliases, value coercers, and compilers

It does **not** currently offer close parity with the full Scryfall syntax reference.

## Scryfall Section Tracker

This tracker mirrors the section order from `https://scryfall.com/docs/syntax` so implementation can proceed one section at a time with clear parity status.

| Scryfall section | Coverage status | Notes |
| --- | --- | --- |
| Colors and Color Identity | Supported | `c` / `color` and `id` / `identity` are implemented for set-style color matching, including colorless, multicolor, nickname groups, and comparison operators. |
| Card Types | Partial | `t` / `type` match against both `type_line` and `card_faces.type_line`; full Scryfall parity is not complete. |
| Card Text | Partial | `o` / `oracle` / `text` and `ft` / `flavor` compile across base and `card_faces` text paths and their `.prefix` / `.infix` subfields; no `~`, `fo:`, or regex parity. |
| Mana Costs | Unsupported | No mana-symbol grammar parity yet. |
| Power/Toughness/Loyalty | Partial | Numeric `pow` / `power` and `tou` / `toughness` are implemented against `power_num` / `toughness_num`. Loyalty and cross-field PT comparisons are still unsupported. |
| Multi-faced Cards | Unsupported | Not implemented as built-ins yet. |
| Spells/Permanents/Effects | Unsupported | Not implemented as built-ins yet. |
| Extra and Funny Cards | Unsupported | Not implemented as built-ins yet. |
| Tagger Tags | Unsupported | Not implemented as built-ins yet. |
| Rarity | Supported | `r` / `rarity` with keyword and comparison operators. |
| Sets/Blocks | Partial | `set:` and `st:` are supported; broader set/block syntax still pending. |
| Cubes | Unsupported | Not implemented as built-ins yet. |
| Format Legality | Supported | `f` / `format` / `legal` compile to `legalities.<format> = legal`; `banned` compiles to `not_legal`; `restricted` compiles to `restricted`. |
| USD/EUR/TIX Prices | Supported | `usd`, `eur`, and `tix` numeric comparisons are supported. |
| Artist/Flavor/Watermark | Partial | `ft` / `flavor` is implemented. Artist/watermark families remain unsupported. |
| Border/Frame/Foil/Resolution | Partial | `border:` and `frame:` field searches are supported; `frame` matches both `frame` and `frame_effects`; broader foil/stamp/resolution families still rely on partial shortcut coverage. |
| Games, Promos, & Spotlights | Partial | Some relevant token matching exists via `is:` / `not:` cross-reference fields. |
| Year | Supported | `year` comparisons are implemented against `released_at`; `date` comparisons are also implemented. |
| Reprints | Unsupported | Not implemented as built-ins yet. |
| Languages | Partial | `lang` / `language` preference sorting is implemented; broader language syntax (`lang:any`, `new:language`, `in:*`) is still unsupported. |
| Shortcuts and Nicknames | Partial | `is:` / `not:` shortcut token matching exists but does not yet cover full Scryfall semantics. |
| Negating Conditions | Partial | `-` negation works broadly; full `-field:value` parity work is in progress. |
| Regular Expressions | Unsupported | Not implemented. |
| Exact Names | Partial | Bare exact-name bang syntax is implemented (`!fire`, `!"sift through sands"`). Fielded bang forms are still unsupported. |
| Using OR | Supported | `or` with grouped boolean compilation is implemented. |
| Nesting Conditions | Supported | Parentheses and nested groups are implemented. |
| Display Keywords | Unsupported | Not implemented. |

## Fully Supported

These features are implemented in the parser and compiler today.

| Syntax area | Status | Notes | Examples |
| --- | --- | --- | --- |
| Implicit conjunction | Fully supported | Adjacent terms are combined as `AND`. | `c:red t:dragon mv<=5` |
| Explicit `and` | Fully supported | `and` is parsed case-insensitively. | `c:red and t:dragon` |
| Explicit `or` | Fully supported | Produces `bool.should` with `minimum_should_match: 1`. | `c:red or c:white` |
| Parentheses | Fully supported | Grouping works with nested boolean clauses. | `(c:red or c:white) t:angel` |
| Negation with `-` | Fully supported | Negates a term or parenthesized clause. | `-o:draw`, `-(c:red or c:white)` |
| Quoted string values | Fully supported | Double-quoted field values may contain spaces, parentheses, and the words `and` / `or`. Escaped quotes with `\"` are unescaped before compilation. Quoted name searches compile to `match_phrase`. | `name:"Lightning Bolt"`, `"lightning bolt"` |
| Numeric comparisons | Fully supported | `>`, `>=`, `<`, `<=`, `=`, `:` work for fields configured with numeric compilers. | `mv<=3`, `mv>5` |
| Basic field operators | Fully supported | `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` are accepted by the parser. Field definitions decide which are legal. Quoted values work with both `:` and `=`. | `t:dragon`, `name="Lightning Bolt"`, `mv!=3` |
| `is:` / `not:` token shortcuts | Fully supported (for configured fields) | Tokens are cross-referenced against configured keyword fields (`frame_effects`, `promo_types`, `set_type`, `rarity`, `layout`, `image_status`, `games`, `finishes`, `all_parts.component`). `is:` compiles as OR across matched fields; `not:` compiles as exclusion across matched fields. `is:default` expands to an explicit maintained atom list. `is:commander` is implemented as a dedicated semantic shortcut and does not change generic `is:` legality behavior. Unknown tokens are skipped and reported via `compileWithMeta()`. | `is:rare`, `is:showcase`, `not:playtest`, `not:etched`, `is:default`, `is:commander` |
| Rarity | Fully supported | `r` / `rarity` match ordered rarity keywords and support comparison operators over `common`, `uncommon`, `rare`, `mythic`, `special`, and `bonus`. | `r:rare`, `rarity>=rare` |
| Set code | Fully supported | `set` matches Scryfall set codes as a keyword field. | `set:lea` |
| Format legality | Fully supported | `f` / `format` / `legal` compile to `legalities.<format> = legal`; `banned` compiles to `legalities.<format> = not_legal`; `restricted` compiles to `legalities.<format> = restricted`. Supported operators: `:` and `=`. | `f:modern`, `format:commander`, `legal:pioneer`, `banned:legacy`, `restricted:vintage` |
| Date and year | Fully supported | `date` compiles to direct `released_at` comparisons and accepts `YYYY-MM-DD`; `year` compiles to year-bound `released_at` ranges. Supported operators: `:`, `=`, `>`, `>=`, `<`, `<=`. | `date>=2015-08-18`, `year<=1994` |
| Set type | Fully supported | `st` / `set_type` match `set_type` as a keyword field. | `st:masters`, `set_type:expansion` |
| Border color | Fully supported | `border` / `border_color` match `border_color` as a keyword field and work with unary negation. | `border:borderless`, `-border:yellow` |
| Frame | Fully supported | `frame` matches both `frame` and `frame_effects` as keyword fields and works with unary negation. | `frame:future`, `-frame:colorshifted`, `-frame:inverted` |
| Collector number | Fully supported | `cn` matches exact collector numbers and supports numeric comparisons for purely numeric collector numbers. To stay correct against the raw Scryfall `keyword` mapping, numeric comparisons compile as a script rather than a lexicographic range. | `cn:123a`, `cn>=123` |
| Prices | Fully supported | `usd`, `eur`, and `tix` compile as numeric price fields using the configured `prices.*` paths. | `usd<=0.50`, `eur>1.00`, `tix:2.5` |
| Power/Toughness numeric fields | Fully supported | `pow` / `power` and `tou` / `toughness` compile as numeric comparisons against `power_num` / `toughness_num`. | `pow>=3`, `power=1.5`, `tou!=2`, `toughness<=0.5` |
| Keywords | Fully supported | `kw`, `keyword`, and `keywords` compile as exact keyword matches against `keywords`. | `kw:Flying`, `keywords:Defender` |
| Unique result modes | Fully supported | `unique:cards` collapses on `oracle_id`, `unique:art` collapses on `illustration_id`, and `unique:prints` leaves print-level results unchanged. | `unique:cards`, `unique:art`, `unique:prints` |
| Implicit sort for `unique:cards` | Fully supported | If `unique:cards` is present without an explicit `order:`, the compiler applies `order:name` ascending to keep card-level results deterministic. | `lightning unique:cards`, `not:showcase unique:cards` |
| Primary sort order | Fully supported | `order:` sets the primary sort field and supports `cmc`, `power`, `toughness`, `set`, `name`, `usd`, `eur`, `tix`, `rarity`, `color`, `released`, and `edhrec`. | `order:cmc`, `order:rarity`, `order:edhrec` |
| Sort direction | Fully supported | `direction:` applies `asc` or `desc` to the active order. | `direction:asc`, `direction:desc` |
| Preference sort | Fully supported | `prefer:` adds tie-breaker and preference sorts for `oldest`, `newest`, `usd-low`, `usd-high`, `promo`, `default`, `atypical`, `ub` / `universesbeyond`, and `notub` / `notuniversesbeyond`. `prefer:default` is a real preference sort, not a no-op. | `prefer:oldest`, `prefer:promo`, `prefer:notub`, `prefer:default` |
| Language preference sort | Fully supported | `lang` / `language` compiles as a top-priority sort preference on `lang` so matching languages are ranked first while non-matching languages remain eligible. No built-in language-code validation is applied. | `lang:ja`, `language:es order:name` |
| Colors and color identity | Fully supported | `c` / `color` target `colors` OR `card_faces.colors`; `id` / `identity` target base Scryfall `color_identity`. Single-letter colors, concatenated color sets like `uw`, popular nickname groups (guilds/shards/wedges/colleges/four-color names), `c` for colorless, `m` or `multicolor` for multicolor, and set comparisons with `:`, `=`, `>`, `>=`, `<`, `<=` are implemented. Emitted Elasticsearch terms use Scryfall's uppercase symbols `W/U/B/R/G`. Colorless compiles as missing/empty fields (`id:c` => missing `color_identity`; `c:c` => missing `colors` and `card_faces.colors`). | `c:red`, `c:azorius`, `c:altruism`, `c:m`, `c:multicolor`, `id<=esper`, `id:c` |
| Not-equals on comparison fields | Fully supported | `!=` is supported for comparison-style built-ins: color/color identity, mana value, rarity, collector number, and prices (`usd` / `eur` / `tix`). It is intentionally unsupported for keyword/text/control/shortcut fields to mirror Scryfall behavior. | `mv!=3`, `r!=rare`, `cn!=123`, `c!=mardu`, `id!=c`, `usd!=1.25` |
| Runtime extension API | Fully supported | New fields and aliases can be registered without editing core source. | `engine.extend({ fields: { ... } })` |

## Partially Supported

These syntax areas are present in some form, but they do not currently match Scryfall semantics completely.

| Syntax area | Status | Current behavior | Gap vs Scryfall |
| --- | --- | --- | --- |
| Card text | Partial | `o`, `oracle`, and `text` compile as a `bool.should` disjunction of `match` clauses across `oracle_text`, `oracle_text.prefix`, `oracle_text.infix`, `card_faces.oracle_text`, `card_faces.oracle_text.prefix`, and `card_faces.oracle_text.infix`. `ft` / `flavor` follows the same pattern on `flavor_text` and `card_faces.flavor_text`. Quoted string values are parsed correctly. | No `~` substitution, `fo:`, regex, or exact Scryfall tokenization semantics. |
| Card types | Partial | `t` and `type` compile as a `bool.should` disjunction of `match` clauses across `type_line` and `card_faces.type_line`. Quoted string values are parsed correctly. | No regex mode and no explicit subtype/supertype handling beyond whatever the target analyzer does. |
| Name searches | Partial | `name` and `n` compile to a weighted `bool.should` disjunction (`name`, `name.prefix`, `name.infix`, fuzzy `name` with stricter prefix lock); `name=` uses the same include-style behavior; quoted name searches compile to `match_phrase`; bare terms use the same weighted name behavior and adjacent bare terms stay separate under implicit `AND`; bare bang exact-name syntax (`!fire`) compiles to strict `term` disjunction over `name.keyword` and `card_faces.name.keyword`. | No regex mode and no fielded bang forms (`!name:...`, `!o:...`). |
| Mana value | Partial | `mv` and `cmc` support numeric range, equality, and `!=` comparisons. | No support for `manavalue:odd`, `manavalue:even`, or alternate Scryfall mana-value semantics beyond numeric comparison. |
| Shortcut parity vs Scryfall | Partial | `is:` and `not:` are implemented as token cross-references plus explicit semantic handling for `is:default` and `is:commander`, but they still do not cover every Scryfall shortcut family. | `is:dual`, `is:fetchland`, `not:reprint` |

## Unsupported

The following syntax areas from the Scryfall syntax reference are currently unsupported as built-ins.

| Syntax area | Examples from Scryfall-style usage |
| --- | --- |
| Additional color-adjacent syntax outside basic color-set matching | `has:indicator` |
| `has:` family | `has:indicator`, `has:watermark` |
| Full Oracle text and keyword ability searches | `fo:` |
| Mana cost syntax | `m:{G}{U}`, `m>3WU`, `produces=wu`, `devotion:{u/b}{u/b}{u/b}` |
| Power/toughness cross-field math and loyalty | `pow>tou`, `loy=3`, `pt=10` |
| Multi-faced card shortcuts | `is:split`, `is:transform`, `is:meld`, `is:mdfc` |
| Spell/permanent/effect shortcuts | `is:spell`, `is:permanent`, `is:historic`, `is:modal`, `is:vanilla` |
| Extras/funny/include modifiers | `include:extras`, `is:funny` |
| Rarity syntax beyond the built-in rarity field | `new:rarity`, `in:rare` |
| Edition and block families beyond `set` / `st` | `e:war`, `b:wwk` |
| Cube queries | `cube:vintage` |
| Commander/companion/reserved-list shortcuts | `is:companion`, `is:reserved` |
| Price queries beyond the built-in price fields | `cheapest:usd` |
| Artist, watermark, art counts | `a:"proce"`, `wm:orzhov`, `artists>1`, `illustrations>1` |
| Border/frame families beyond basic fielded matching | `is:foil`, `stamp:acorn`, `is:hires` |
| Game and platform availability | `game:arena`, `in:mtgo`, `is:digital`, `is:promo`, `is:spotlight` |
| Tagger tags | `art:squirrel`, `function:removal`, `otag:removal` |
| Reprint and print-count syntax | `is:reprint`, `not:reprint`, `sets>=20`, `papersets=1` |
| Language syntax beyond `lang` preference sorting | `lang:any`, `new:language`, `in:ru` |
| Shortcut land nicknames and Masterpiece shortcuts | `is:dual`, `is:fetchland`, `is:masterpiece` |
| Full `not:` parity | `not:reprint`, `not:spell` |
| Regular-expression searches | `o:/^{T}:/`, `name:/\\bizzet\\b/` |
| Display-control keywords | `display:text`, `display:oracle` |
| Keyword/Text/Control `!=` | `border!=yellow`, `name!=bolt`, `order!=name` |

## Important Assumptions

The base built-ins must match raw Scryfall card data, not pipeline-enriched fields from other repositories.

Specifically:

- do not assume custom fields such as `slugs`
- `colors` is a keyword array of uppercase symbols: `W/U/B/R/G`
- `card_faces.colors` is a keyword array of uppercase symbols: `W/U/B/R/G` when card faces are indexed
- `color_identity` is a keyword array of uppercase symbols: `W/U/B/R/G`
- `cmc` is numeric
- `power_num` and `toughness_num` are numeric when PT numeric operators/sorts are used
- `name`, `type_line`, `oracle_text`, and `flavor_text` are text fields
- `card_faces.type_line` is searchable text
- `card_faces.oracle_text` is searchable text when present in the index mapping
- `card_faces.flavor_text` is searchable text when present in the index mapping
- `name.keyword` and `card_faces.name.keyword` are required for exact-name bang behavior (`!`)
- `name.prefix` / `name.infix` are mapped when loose name behavior is expected
- `oracle_text.prefix` / `oracle_text.infix` and `flavor_text.prefix` / `flavor_text.infix` are mapped when built-in partial text behavior is expected
- `card_faces.oracle_text.prefix` / `card_faces.oracle_text.infix` and `card_faces.flavor_text.prefix` / `card_faces.flavor_text.infix` are mapped when face-level partial text behavior is expected

## Known Deviations From Scryfall

These are the most important behavior differences even within superficially similar syntax.

1. Bare terms are interpreted as `name:` searches.
   Scryfall loose-word behavior is broader than name-only matching and can target other fields.

2. Regular expressions are not supported.
   Scryfall supports `/.../` regex for several text-oriented fields; this library does not.

3. `!=` is intentionally limited to comparison-style fields.
   It is rejected for keyword/text/control/shortcut fields to mirror Scryfall behavior (for example `border!=yellow`).

4. Text semantics depend on Elasticsearch analyzers, not Scryfall's search engine.
   `t:` compiles to Elasticsearch `match` queries across base and `card_faces` type fields. `o:` and `ft:` compile to `match` disjunctions across base and `card_faces` text fields plus `.prefix` / `.infix` subfields.

5. `=` semantics vary by field family.
   `name=` is intentionally include-style (same loose weighted behavior as `name:`), while many other fields still treat `=` as exact/value equality based on their compiler.

6. `is:` / `not:` are token cross-references, not full Scryfall semantic families.
   Tokens are matched against configured field-value cross-references and do not yet implement all Scryfall shortcut semantics.

7. Color matching assumes base Scryfall card storage.
   The built-in `c` compiler targets `colors` and `card_faces.colors`, while `id` targets `color_identity`, using uppercase symbols such as `R` and `U`. If a downstream index stores transformed color data, consumers should override those field definitions.

8. Rarity comparisons assume a fixed ordering.
   The built-in rarity field orders values as `common`, `uncommon`, `rare`, `mythic`, `special`, `bonus` when using comparison operators.

9. Collector number comparisons are numeric-only.
   Exact `cn:` and `cn=` accept any collector number string, but comparison operators only behave numerically for collector numbers that are purely digits.

10. `unique`, `order`, `prefer`, `direction`, and `lang` compile into search-body controls, not filter clauses.
   They are intentionally removed from the boolean query tree and applied as top-level `collapse` and `sort` settings, so `compile()` returns a search body when they are present.

11. `lang:` is currently a ranking preference, not an inclusion filter.
   Matching language prints are sorted ahead of others; non-matching languages are still returned.

12. Unknown `is:` / `not:` tokens are intentionally non-fatal.
   They are skipped from DSL and surfaced through `compileWithMeta().meta`.

13. `keyword:` currently maps to the built-in `keywords` field alias.
   This is an exact `term` lookup on `keywords`, not full Scryfall keyword-ability search semantics.

14. `order:oldest` and `order:newest` are not valid sort orders.
   Use `prefer:oldest` or `prefer:newest` for print recency preference.

15. Built-in partial text behavior assumes matching subfields in mapping.
   If `.prefix` / `.infix` subfields are missing for `name`, `oracle_text`, or `flavor_text` paths, those clauses cannot execute as intended.

16. Exact-name bang syntax is intentionally narrow in this pass.
   Bare bang terms (`!fire`, `!"..."`) compile to exact keyword terms over `name.keyword` and `card_faces.name.keyword`; fielded bang forms are intentionally rejected.

17. `=` and `!=` intentionally diverge on keyword fields.
   Keyword equality can be valid (`border=yellow`), while keyword not-equals is intentionally invalid (`border!=yellow`).

18. `date:` currently expects explicit ISO-like calendar dates.
   Inputs like `date>ori` are not supported in this pass; use `YYYY-MM-DD` values.

## Known Gotchas

The implementation is still far from full Scryfall parity.

Major missing areas:

- regex syntax
- `lang:any`, `new:language`, and broader language-query semantics beyond ranking preference
- full Scryfall-parity `is:` / `not:` semantics beyond current `is:default` + `is:commander` handling
- `has:` / `include:` families
- mana syntax
- power/toughness cross-field math and loyalty syntax
- remaining display keywords

See `docs/SYNTAX-COVERAGE.md` for the authoritative breakdown.

Known sort-control gotcha:

- `order:oldest` and `order:newest` are not valid `order` values at compile time.
- Use `prefer:oldest` and `prefer:newest` for print recency behavior.

## Planned Support

These are the most sensible next steps if the goal is closer Scryfall parity.

1. Expand `is:` / `not:` token coverage to closer Scryfall parity and add `has:` / `include:`.
2. Broaden exact-name `!` support beyond bare bang terms (for example fielded bang behavior if desired).
3. Add regex token support for `name`, `t`, `o`, and `ft`.
4. Expand the built-in field registry to cover the remaining Scryfall syntax families documented on the reference page.
5. Add conformance tests that mirror the Scryfall syntax categories one section at a time.

## Built-in Syntax Supported Today

Built-in profiles:

- `default` (native Scryfall-shaped paths)
- `ctx.card` (same built-ins + controls remapped to `card.*`)

When search directives are present, `compile()` returns a search body with `query` plus `collapse` and/or `sort` settings instead of a plain query clause.
`unique:cards` applies an implicit ascending `name` sort when no explicit `order:` is supplied.
`lang:xx` ranks matching `lang` values first via sort without filtering out non-matching language prints.

`compileWithMeta()` is available for graceful `is:` / `not:` handling:

- returns `{ dsl, meta }`
- `meta.terms.valid` includes successfully compiled full terms (for example `is:rare`)
- `meta.terms.invalid` includes skipped unknown full terms (for example `is:bibbityboppityboo`)
- `meta.warnings` includes `UNKNOWN_IS_NOT_TOKEN` entries

Name-specific behavior:

- quoted name input compiles to `match_phrase` (for example `"lightning bolt"` or `name:"Lightning Bolt"`)
- unquoted `name` and bare-term input compile to a weighted `bool.should` over `name`, `name.prefix`, `name.infix`, and fuzzy `name` (`prefix_length` capped at `3` based on shortest token length)
- adjacent unquoted bare terms remain separate terms and compile as implicit `AND` (for example `lightning bolt` => `name:lightning` AND `name:bolt`)
- `name=` and `n=` use the same include-style weighted name behavior (for example `name=jace`)
- exact-name bang input compiles to strict `term` disjunction over `name.keyword` and `card_faces.name.keyword`
- fielded bang forms such as `!name:fire` and `!o:draw` are intentionally rejected

Text field behavior:

- `o` / `oracle` / `text` compiles to a disjunction over `oracle_text`, `oracle_text.prefix`, `oracle_text.infix`, `card_faces.oracle_text`, `card_faces.oracle_text.prefix`, and `card_faces.oracle_text.infix`
- `ft` / `flavor` compiles similarly over `flavor_text` and `card_faces.flavor_text` with `.prefix` / `.infix`

`is:` / `not:` cross-reference currently maps tokens across:

- `frame_effects`
- `promo_types`
- `set_type`
- `rarity`
- `layout`
- `image_status`
- `games`
- `finishes`
- `all_parts.component`

`is:default` is explicitly expanded as:

- `not:showcase`
- `not:extendedart`
- `-border:borderless`
- `not:fracturefoil`
- `not:etched`
- `not:stamped`
- `not:datestamped`
- `not:fullart`
- `not:surgefoil`
- `not:galaxyfoil`
- `-st:masterpiece`
- `-frame:future`
- `-frame:colorshifted`
- `not:playtest`
- `-frame:inverted`
- `-border:yellow`

`is:commander` is implemented as a dedicated semantic shortcut:

- structural branch:
  - `legalities.commander` is not `banned`
  - `type_line` or `card_faces.type_line` contains `legendary`
  - (`artifact` or `creature`) in `type_line` / `card_faces.type_line`
  - `exists power` and `exists toughness`
- text exception branch:
  - phrase match `can be your commander` on `oracle_text` or `card_faces.oracle_text`
- generic `is:` token handling remains token-map based and is not legality-coupled

Color support currently includes:

- single colors like `c:red`
- compact sets like `c:uw`
- named groups like `c:azorius`, `id:esper`
- popular nicknames across guilds, shards, wedges, colleges, and four-color groups (for example `c:altruism`)
- colorless via `c:c` and `id:c`
- multicolor via `c:m` / `c:multicolor` and `id:m` / `id:multicolor`
- comparisons with `:`, `=`, `>`, `>=`, `<`, `<=`
- `id:c` compiles to missing/empty `color_identity`
- `c:c` compiles to missing/empty `colors` and missing/empty `card_faces.colors`
- collector number comparisons are numeric-only and intentionally avoid lexicographic `keyword` ranges
- `!=` is supported for comparison-style fields (`c`/`id`, `mv`/`cmc`, `pow`/`power`, `tou`/`toughness`, `r`/`rarity`, `cn`, `usd`/`eur`/`tix`)
- `!=` is intentionally rejected for keyword/text/control/shortcut fields (for example `border!=yellow`, `name!=bolt`, `order!=name`, `is!=rare`)

### Examples

```txt
c:red
c:azorius
c:altruism
c:colorless
id<=esper
id:c
t:dragon
mv<=3
-o:draw
(c:red or c:white) t:angel
o:"choose one or both"
ft:factory
kw:Flying
st:masters
border:borderless
frame:future
name="Lightning Bolt"
name:"Lightning Bolt"
r:rare
is:rare
is:default
not:showcase
set:lea
f:modern
banned:legacy
restricted:vintage
date>=2015-08-18
year<=1994
cn:123a
mv!=3
r!=rare
c!=mardu
name=jace
usd<=0.50
order:cmc direction:desc
prefer:oldest
unique:cards
prefer:default
lightning unique:cards not:showcase
"lightning bolt"
lightning bolt
!fire
```

### Parses, but does not match Scryfall semantics exactly

```txt
o:draw
```

In Scryfall, this uses Scryfall's text-search behavior. In this library it compiles to Elasticsearch `match` clauses across `oracle_text` and mapped partial subfields.

### Does not work today

```txt
m:{G}{U}
lang:any
name:/\bizzet\b/
border!=yellow
```

## Sources

- Scryfall syntax reference: <https://scryfall.com/docs/syntax>
- Mirrored syntax reference used for line-by-line comparison: <https://cran.r-universe.dev/scryr/doc/syntax.html>
