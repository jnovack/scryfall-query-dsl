# Syntax Coverage

This document compares the current `scryfall-query-dsl` implementation against the syntax documented on Scryfall's search syntax page.

Status is based on the current source implementation, not on intended future behavior.

## Summary

This project currently supports a small but useful subset of Scryfall-style syntax:

- fielded terms like `field:value`, `field=value`, `field>value`, `field>=value`, `field<value`, `field<=value`
- bare terms like `lightning` (compiled as `name:lightning`)
- quoted field values like `name:"Lightning Bolt"` and `o:"choose one or both"`
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
| Card Text | Partial | `o` / `oracle` / `text` match against both `oracle_text` and `card_faces.oracle_text`; no `~`, `fo:`, or regex parity. |
| Mana Costs | Unsupported | No mana-symbol grammar parity yet. |
| Power/Toughness/Loyalty | Unsupported | Not implemented as built-ins yet. |
| Multi-faced Cards | Unsupported | Not implemented as built-ins yet. |
| Spells/Permanents/Effects | Unsupported | Not implemented as built-ins yet. |
| Extra and Funny Cards | Unsupported | Not implemented as built-ins yet. |
| Tagger Tags | Unsupported | Not implemented as built-ins yet. |
| Rarity | Supported | `r` / `rarity` with keyword and comparison operators. |
| Sets/Blocks | Partial | `set:` and `st:` are supported; broader set/block syntax still pending. |
| Cubes | Unsupported | Not implemented as built-ins yet. |
| Format Legality | Unsupported | Not implemented as built-ins yet. |
| USD/EUR/TIX Prices | Supported | `usd`, `eur`, and `tix` numeric comparisons are supported. |
| Artist/Flavor/Watermark | Unsupported | Not implemented as built-ins yet. |
| Border/Frame/Foil/Resolution | Partial | `border:` and `frame:` field searches are supported; `frame` matches both `frame` and `frame_effects`; broader foil/stamp/resolution families still rely on partial shortcut coverage. |
| Games, Promos, & Spotlights | Partial | Some relevant token matching exists via `is:` / `not:` cross-reference fields. |
| Year | Unsupported | Not implemented as built-ins yet. |
| Reprints | Unsupported | Not implemented as built-ins yet. |
| Languages | Partial | `lang` / `language` preference sorting is implemented; broader language syntax (`lang:any`, `new:language`, `in:*`) is still unsupported. |
| Shortcuts and Nicknames | Partial | `is:` / `not:` shortcut token matching exists but does not yet cover full Scryfall semantics. |
| Negating Conditions | Partial | `-` negation works broadly; full `-field:value` parity work is in progress. |
| Regular Expressions | Unsupported | Not implemented. |
| Exact Names | Unsupported | `!name` exact-name syntax is not implemented. |
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
| Basic field operators | Fully supported | `:`, `=`, `>`, `>=`, `<`, `<=` are accepted by the parser. Field definitions decide which are legal. Quoted values work with both `:` and `=`. | `t:dragon`, `name="Lightning Bolt"` |
| `is:` / `not:` token shortcuts | Fully supported (for configured fields) | Tokens are cross-referenced against configured keyword fields (`frame_effects`, `promo_types`, `set_type`, `rarity`, `layout`, `image_status`, `games`, `finishes`, `all_parts.component`). `is:` compiles as OR across matched fields; `not:` compiles as exclusion across matched fields. `is:default` expands to an explicit maintained atom list. Unknown tokens are skipped and reported via `compileWithMeta()`. | `is:rare`, `is:showcase`, `not:playtest`, `not:etched`, `is:default` |
| Rarity | Fully supported | `r` / `rarity` match ordered rarity keywords and support comparison operators over `common`, `uncommon`, `rare`, `mythic`, `special`, and `bonus`. | `r:rare`, `rarity>=rare` |
| Set code | Fully supported | `set` matches Scryfall set codes as a keyword field. | `set:lea` |
| Set type | Fully supported | `st` / `set_type` match `set_type` as a keyword field. | `st:masters`, `set_type:expansion` |
| Border color | Fully supported | `border` / `border_color` match `border_color` as a keyword field and work with unary negation. | `border:borderless`, `-border:yellow` |
| Frame | Fully supported | `frame` matches both `frame` and `frame_effects` as keyword fields and works with unary negation. | `frame:future`, `-frame:colorshifted`, `-frame:inverted` |
| Collector number | Fully supported | `cn` matches exact collector numbers and supports numeric comparisons for purely numeric collector numbers. To stay correct against the raw Scryfall `keyword` mapping, numeric comparisons compile as a script rather than a lexicographic range. | `cn:123a`, `cn>=123` |
| Prices | Fully supported | `usd`, `eur`, and `tix` compile as numeric price fields using the configured `prices.*` paths. | `usd<=0.50`, `eur>1.00`, `tix:2.5` |
| Keywords | Fully supported | `kw`, `keyword`, and `keywords` compile as exact keyword matches against `keywords`. | `kw:Flying`, `keywords:Defender` |
| Unique result modes | Fully supported | `unique:cards` collapses on `oracle_id`, `unique:art` collapses on `illustration_id`, and `unique:prints` leaves print-level results unchanged. | `unique:cards`, `unique:art`, `unique:prints` |
| Implicit sort for `unique:cards` | Fully supported | If `unique:cards` is present without an explicit `order:`, the compiler applies `order:name` ascending to keep card-level results deterministic. | `lightning unique:cards`, `not:showcase unique:cards` |
| Primary sort order | Fully supported | `order:` sets the primary sort field and supports `cmc`, `power`, `toughness`, `set`, `name`, `usd`, `eur`, `tix`, `rarity`, `color`, `released`, and `edhrec`. | `order:cmc`, `order:rarity`, `order:edhrec` |
| Sort direction | Fully supported | `direction:` applies `asc` or `desc` to the active order. | `direction:asc`, `direction:desc` |
| Preference sort | Fully supported | `prefer:` adds tie-breaker and preference sorts for `oldest`, `newest`, `usd-low`, `usd-high`, `promo`, `default`, `atypical`, `ub` / `universesbeyond`, and `notub` / `notuniversesbeyond`. `prefer:default` is a real preference sort, not a no-op. | `prefer:oldest`, `prefer:promo`, `prefer:notub`, `prefer:default` |
| Language preference sort | Fully supported | `lang` / `language` compiles as a top-priority sort preference on `lang` so matching languages are ranked first while non-matching languages remain eligible. No built-in language-code validation is applied. | `lang:ja`, `language:es order:name` |
| Colors and color identity | Fully supported | `c` / `color` target `colors` OR `card_faces.colors`; `id` / `identity` target base Scryfall `color_identity`. Single-letter colors, concatenated color sets like `uw`, popular nickname groups (guilds/shards/wedges/colleges/four-color names), `c` for colorless, `m` or `multicolor` for multicolor, and set comparisons with `:`, `=`, `>`, `>=`, `<`, `<=` are implemented. Emitted Elasticsearch terms use Scryfall's uppercase symbols `W/U/B/R/G`. Colorless compiles as missing/empty fields (`id:c` => missing `color_identity`; `c:c` => missing `colors` and `card_faces.colors`). | `c:red`, `c:azorius`, `c:altruism`, `c:m`, `c:multicolor`, `id<=esper`, `id:c` |
| Runtime extension API | Fully supported | New fields and aliases can be registered without editing core source. | `engine.extend({ fields: { ... } })` |

## Partially Supported

These syntax areas are present in some form, but they do not currently match Scryfall semantics completely.

| Syntax area | Status | Current behavior | Gap vs Scryfall |
| --- | --- | --- | --- |
| Card text | Partial | `o`, `oracle`, and `text` compile as a `bool.should` disjunction of `match` clauses across `oracle_text` and `card_faces.oracle_text`. Quoted string values are parsed correctly. | No `~` substitution, `fo:`, regex, or exact Scryfall tokenization semantics. |
| Card types | Partial | `t` and `type` compile as a `bool.should` disjunction of `match` clauses across `type_line` and `card_faces.type_line`. Quoted string values are parsed correctly. | No regex mode and no explicit subtype/supertype handling beyond whatever the target analyzer does. |
| Name searches | Partial | `name` and `n` compile to Elasticsearch `match`; `name=` compiles to `term`; quoted name searches compile to `match_phrase`; multi-word bare input compiles to name `match` with `operator: "and"`. | No `!` exact-name syntax and no regex mode. |
| Mana value | Partial | `mv` and `cmc` support numeric range and equality comparisons. | No support for `manavalue:odd`, `manavalue:even`, `!=`, or alternate Scryfall mana-value semantics beyond numeric comparison. |
| Shortcut parity vs Scryfall | Partial | `is:` and `not:` are implemented as token cross-references plus the explicit `is:default` expansion, but they still do not cover every Scryfall shortcut family. | `is:dual`, `is:fetchland`, `not:reprint` |

## Unsupported

The following syntax areas from the Scryfall syntax reference are currently unsupported as built-ins.

| Syntax area | Examples from Scryfall-style usage |
| --- | --- |
| Additional color-adjacent syntax outside basic color-set matching | `has:indicator` |
| `has:` family | `has:indicator`, `has:watermark` |
| Full Oracle text and keyword ability searches | `fo:` |
| Mana cost syntax | `m:{G}{U}`, `m>3WU`, `produces=wu`, `devotion:{u/b}{u/b}{u/b}` |
| Power, toughness, total PT, and loyalty | `pow>=8`, `pow>tou`, `loy=3`, `pt=10` |
| Multi-faced card shortcuts | `is:split`, `is:transform`, `is:meld`, `is:mdfc` |
| Spell/permanent/effect shortcuts | `is:spell`, `is:permanent`, `is:historic`, `is:modal`, `is:vanilla` |
| Extras/funny/include modifiers | `include:extras`, `is:funny` |
| Rarity syntax beyond the built-in rarity field | `new:rarity`, `in:rare` |
| Edition and block families beyond `set` / `st` | `e:war`, `b:wwk` |
| Cube queries | `cube:vintage` |
| Format legality and ban status | `f:pauper`, `banned:legacy`, `restricted:vintage` |
| Commander/companion/reserved-list shortcuts | `is:commander`, `is:companion`, `is:reserved` |
| Price queries beyond the built-in price fields | `cheapest:usd` |
| Artist, flavor, watermark, art counts | `a:"proce"`, `ft:mishra`, `wm:orzhov`, `artists>1`, `illustrations>1` |
| Border/frame families beyond basic fielded matching | `is:foil`, `stamp:acorn`, `is:hires` |
| Game and platform availability | `game:arena`, `in:mtgo`, `is:digital`, `is:promo`, `is:spotlight` |
| Date and year queries | `year<=1994`, `date>=2015-08-18`, `date>ori` |
| Tagger tags | `art:squirrel`, `function:removal`, `otag:removal` |
| Reprint and print-count syntax | `is:reprint`, `not:reprint`, `sets>=20`, `papersets=1` |
| Language syntax beyond `lang` preference sorting | `lang:any`, `new:language`, `in:ru` |
| Shortcut land nicknames and Masterpiece shortcuts | `is:dual`, `is:fetchland`, `is:masterpiece` |
| Full `not:` parity | `not:reprint`, `not:spell` |
| Regular-expression searches | `o:/^{T}:/`, `name:/\\bizzet\\b/` |
| Exact-name `!` syntax | `!fire`, `!"sift through sands"` |
| Display-control keywords | `display:text`, `display:oracle` |
| `!=` operator | `mv!=3` |

## Known Deviations From Scryfall

These are the most important behavior differences even within superficially similar syntax.

1. Bare terms are interpreted as `name:` searches.
   Scryfall loose-word behavior is broader than name-only matching and can target other fields.

2. Regular expressions are not supported.
   Scryfall supports `/.../` regex for several text-oriented fields; this library does not.

3. `!=` is not supported.
   The parser only accepts `:`, `=`, `>`, `>=`, `<`, and `<=`.

4. Text semantics depend on Elasticsearch analyzers, not Scryfall's search engine.
   `t:` and `o:` compile to Elasticsearch `match` queries (across base and `card_faces` fields), so behavior depends on the target mapping and analyzer configuration.

5. `=` does not mean "Scryfall exact" in every case.
   In this library it generally compiles to an Elasticsearch `term` query, which requires exact indexed values.

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

## Planned Support

These are the most sensible next steps if the goal is closer Scryfall parity.

1. Add `!=` parsing and compilation.
2. Expand `is:` / `not:` token coverage to closer Scryfall parity and add `has:` / `include:`.
3. Add exact-name `!` support and broaden loose-word behavior beyond name-only matching.
4. Add regex token support for `name`, `t`, `o`, and `ft`.
5. Expand the built-in field registry to cover the remaining Scryfall syntax families documented on the reference page.
6. Add conformance tests that mirror the Scryfall syntax categories one section at a time.

## Examples

### Works today

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
cn:123a
usd<=0.50
order:cmc direction:desc
prefer:oldest
unique:cards
prefer:default
lightning unique:cards not:showcase
"lightning bolt"
lightning bolt
```

### Parses, but does not match Scryfall semantics exactly

```txt
o:draw
```

In Scryfall, this uses Scryfall's text-search behavior. In this library it compiles to an Elasticsearch `match` query against `oracle_text`.

### Does not work today

```txt
m:{G}{U}
pow>tou
lang:any
name:/\bizzet\b/
!fire
```

## Sources

- Scryfall syntax reference: https://scryfall.com/docs/syntax
- Mirrored syntax reference used for line-by-line comparison: https://cran.r-universe.dev/scryr/doc/syntax.html
