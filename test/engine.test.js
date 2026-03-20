import test from "node:test";
import assert from "node:assert/strict";

import {
  compileColorField,
  compileIsShortcutField,
  compileKeywordField,
  compileNumericField,
  compileNotShortcutField,
  createEngine,
  parseColorExpression,
  RELEASE,
  VERSION,
} from "../src/index.js";

function buildExactColorClause(path, required, excluded) {
  return {
    bool: {
      must: required.map((symbol) => ({ term: { [path]: symbol } })),
      must_not: excluded.map((symbol) => ({ term: { [path]: symbol } })),
    },
  };
}

function compileLegalField({ fieldName, operator, value }) {
  if (operator !== ":" && operator !== "=") {
    throw new Error(`Field "${fieldName}" does not support operator "${operator}". Supported operators: :, =`);
  }

  return {
    term: {
      [`card.legalities.${value}`]: "legal",
    },
  };
}

test("parses implicit and expressions into an AST", () => {
  const engine = createEngine();
  const ast = engine.parse("c:red t:dragon mv<=5");

  assert.deepEqual(ast, {
    type: "boolean",
    operator: "and",
    clauses: [
      {
        type: "term",
        field: "c",
        operator: ":",
        value: "red",
        negated: false,
      },
      {
        type: "term",
        field: "t",
        operator: ":",
        value: "dragon",
        negated: false,
      },
      {
        type: "term",
        field: "mv",
        operator: "<=",
        value: "5",
        negated: false,
      },
    ],
  });
});

test("compiles simple queries into predictable bool must clauses", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("c:red t:dragon mv<=5"), {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildExactColorClause("colors", ["R"], ["W", "U", "B", "G"]),
              buildExactColorClause("card_faces.colors", ["R"], ["W", "U", "B", "G"]),
            ],
            minimum_should_match: 1,
          },
        },
        {
          bool: {
            should: [
              { match: { type_line: "dragon" } },
              { match: { "card_faces.type_line": "dragon" } },
            ],
            minimum_should_match: 1,
          },
        },
        { range: { cmc: { lte: 5 } } },
      ],
    },
  });
});

test("supports or groups and negation", () => {
  const engine = createEngine();
  const dsl = engine.compile("(c:red or c:white) -o:draw");

  assert.equal(dsl.bool.must.length, 2);
  assert.equal(dsl.bool.must[0].bool.should.length, 2);
  assert.deepEqual(dsl.bool.must[0].bool.should[0], {
    bool: {
      should: [
        buildExactColorClause("colors", ["R"], ["W", "U", "B", "G"]),
        buildExactColorClause("card_faces.colors", ["R"], ["W", "U", "B", "G"]),
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(dsl.bool.must[0].bool.should[1], {
    bool: {
      should: [
        buildExactColorClause("colors", ["W"], ["U", "B", "R", "G"]),
        buildExactColorClause("card_faces.colors", ["W"], ["U", "B", "R", "G"]),
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(dsl.bool.must[1], {
    bool: {
      must_not: [
        {
          bool: {
            should: [
              { match: { oracle_text: "draw" } },
              { match: { "card_faces.oracle_text": "draw" } },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  });
});

test("supports runtime custom fields without changing core code", () => {
  const engine = createEngine();

  engine.extend({
    fields: {
      inclusion_percent: {
        aliases: ["ip", "edhrec"],
        esPath: "edhrec.inclusion_percent",
        type: "number",
        parseValue: Number,
        compile: compileNumericField,
      },
    },
  });

  assert.deepEqual(engine.compile("c:red inclusion_percent>1.4"), {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildExactColorClause("colors", ["R"], ["W", "U", "B", "G"]),
              buildExactColorClause("card_faces.colors", ["R"], ["W", "U", "B", "G"]),
            ],
            minimum_should_match: 1,
          },
        },
        { range: { "edhrec.inclusion_percent": { gt: 1.4 } } },
      ],
    },
  });
});

test("supports registering and compiling against named profiles", () => {
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

  const profile = { profile: "moxfield_collection" };
  const combined = engine.compile("color<=mardu legal:commander is:legendary frame:2015 inclusion_percent>1", profile);

  assert.deepEqual(combined, {
    bool: {
      must: [
        engine.compile("color<=mardu", profile),
        { term: { "card.legalities.commander": "legal" } },
        { term: { "card.type_line": "legendary" } },
        { term: { "card.frame": "2015" } },
        { range: { "slugs.inclusion_percent": { gt: 1 } } },
      ],
    },
  });

  assert.deepEqual(engine.compile("frame:2015", profile), {
    term: { "card.frame": "2015" },
  });

  assert.deepEqual(engine.compile("inclusion_percent>1", profile), {
    range: { "slugs.inclusion_percent": { gt: 1 } },
  });

  assert.deepEqual(engine.compile("is:legendary", profile), {
    term: { "card.type_line": "legendary" },
  });

  assert.deepEqual(engine.compile("not:legendary", profile), {
    bool: {
      must_not: [{ term: { "card.type_line": "legendary" } }],
    },
  });
});

test("supports compileWithMeta by profile", () => {
  const engine = createEngine();

  engine.registerProfile("profile_meta", {
    override: true,
    fields: {
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

  const result = engine.compileWithMeta("is:legendary is:showcase", { profile: "profile_meta" });

  assert.deepEqual(result.dsl, {
    term: { "card.type_line": "legendary" },
  });
  assert.deepEqual(result.meta.terms.valid, ["is:legendary"]);
  assert.deepEqual(result.meta.terms.invalid, ["is:showcase"]);
  assert.equal(result.meta.warnings.length, 1);
  assert.equal(result.meta.warnings[0].code, "UNKNOWN_IS_NOT_TOKEN");
});

test("keeps default profile behavior isolated from custom profiles", () => {
  const engine = createEngine();

  engine.registerProfile("moxfield_collection", {
    override: true,
    fields: {
      frame: {
        aliases: ["frame"],
        esPath: "card.frame",
        type: "keyword",
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileKeywordField,
      },
    },
  });

  assert.deepEqual(engine.compile("frame:2015"), {
    bool: {
      should: [
        { term: { frame: "2015" } },
        { term: { frame_effects: "2015" } },
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(engine.compile("frame:2015", { profile: "moxfield_collection" }), {
    term: { "card.frame": "2015" },
  });
});

test("tracks and validates profile registration", () => {
  const engine = createEngine();

  assert.deepEqual(engine.listProfiles(), ["default"]);

  engine.registerProfile("moxfield_collection", {
    fields: {
      profile_frame: {
        aliases: ["profile_frame"],
        esPath: "card.frame",
        type: "keyword",
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileKeywordField,
      },
    },
  });

  assert.deepEqual(engine.listProfiles().sort(), ["default", "moxfield_collection"]);

  assert.throws(
    () =>
      engine.registerProfile("moxfield_collection", {
        fields: {},
      }),
    /Profile "moxfield_collection" is already registered/
  );

  assert.throws(
    () => engine.compile("profile_frame:2015", { profile: "missing_profile" }),
    /Unknown profile "missing_profile"/
  );
});

test("fails loudly on unknown fields", () => {
  const engine = createEngine();

  assert.throws(() => engine.compile("unknown:value"), /Unknown field "unknown"/);
});

test("fails loudly on alias collisions without override", () => {
  const engine = createEngine();

  assert.throws(
    () =>
      engine.extend({
        fields: {
          inclusion_percent: {
            aliases: ["c"],
            esPath: "edhrec.inclusion_percent",
            type: "number",
            parseValue: Number,
            compile: compileNumericField,
          },
        },
      }),
    /Alias "c" is already registered/
  );
});

test("exports version metadata", () => {
  assert.equal(typeof VERSION, "string");
  assert.equal(typeof RELEASE, "string");
  assert.match(RELEASE, /^0\./);
});

test("keeps color and color identity distinct", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("id:esper"), {
    bool: {
      must: [
        { term: { color_identity: "W" } },
        { term: { color_identity: "U" } },
        { term: { color_identity: "B" } },
      ],
      must_not: [
        { term: { color_identity: "R" } },
        { term: { color_identity: "G" } },
      ],
    },
  });

  const idAzorius = engine.compile("id:azorius");
  assert.equal(JSON.stringify(idAzorius).includes("card_faces.colors"), false);
  assert.equal(JSON.stringify(idAzorius).includes("\"colors\""), false);
});

test("supports popular color nicknames", () => {
  const engine = createEngine();
  const cases = [
    ["c:azorius", ["W", "U"], ["B", "R", "G"]],
    ["c:bant", ["W", "U", "G"], ["B", "R"]],
    ["c:quandrix", ["U", "G"], ["W", "B", "R"]],
    ["c:abzan", ["W", "B", "G"], ["U", "R"]],
    ["c:altruism", ["W", "U", "R", "G"], ["B"]],
  ];

  for (const [query, required, excluded] of cases) {
    const dsl = engine.compile(query);
    assert.equal(dsl.bool.should.length, 2);
    assert.deepEqual(dsl.bool.should[0], buildExactColorClause("colors", required, excluded));
    assert.deepEqual(dsl.bool.should[1], buildExactColorClause("card_faces.colors", required, excluded));
    assert.equal(dsl.bool.minimum_should_match, 1);
  }
});

test("supports colorless semantics for color and identity", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("id:c"), {
    bool: {
      must_not: [
        {
          exists: {
            field: "color_identity",
          },
        },
      ],
    },
  });

  assert.deepEqual(engine.compile("c:colorless"), {
    bool: {
      must: [
        {
          bool: {
            must_not: [
              {
                exists: {
                  field: "colors",
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                exists: {
                  field: "card_faces.colors",
                },
              },
            ],
          },
        },
      ],
    },
  });

  assert.deepEqual(engine.compile("c:c"), engine.compile("c:colorless"));
  assert.deepEqual(engine.compile("id:colorless"), engine.compile("id:c"));
});

test("supports color subset comparisons", () => {
  const engine = createEngine();
  const dsl = engine.compile("id<=esper");

  assert.equal(dsl.bool.should.length, 8);
  assert.equal(dsl.bool.minimum_should_match, 1);
});

test("supports multicolor shorthand", () => {
  const engine = createEngine();
  const dsl = engine.compile("c:m");

  assert.equal(dsl.bool.should.length, 2);
  assert.equal(dsl.bool.should[0].bool.should.length, 26);
  assert.equal(dsl.bool.should[1].bool.should.length, 26);
  assert.equal(dsl.bool.minimum_should_match, 1);
});

test("supports literal multicolor for color and identity", () => {
  const engine = createEngine();

  const colorLiteral = engine.compile("c:multicolor");
  const colorShorthand = engine.compile("c:m");
  assert.deepEqual(colorLiteral, colorShorthand);
  assert.equal(colorLiteral.bool.should.length, 2);
  assert.equal(colorLiteral.bool.should[0].bool.should.length, 26);
  assert.equal(colorLiteral.bool.should[1].bool.should.length, 26);
  assert.equal(colorLiteral.bool.minimum_should_match, 1);

  const identityLiteral = engine.compile("id:multicolor");
  const identityShorthand = engine.compile("id:m");
  assert.deepEqual(identityLiteral, identityShorthand);
  assert.equal(identityLiteral.bool.should.length, 26);
  assert.equal(identityLiteral.bool.minimum_should_match, 1);
});

test("supports rarity keywords and comparisons", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("r:rare rarity>=rare"), {
    bool: {
      must: [
        { term: { rarity: "rare" } },
        {
          bool: {
            should: [
              { term: { rarity: "rare" } },
              { term: { rarity: "mythic" } },
              { term: { rarity: "special" } },
              { term: { rarity: "bonus" } },
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  });
});

test("supports set and collector number lookups", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("set:lea cn:123a cn>=123"), {
    bool: {
      must: [
        { term: { set: "lea" } },
        { term: { collector_number: "123a" } },
        {
          script: {
            script: {
              lang: "painless",
              source:
                "if (doc['collector_number'].size() == 0) return false; String collectorNumber = doc['collector_number'].value; if (!/^[0-9]+$/.matcher(collectorNumber).matches()) return false; return Integer.parseInt(collectorNumber) >= params.value;",
              params: {
                value: 123,
              },
            },
          },
        },
      ],
    },
  });
});

test("supports price searches", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("usd:0.5 eur>=1.25 tix<2"), {
    bool: {
      must: [
        { term: { "prices.usd": 0.5 } },
        { range: { "prices.eur": { gte: 1.25 } } },
        { range: { "prices.tix": { lt: 2 } } },
      ],
    },
  });
});

test("supports keywords field aliases", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("kw:Flying"), {
    term: { keywords: "Flying" },
  });

  assert.deepEqual(engine.compile("keyword:Flying"), {
    term: { keywords: "Flying" },
  });

  assert.deepEqual(engine.compile("keywords:Flying"), {
    term: { keywords: "Flying" },
  });
});

test("supports unique result modes", () => {
  const engine = createEngine();
  const baseQuery = engine.compile("c:red");

  assert.deepEqual(engine.compile("unique:cards c:red"), {
    query: baseQuery,
    collapse: {
      field: "oracle_id",
    },
    sort: [
      { "name.keyword": { order: "asc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("unique:art c:red"), {
    query: baseQuery,
    collapse: {
      field: "illustration_id",
    },
  });

  assert.deepEqual(engine.compile("unique:prints c:red"), baseQuery);
});

test("treats bare words as name searches", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("lightning"), {
    match: { name: "lightning" },
  });
});

test("compiles multi-word bare input with match and operator=and", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("lightning bolt"), {
    match: {
      name: {
        query: "lightning bolt",
        operator: "and",
      },
    },
  });
});

test("compiles quoted name input with match_phrase", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('"lightning bolt"'), {
    match_phrase: {
      name: "lightning bolt",
    },
  });
});

test("supports order directives", () => {
  const engine = createEngine();

  const fieldOrderCases = [
    ["order:cmc", "cmc", { order: "asc", unmapped_type: "double" }],
    ["order:power", "power", { order: "asc", unmapped_type: "keyword" }],
    ["order:toughness", "toughness", { order: "asc", unmapped_type: "keyword" }],
    ["order:set", "set", { order: "asc", unmapped_type: "keyword" }],
    ["order:name", "name.keyword", { order: "asc", unmapped_type: "keyword" }],
    ["order:usd", "prices.usd", { order: "asc", unmapped_type: "double" }],
    ["order:tix", "prices.tix", { order: "asc", unmapped_type: "double" }],
    ["order:eur", "prices.eur", { order: "asc", unmapped_type: "double" }],
    ["order:edhrec", "edhrec_rank", { order: "asc", unmapped_type: "long" }],
    ["order:released", "released_at", { order: "asc", unmapped_type: "keyword" }],
  ];

  for (const [query, field, expected] of fieldOrderCases) {
    const result = engine.compile(query);

    assert.deepEqual(result.query, { match_all: {} });
    assert.deepEqual(result.sort[0], { [field]: expected });
  }

  const rarity = engine.compile("order:rarity");
  const color = engine.compile("order:color");

  assert.deepEqual(rarity.query, { match_all: {} });
  assert.equal(rarity.sort[0]._script.order, "asc");
  assert.match(rarity.sort[0]._script.script.source, /rarity/);

  assert.deepEqual(color.query, { match_all: {} });
  assert.equal(color.sort[0]._script.order, "asc");
  assert.equal(color.sort[0]._script.script.params.field, "colors");
});

test("supports direction directives", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("order:cmc direction:desc"), {
    query: { match_all: {} },
    sort: [{ cmc: { order: "desc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("order:cmc direction:asc"), {
    query: { match_all: {} },
    sort: [{ cmc: { order: "asc", unmapped_type: "double" } }],
  });
});

test("supports lang directive as a preference sort without filtering", () => {
  const engine = createEngine();

  const preferredLanguage = engine.compile("lang:ja");
  assert.deepEqual(preferredLanguage.query, { match_all: {} });
  assert.equal(preferredLanguage.sort[0]._script.order, "asc");
  assert.equal(preferredLanguage.sort[0]._script.script.params.field, "lang");
  assert.equal(preferredLanguage.sort[0]._script.script.params.lang, "ja");

  const withOtherDirectives = engine.compile("lang:es order:name direction:desc prefer:newest");
  assert.deepEqual(withOtherDirectives.query, { match_all: {} });
  assert.equal(withOtherDirectives.sort[0]._script.script.params.lang, "es");
  assert.deepEqual(withOtherDirectives.sort[1], { "name.keyword": { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(withOtherDirectives.sort[2], { released_at: { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(withOtherDirectives.sort[3], {
    collector_number: { order: "desc", unmapped_type: "keyword" },
  });
});

test("supports prefer directives", () => {
  const engine = createEngine();

  const preferredDefault = engine.compile("prefer:default");

  assert.deepEqual(preferredDefault.query, { match_all: {} });
  assert.deepEqual(preferredDefault.sort, [
    { full_art: { order: "asc", unmapped_type: "boolean" } },
    { promo_types: { order: "asc", unmapped_type: "keyword", missing: "_first" } },
    { frame_effects: { order: "asc", unmapped_type: "keyword", missing: "_first" } },
    { set_type: { order: "asc", unmapped_type: "keyword" } },
    { frame: { order: "asc", unmapped_type: "keyword" } },
    { finishes: { order: "desc", unmapped_type: "keyword" } },
    { border_color: { order: "desc", unmapped_type: "keyword" } },
    { released_at: { order: "desc", unmapped_type: "keyword" } },
    { collector_number: { order: "desc", unmapped_type: "keyword" } },
  ]);

  assert.deepEqual(engine.compile("prefer:oldest"), {
    query: { match_all: {} },
    sort: [
      { released_at: { order: "asc", unmapped_type: "keyword" } },
      { collector_number: { order: "asc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:newest"), {
    query: { match_all: {} },
    sort: [
      { released_at: { order: "desc", unmapped_type: "keyword" } },
      { collector_number: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:usd-low"), {
    query: { match_all: {} },
    sort: [{ "prices.usd": { order: "asc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("prefer:usd-high"), {
    query: { match_all: {} },
    sort: [{ "prices.usd": { order: "desc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("prefer:promo"), {
    query: { match_all: {} },
    sort: [
      { promo: { order: "desc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:ub"), {
    query: { match_all: {} },
    sort: [
      { universes_beyond: { order: "desc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:notub"), {
    query: { match_all: {} },
    sort: [
      { universes_beyond: { order: "asc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  const atypical = engine.compile("prefer:atypical");
  assert.deepEqual(atypical.query, { match_all: {} });
  assert.equal(atypical.sort[0]._script.order, "desc");
  assert.match(atypical.sort[0]._script.script.source, /promo/);
});

test("supports is: token cross-reference matching", () => {
  const engine = createEngine();

  const result = engine.compile('is:etched name:"Lightning Bolt"');

  assert.deepEqual(result.bool.must[1], { match_phrase: { name: "Lightning Bolt" } });
  assert.deepEqual(result.bool.must[0], {
    bool: {
      should: [
        { term: { frame_effects: "etched" } },
        { term: { finishes: "etched" } },
      ],
      minimum_should_match: 1,
    },
  });
});

test("supports not: token cross-reference matching", () => {
  const engine = createEngine();

  const result = engine.compile('lightning not:showcase');

  assert.equal(result.bool.must.length, 2);
  assert.deepEqual(result.bool.must[0], {
    match: { name: "lightning" },
  });
  assert.deepEqual(result.bool.must[1], {
    bool: {
      must_not: [
        { term: { frame_effects: "showcase" } },
      ],
    },
  });
});

test("supports st, border, and frame field aliases", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("st:masterpiece -border:borderless -frame:future"), {
    bool: {
      must: [
        { term: { set_type: "masterpiece" } },
        {
          bool: {
            must_not: [
              { term: { border_color: "borderless" } },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                bool: {
                  should: [
                    { term: { frame: "future" } },
                    { term: { frame_effects: "future" } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
      ],
    },
  });
});

test("supports is:default shortcut expansion", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:default"), {
    bool: {
      must: [
        { bool: { must_not: [{ term: { frame_effects: "showcase" } }] } },
        { bool: { must_not: [{ term: { frame_effects: "extendedart" } }] } },
        { bool: { must_not: [{ term: { border_color: "borderless" } }] } },
        { bool: { must_not: [{ term: { promo_types: "fracturefoil" } }] } },
        {
          bool: {
            must_not: [
              { term: { frame_effects: "etched" } },
              { term: { finishes: "etched" } },
            ],
          },
        },
        { bool: { must_not: [{ term: { promo_types: "stamped" } }] } },
        { bool: { must_not: [{ term: { promo_types: "datestamped" } }] } },
        { bool: { must_not: [{ term: { frame_effects: "fullart" } }] } },
        { bool: { must_not: [{ term: { promo_types: "surgefoil" } }] } },
        { bool: { must_not: [{ term: { promo_types: "galaxyfoil" } }] } },
        { bool: { must_not: [{ term: { set_type: "masterpiece" } }] } },
        {
          bool: {
            must_not: [
              {
                bool: {
                  should: [
                    { term: { frame: "future" } },
                    { term: { frame_effects: "future" } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                bool: {
                  should: [
                    { term: { frame: "colorshifted" } },
                    { term: { frame_effects: "colorshifted" } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
        { bool: { must_not: [{ term: { promo_types: "playtest" } }] } },
        {
          bool: {
            must_not: [
              {
                bool: {
                  should: [
                    { term: { frame: "inverted" } },
                    { term: { frame_effects: "inverted" } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
        { bool: { must_not: [{ term: { border_color: "yellow" } }] } },
      ],
    },
  });
});

test("compileWithMeta treats is:default as a valid shortcut", () => {
  const engine = createEngine();
  const result = engine.compileWithMeta("is:default");

  assert.deepEqual(result.meta.terms.valid, ["is:default"]);
  assert.deepEqual(result.meta.terms.invalid, []);
  assert.equal(result.meta.warnings.length, 0);
});

test("supports individual is:default atoms", () => {
  const engine = createEngine();
  const cases = [
    ["not:extendedart", { bool: { must_not: [{ term: { frame_effects: "extendedart" } }] } }],
    ["-border:borderless", { bool: { must_not: [{ term: { border_color: "borderless" } }] } }],
    ["not:fracturefoil", { bool: { must_not: [{ term: { promo_types: "fracturefoil" } }] } }],
    [
      "not:etched",
      {
        bool: {
          must_not: [{ term: { frame_effects: "etched" } }, { term: { finishes: "etched" } }],
        },
      },
    ],
    ["not:stamped", { bool: { must_not: [{ term: { promo_types: "stamped" } }] } }],
    ["not:datestamped", { bool: { must_not: [{ term: { promo_types: "datestamped" } }] } }],
    ["not:fullart", { bool: { must_not: [{ term: { frame_effects: "fullart" } }] } }],
    ["not:surgefoil", { bool: { must_not: [{ term: { promo_types: "surgefoil" } }] } }],
    ["not:galaxyfoil", { bool: { must_not: [{ term: { promo_types: "galaxyfoil" } }] } }],
    ["-st:masterpiece", { bool: { must_not: [{ term: { set_type: "masterpiece" } }] } }],
    [
      "-frame:future",
      {
        bool: {
          must_not: [
            {
              bool: {
                should: [
                  { term: { frame: "future" } },
                  { term: { frame_effects: "future" } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    ],
    [
      "-frame:colorshifted",
      {
        bool: {
          must_not: [
            {
              bool: {
                should: [
                  { term: { frame: "colorshifted" } },
                  { term: { frame_effects: "colorshifted" } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    ],
    ["not:playtest", { bool: { must_not: [{ term: { promo_types: "playtest" } }] } }],
    [
      "-frame:inverted",
      {
        bool: {
          must_not: [
            {
              bool: {
                should: [
                  { term: { frame: "inverted" } },
                  { term: { frame_effects: "inverted" } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    ],
    ["-border:yellow", { bool: { must_not: [{ term: { border_color: "yellow" } }] } }],
  ];

  for (const [query, expected] of cases) {
    assert.deepEqual(engine.compile(query), expected);
  }
});

test("supports combined is:default atoms across same and different fields", () => {
  const engine = createEngine();

  assert.deepEqual(
    engine.compile("not:extendedart not:fullart -frame:future -frame:colorshifted not:stamped -border:borderless"),
    {
      bool: {
        must: [
          { bool: { must_not: [{ term: { frame_effects: "extendedart" } }] } },
          { bool: { must_not: [{ term: { frame_effects: "fullart" } }] } },
          {
            bool: {
              must_not: [
                {
                  bool: {
                    should: [
                      { term: { frame: "future" } },
                      { term: { frame_effects: "future" } },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
            },
          },
          {
            bool: {
              must_not: [
                {
                  bool: {
                    should: [
                      { term: { frame: "colorshifted" } },
                      { term: { frame_effects: "colorshifted" } },
                    ],
                    minimum_should_match: 1,
                  },
                },
              ],
            },
          },
          { bool: { must_not: [{ term: { promo_types: "stamped" } }] } },
          { bool: { must_not: [{ term: { border_color: "borderless" } }] } },
        ],
      },
    }
  );
});

test("combines is:default atoms with unique/order/prefer controls", () => {
  const engine = createEngine();

  assert.deepEqual(
    engine.compile("not:extendedart -border:borderless unique:cards order:usd direction:desc prefer:newest"),
    {
      query: {
        bool: {
          must: [
            { bool: { must_not: [{ term: { frame_effects: "extendedart" } }] } },
            { bool: { must_not: [{ term: { border_color: "borderless" } }] } },
          ],
        },
      },
      collapse: {
        field: "oracle_id",
      },
      sort: [
        { "prices.usd": { order: "desc", unmapped_type: "double" } },
        { released_at: { order: "desc", unmapped_type: "keyword" } },
        { collector_number: { order: "desc", unmapped_type: "keyword" } },
      ],
    }
  );
});

test("applies last control values when combining repeated controls with atoms", () => {
  const engine = createEngine();

  assert.deepEqual(
    engine.compile(
      "not:extendedart unique:cards unique:art order:name order:cmc direction:desc direction:asc prefer:oldest prefer:promo"
    ),
    {
      query: {
        bool: {
          must_not: [{ term: { frame_effects: "extendedart" } }],
        },
      },
      collapse: {
        field: "illustration_id",
      },
      sort: [
        { cmc: { order: "asc", unmapped_type: "double" } },
        { promo: { order: "desc", unmapped_type: "boolean" } },
        { released_at: { order: "desc", unmapped_type: "keyword" } },
      ],
    }
  );
});

test("compileWithMeta returns valid and invalid is/not terms", () => {
  const engine = createEngine();

  const result = engine.compileWithMeta("is:rare is:bibbityboppityboo");

  assert.deepEqual(result.dsl, {
    term: { rarity: "rare" },
  });
  assert.deepEqual(result.meta.terms.valid, ["is:rare"]);
  assert.deepEqual(result.meta.terms.invalid, ["is:bibbityboppityboo"]);
  assert.equal(result.meta.warnings.length, 1);
  assert.equal(result.meta.warnings[0].code, "UNKNOWN_IS_NOT_TOKEN");
});

test("compile skips unknown is/not token without throwing", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:bibbityboppityboo"), { match_all: {} });
});

test("combines unique:cards with not: shortcuts and directives", () => {
  const engine = createEngine();

  const result = engine.compile("lightning unique:cards not:showcase");

  assert.deepEqual(result.collapse, {
    field: "oracle_id",
  });
  assert.equal(result.sort.length, 1);
  assert.equal(result.query.bool.must.length, 2);
  assert.equal(result.query.bool.must[0].match.name, "lightning");
  assert.deepEqual(result.query.bool.must[1], {
    bool: {
      must_not: [
        { term: { frame_effects: "showcase" } },
      ],
    },
  });
  assert.deepEqual(result.sort[0], { "name.keyword": { order: "asc", unmapped_type: "keyword" } });
});

test("combines unique:cards with prefer:default and keeps name sorting", () => {
  const engine = createEngine();

  const result = engine.compile("lightning unique:cards not:showcase prefer:default");

  assert.deepEqual(result.sort[0], { "name.keyword": { order: "asc", unmapped_type: "keyword" } });
  assert.equal(result.sort.length, 10);
});

test("parses quoted values as a single term", () => {
  const engine = createEngine();
  const ast = engine.parse('name:"Lightning Bolt" o:"draw a card"');

  assert.deepEqual(ast, {
    type: "boolean",
    operator: "and",
    clauses: [
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "Lightning Bolt",
        negated: false,
        quoted: true,
      },
      {
        type: "term",
        field: "o",
        operator: ":",
        value: "draw a card",
        negated: false,
        quoted: true,
      },
    ],
  });
});

test("keeps boolean keywords literal inside quoted values", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('o:"choose one or both" name:"Fire and Ice"'), {
    bool: {
      must: [
        {
          bool: {
            should: [
              { match: { oracle_text: "choose one or both" } },
              { match: { "card_faces.oracle_text": "choose one or both" } },
            ],
            minimum_should_match: 1,
          },
        },
        { match_phrase: { name: "Fire and Ice" } },
      ],
    },
  });
});

test("unescapes escaped quotes inside quoted values", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('o:"Whenever a card says \\"draw\\"..."'), {
    bool: {
      should: [
        { match: { oracle_text: 'Whenever a card says "draw"...' } },
        { match: { "card_faces.oracle_text": 'Whenever a card says "draw"...' } },
      ],
      minimum_should_match: 1,
    },
  });
});

test("fails on unterminated quoted values", () => {
  const engine = createEngine();

  assert.throws(() => engine.parse('name:"Lightning Bolt'), /Unterminated quoted string/);
});
