import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

function wrapNested(path, clause) {
  return { nested: { path, query: clause, ignore_unmapped: true } };
}

// Used for c:wu style queries — "contains at least" (>= semantics).
function buildContainsColorClause(path, colors) {
  return {
    bool: {
      must: colors.map((symbol) => ({ term: { [path]: symbol } })),
    },
  };
}

function buildNameLooseClause(queryText) {
  const operator = /\s/.test(queryText) ? "and" : null;
  const withOperator = (payload) => (operator ? { ...payload, operator } : payload);

  return {
    bool: {
      should: [
        {
          match: {
            name: withOperator({
              query: queryText,
              boost: 4,
            }),
          },
        },
        {
          match: {
            "name.prefix": withOperator({
              query: queryText,
              boost: 3,
            }),
          },
        },
        {
          match: {
            "name.infix": withOperator({
              query: queryText,
              boost: 2,
            }),
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildExactNameBangClause(queryText, paths = ["name.keyword", "card_faces.name.keyword"]) {
  return {
    bool: {
      should: paths.map((path) => {
        const clause = { term: { [path]: queryText } };
        return path.startsWith("card_faces.") ? wrapNested("card_faces", clause) : clause;
      }),
      minimum_should_match: 1,
    },
  };
}

function buildPartialTextClause(paths, queryText) {
  return {
    bool: {
      should: paths.map((path) => {
        const clause = { match: { [path]: queryText } };
        return path.startsWith("card_faces.") ? wrapNested("card_faces", clause) : clause;
      }),
      minimum_should_match: 1,
    },
  };
}

function buildYearRangeClause(operator, year) {
  if (operator === ":" || operator === "=") {
    return {
      range: {
        released_at: {
          gte: `${year}-01-01`,
          lte: `${year}-12-31`,
        },
      },
    };
  }

  if (operator === ">") {
    return {
      range: {
        released_at: {
          gt: `${year}-12-31`,
        },
      },
    };
  }

  if (operator === ">=") {
    return {
      range: {
        released_at: {
          gte: `${year}-01-01`,
        },
      },
    };
  }

  if (operator === "<") {
    return {
      range: {
        released_at: {
          lt: `${year}-01-01`,
        },
      },
    };
  }

  return {
    range: {
      released_at: {
        lte: `${year}-12-31`,
      },
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

test("parses multi-word bare input as separate implicit name terms", () => {
  const engine = createEngine();

  assert.deepEqual(engine.parse("acad man"), {
    type: "boolean",
    operator: "and",
    clauses: [
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "acad",
        implicit: true,
        negated: false,
      },
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "man",
        implicit: true,
        negated: false,
      },
    ],
  });
});

test("parses not-equals operator and coexists with exact-name bang terms", () => {
  const engine = createEngine();

  assert.deepEqual(engine.parse("mv!=3"), {
    type: "term",
    field: "mv",
    operator: "!=",
    value: "3",
    negated: false,
  });

  assert.deepEqual(engine.parse("!fire mv!=3"), {
    type: "boolean",
    operator: "and",
    clauses: [
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "fire",
        implicit: true,
        exactNameBang: true,
        negated: false,
      },
      {
        type: "term",
        field: "mv",
        operator: "!=",
        value: "3",
        negated: false,
      },
    ],
  });
});

test("compiles simple queries into predictable bool must clauses", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("c:red t:dragon mv<=5").dsl, {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildContainsColorClause("colors", ["R"]),
              wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
            ],
            minimum_should_match: 1,
          },
        },
        {
          bool: {
            should: [
              { match: { type_line: "dragon" } },
              wrapNested("card_faces", { match: { "card_faces.type_line": "dragon" } }),
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
  const { dsl } = engine.compile("(c:red or c:white) -o:draw");

  assert.equal(dsl.bool.must.length, 2);
  assert.equal(dsl.bool.must[0].bool.should.length, 2);
  assert.deepEqual(dsl.bool.must[0].bool.should[0], {
    bool: {
      should: [
        buildContainsColorClause("colors", ["R"]),
        wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(dsl.bool.must[0].bool.should[1], {
    bool: {
      should: [
        buildContainsColorClause("colors", ["W"]),
        wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["W"])),
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(dsl.bool.must[1], {
    bool: {
      must_not: [
        {
          ...buildPartialTextClause(
            [
              "oracle_text",
              "oracle_text.prefix",
              "oracle_text.infix",
              "card_faces.oracle_text",
              "card_faces.oracle_text.prefix",
              "card_faces.oracle_text.infix",
            ],
            "draw",
          ),
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
        operators: [":", "=", "!=", ">", ">=", "<", "<="],
        parseValue: Number,
        compile: compileNumericField,
      },
    },
  });

  assert.deepEqual(engine.compile("c:red inclusion_percent>1.4").dsl, {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildContainsColorClause("colors", ["R"]),
              wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
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
        operators: [":", "=", "!=", ">", ">=", "<", "<="],
        parseValue: parseColorExpression,
        compile: compileColorField,
      },
      color_identity: {
        aliases: ["id", "identity"],
        esPath: "card.color_identity",
        type: "color-set",
        operators: [":", "=", "!=", ">", ">=", "<", "<="],
        parseValue: parseColorExpression,
        compile: compileColorField,
      },
      legal: {
        aliases: ["f", "format"],
        esPath: "card.legalities",
        type: "keyword",
        operators: [":", "="],
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileLegalField,
      },
      frame: {
        aliases: ["frame"],
        esPath: "card.frame",
        type: "keyword",
        operators: [":", "="],
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileKeywordField,
      },
      inclusion_percent: {
        aliases: ["ip"],
        esPath: "slugs.inclusion_percent",
        type: "number",
        operators: [":", "=", "!=", ">", ">=", "<", "<="],
        parseValue: Number,
        compile: compileNumericField,
      },
      is: {
        aliases: ["is"],
        esPath: "is",
        type: "keyword",
        operators: [":", "="],
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
        operators: [":", "="],
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

  assert.deepEqual(combined.dsl, {
    bool: {
      must: [
        engine.compile("color<=mardu", profile).dsl,
        { term: { "card.legalities.commander": "legal" } },
        { term: { "card.type_line": "legendary" } },
        { term: { "card.frame": "2015" } },
        { range: { "slugs.inclusion_percent": { gt: 1 } } },
      ],
    },
  });

  assert.deepEqual(engine.compile("frame:2015", profile).dsl, {
    term: { "card.frame": "2015" },
  });

  assert.deepEqual(engine.compile("inclusion_percent>1", profile).dsl, {
    range: { "slugs.inclusion_percent": { gt: 1 } },
  });

  assert.deepEqual(engine.compile("is:legendary", profile).dsl, {
    term: { "card.type_line": "legendary" },
  });

  assert.deepEqual(engine.compile("not:legendary", profile).dsl, {
    bool: {
      must_not: [{ term: { "card.type_line": "legendary" } }],
    },
  });
});

test("supports compile by profile returning dsl and meta", () => {
  const engine = createEngine();

  engine.registerProfile("profile_meta", {
    override: true,
    fields: {
      is: {
        aliases: ["is"],
        esPath: "is",
        type: "keyword",
        operators: [":", "="],
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
        operators: [":", "="],
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileNotShortcutField,
        tokenFieldMap: {
          legendary: ["card.type_line"],
        },
      },
    },
  });

  const result = engine.compile("is:legendary is:showcase", { profile: "profile_meta" });

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
        operators: [":", "="],
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileKeywordField,
      },
    },
  });

  assert.deepEqual(engine.compile("frame:2015").dsl, {
    bool: {
      should: [
        { term: { frame: "2015" } },
        { term: { frame_effects: "2015" } },
      ],
      minimum_should_match: 1,
    },
  });
  assert.deepEqual(engine.compile("frame:2015", { profile: "moxfield_collection" }).dsl, {
    term: { "card.frame": "2015" },
  });
});

test("tracks and validates profile registration", () => {
  const engine = createEngine();

  assert.deepEqual(engine.listProfiles().sort(), ["ctx.card", "default"]);

  engine.registerProfile("moxfield_collection", {
    fields: {
      profile_frame: {
        aliases: ["profile_frame"],
        esPath: "card.frame",
        type: "keyword",
        operators: [":", "="],
        parseValue: (value) => String(value).trim().toLowerCase(),
        compile: compileKeywordField,
      },
    },
  });

  assert.deepEqual(engine.listProfiles().sort(), ["ctx.card", "default", "moxfield_collection"]);

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
            operators: [":", "=", "!=", ">", ">=", "<", "<="],
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

test("exposes engine.version metadata", () => {
  const engine = createEngine();

  assert.equal(typeof engine.version, "string");
  assert.equal(engine.version, RELEASE);
});

test("keeps color and color identity distinct", () => {
  const engine = createEngine();

  // Scryfall parity: id:esper means "fits within esper" (<=), same as id<=esper.
  assert.deepEqual(engine.compile("id:esper").dsl, engine.compile("id<=esper").dsl);

  const { dsl: idAzorius } = engine.compile("id:azorius");
  assert.equal(JSON.stringify(idAzorius).includes("card_faces.colors"), false);
  assert.equal(JSON.stringify(idAzorius).includes("\"colors\""), false);
});

test("supports popular color nicknames", () => {
  const engine = createEngine();
  const cases = [
    ["c:azorius", ["W", "U"]],
    ["c:bant", ["W", "U", "G"]],
    ["c:quandrix", ["U", "G"]],
    ["c:abzan", ["W", "B", "G"]],
    ["c:altruism", ["W", "U", "R", "G"]],
  ];

  for (const [query, required] of cases) {
    const { dsl } = engine.compile(query);
    assert.equal(dsl.bool.should.length, 2);
    assert.deepEqual(dsl.bool.should[0], buildContainsColorClause("colors", required));
    assert.deepEqual(dsl.bool.should[1], wrapNested("card_faces", buildContainsColorClause("card_faces.colors", required)));
    assert.equal(dsl.bool.minimum_should_match, 1);
  }
});

test("supports colorless semantics for color and identity", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("id:c").dsl, {
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

  assert.deepEqual(engine.compile("c:colorless").dsl, {
    bool: {
      must_not: [
        {
          exists: {
            field: "colors",
          },
        },
      ],
    },
  });

  assert.deepEqual(engine.compile("c:c").dsl, engine.compile("c:colorless").dsl);
  assert.deepEqual(engine.compile("id:colorless").dsl, engine.compile("id:c").dsl);
});

test("supports color subset comparisons", () => {
  const engine = createEngine();
  const { dsl } = engine.compile("id<=esper");

  assert.equal(dsl.bool.should.length, 8);
  assert.equal(dsl.bool.minimum_should_match, 1);
});

test("supports multicolor shorthand", () => {
  const engine = createEngine();
  const { dsl } = engine.compile("c:m");

  assert.equal(dsl.bool.should.length, 2);
  assert.equal(dsl.bool.should[0].bool.should.length, 26);
  assert.equal(dsl.bool.should[1].nested.query.bool.should.length, 26);
  assert.equal(dsl.bool.minimum_should_match, 1);
});

test("supports literal multicolor for color and identity", () => {
  const engine = createEngine();

  const { dsl: colorLiteral } = engine.compile("c:multicolor");
  const { dsl: colorShorthand } = engine.compile("c:m");
  assert.deepEqual(colorLiteral, colorShorthand);
  assert.equal(colorLiteral.bool.should.length, 2);
  assert.equal(colorLiteral.bool.should[0].bool.should.length, 26);
  assert.equal(colorLiteral.bool.should[1].nested.query.bool.should.length, 26);
  assert.equal(colorLiteral.bool.minimum_should_match, 1);

  const { dsl: identityLiteral } = engine.compile("id:multicolor");
  const { dsl: identityShorthand } = engine.compile("id:m");
  assert.deepEqual(identityLiteral, identityShorthand);
  assert.equal(identityLiteral.bool.should.length, 26);
  assert.equal(identityLiteral.bool.minimum_should_match, 1);
});

test("supports rarity keywords and comparisons", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("r:rare rarity>=rare").dsl, {
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

  assert.deepEqual(engine.compile("set:lea cn:123a cn>=123").dsl, {
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

test("supports format legality aliases plus banned and restricted semantics", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("f:modern format:legacy legal:commander banned:historic restricted:vintage").dsl, {
    bool: {
      must: [
        { term: { "legalities.modern": "legal" } },
        { term: { "legalities.legacy": "legal" } },
        { term: { "legalities.commander": "legal" } },
        { term: { "legalities.historic": "banned" } },
        { term: { "legalities.vintage": "restricted" } },
      ],
    },
  });
});

test("supports legality equality operators as direct status checks", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("legal=modern banned=legacy restricted=vintage").dsl, {
    bool: {
      must: [
        { term: { "legalities.modern": "legal" } },
        { term: { "legalities.legacy": "banned" } },
        { term: { "legalities.vintage": "restricted" } },
      ],
    },
  });
});

test("rejects unsupported operators on legality fields", () => {
  const engine = createEngine();

  assert.throws(() => engine.compile("f>modern"), /does not support operator \">\"/);
  assert.throws(() => engine.compile("banned!=legacy"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("restricted<commander"), /does not support operator \"<\"/);
});

test("supports date and year queries against released_at", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("date>=2015-08-18 date<2020-01-01").dsl, {
    bool: {
      must: [
        { range: { released_at: { gte: "2015-08-18" } } },
        { range: { released_at: { lt: "2020-01-01" } } },
      ],
    },
  });

  assert.deepEqual(engine.compile("year=1994 year>2001 year>=2001 year<2020 year<=2020").dsl, {
    bool: {
      must: [
        buildYearRangeClause("=", 1994),
        buildYearRangeClause(">", 2001),
        buildYearRangeClause(">=", 2001),
        buildYearRangeClause("<", 2020),
        buildYearRangeClause("<=", 2020),
      ],
    },
  });

  assert.deepEqual(engine.compile("date:2015-08-18 date=2015-08-18 year:1994").dsl, {
    bool: {
      must: [
        { term: { released_at: "2015-08-18" } },
        { term: { released_at: "2015-08-18" } },
        buildYearRangeClause(":", 1994),
      ],
    },
  });
});

test("fails loudly on invalid date and year values", () => {
  const engine = createEngine();

  assert.throws(() => engine.compile("date:2020"), /Invalid date value/);
  assert.throws(() => engine.compile("date:2020-13-40"), /Invalid date value/);
  assert.throws(() => engine.compile("year:20a4"), /Invalid year value/);
  assert.throws(() => engine.compile("year:199"), /Invalid year value/);
});

test("supports price searches", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("usd:0.5 eur>=1.25 tix<2").dsl, {
    bool: {
      must: [
        { term: { "prices.usd": 0.5 } },
        { range: { "prices.eur": { gte: 1.25 } } },
        { range: { "prices.tix": { lt: 2 } } },
      ],
    },
  });
});

test("supports numeric power and toughness searches via companion fields", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("pow>=3 power=1.5 tou!=2 toughness<=0.5").dsl, {
    bool: {
      must: [
        { range: { power_num: { gte: 3 } } },
        { term: { power_num: 1.5 } },
        { bool: { must_not: [{ term: { toughness_num: 2 } }] } },
        { range: { toughness_num: { lte: 0.5 } } },
      ],
    },
  });
});

test("fails loudly on invalid numeric power/toughness values", () => {
  const engine = createEngine();

  assert.throws(() => engine.compile("pow>abc"), /Cannot coerce "abc" into a numeric value/);
  assert.throws(() => engine.compile("tou=+"), /Cannot coerce "\+" into a numeric value/);
});

test("supports not-equals on comparison-style fields", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("mv!=3").dsl, {
    bool: {
      must_not: [
        { term: { cmc: 3 } },
      ],
    },
  });

  assert.deepEqual(engine.compile("usd!=1.25 eur!=0.5 tix!=2").dsl, {
    bool: {
      must: [
        { bool: { must_not: [{ term: { "prices.usd": 1.25 } }] } },
        { bool: { must_not: [{ term: { "prices.eur": 0.5 } }] } },
        { bool: { must_not: [{ term: { "prices.tix": 2 } }] } },
      ],
    },
  });

  assert.deepEqual(engine.compile("r!=rare").dsl, {
    bool: {
      must_not: [
        { term: { rarity: "rare" } },
      ],
    },
  });

  assert.deepEqual(engine.compile("cn!=123").dsl, {
    script: {
      script: {
        lang: "painless",
        source:
          "if (doc['collector_number'].size() == 0) return false; String collectorNumber = doc['collector_number'].value; if (!/^[0-9]+$/.matcher(collectorNumber).matches()) return false; return Integer.parseInt(collectorNumber) != params.value;",
        params: {
          value: 123,
        },
      },
    },
  });

  assert.deepEqual(engine.compile("c!=mardu").dsl, {
    bool: {
      must_not: [
        engine.compile("c=mardu").dsl,
      ],
    },
  });

  assert.deepEqual(engine.compile("id!=c").dsl, {
    bool: {
      must_not: [
        engine.compile("id=c").dsl,
      ],
    },
  });
});

test("rejects not-equals on keyword, text, control, and shortcut fields", () => {
  const engine = createEngine();

  assert.throws(() => engine.compile("set!=lea"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("st!=masterpiece"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("border!=yellow"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("frame!=future"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("kw!=Flying"), /does not support operator \"!=\"/);

  assert.throws(() => engine.compile("name!=fire"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("o!=draw"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("t!=dragon"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("ft!=factory"), /does not support operator \"!=\"/);

  assert.throws(() => engine.compile("order!=name"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("unique!=cards"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("prefer!=default"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("direction!=asc"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("lang!=ja"), /does not support operator \"!=\"/);

  assert.throws(() => engine.compile("is!=rare"), /does not support operator \"!=\"/);
  assert.throws(() => engine.compile("not!=showcase"), /does not support operator \"!=\"/);
});

test("supports valid mixed queries with not-equals and rejects invalid mixed keyword not-equals", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("c:red mv!=3").dsl, {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildContainsColorClause("colors", ["R"]),
              wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
            ],
            minimum_should_match: 1,
          },
        },
        { bool: { must_not: [{ term: { cmc: 3 } }] } },
      ],
    },
  });

  assert.deepEqual(engine.compile("r!=rare unique:cards order:name").dsl, {
    query: {
      bool: {
        must_not: [
          { term: { rarity: "rare" } },
        ],
      },
    },
    collapse: {
      field: "oracle_id",
    },
    aggs: {
      collapsed_total: {
        cardinality: {
          field: "oracle_id",
        },
      },
    },
    sort: [
      { "name.keyword": { order: "asc", unmapped_type: "keyword" } },
    ],
  });

  assert.throws(() => engine.compile("set!=lea unique:cards"), /does not support operator \"!=\"/);

  assert.deepEqual(engine.compile("pow>=3 c:red order:power").dsl, {
    query: {
      bool: {
        must: [
          { range: { power_num: { gte: 3 } } },
          {
            bool: {
              should: [
                buildContainsColorClause("colors", ["R"]),
                wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
              ],
              minimum_should_match: 1,
            },
          },
        ],
      },
    },
    sort: [{ power_num: { order: "asc", unmapped_type: "double" } }],
  });
});

test("supports keywords field aliases", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("kw:Flying").dsl, {
    term: { keywords: "Flying" },
  });

  assert.deepEqual(engine.compile("keyword:Flying").dsl, {
    term: { keywords: "Flying" },
  });

  assert.deepEqual(engine.compile("keywords:Flying").dsl, {
    term: { keywords: "Flying" },
  });
});

test("supports unique result modes", () => {
  const engine = createEngine();
  const { dsl: baseQuery } = engine.compile("c:red");

  assert.deepEqual(engine.compile("unique:cards c:red").dsl, {
    query: baseQuery,
    collapse: {
      field: "oracle_id",
    },
    aggs: {
      collapsed_total: {
        cardinality: {
          field: "oracle_id",
        },
      },
    },
    sort: [
      { "name.keyword": { order: "asc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("unique:art c:red").dsl, {
    query: baseQuery,
    collapse: {
      field: "illustration_id",
    },
    aggs: {
      collapsed_total: {
        cardinality: {
          field: "illustration_id",
        },
      },
    },
  });

  assert.deepEqual(engine.compile("unique:prints c:red").dsl, {
    query: baseQuery,
    sort: [{ released_at: { order: "asc", unmapped_type: "keyword" } }],
  });
});

test("treats bare words as name searches", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("lightning").dsl, {
    ...buildNameLooseClause("lightning"),
  });
});

test("compiles multi-word bare input as weighted name partial/fuzzy search", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("lightning bolt").dsl, {
    bool: {
      must: [
        buildNameLooseClause("lightning"),
        buildNameLooseClause("bolt"),
      ],
    },
  });
});

test("compiles quoted name input with match_phrase", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('"lightning bolt"').dsl, {
    match_phrase: {
      name: "lightning bolt",
    },
  });
});

test("compiles exact-name bang input as strict keyword disjunction", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("!fire").dsl, buildExactNameBangClause("fire"));
  assert.deepEqual(engine.compile('!"sift through sands"').dsl, buildExactNameBangClause("sift through sands"));
});

test("supports negating exact-name bang terms", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("-!fire").dsl, {
    bool: {
      must_not: [
        buildExactNameBangClause("fire"),
      ],
    },
  });
});

test("supports combining exact-name bang with filters and controls", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("!fire c:red").dsl, {
    bool: {
      must: [
        buildExactNameBangClause("fire"),
        {
          bool: {
            should: [
              buildContainsColorClause("colors", ["R"]),
              wrapNested("card_faces", buildContainsColorClause("card_faces.colors", ["R"])),
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  });

  assert.deepEqual(engine.compile("!fire unique:cards order:name").dsl, {
    query: buildExactNameBangClause("fire"),
    collapse: {
      field: "oracle_id",
    },
    aggs: {
      collapsed_total: {
        cardinality: {
          field: "oracle_id",
        },
      },
    },
    sort: [
      { "name.keyword": { order: "asc", unmapped_type: "keyword" } },
    ],
  });
});

test("compiles single-word name search with fixed weighted partial/fuzzy clauses", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("factor").dsl, {
    ...buildNameLooseClause("factor"),
  });
});

test("treats name= as include-style name search (not strict term equality)", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("name=jace").dsl, buildNameLooseClause("jace"));
  assert.deepEqual(engine.compile("n=jace").dsl, buildNameLooseClause("jace"));
  assert.deepEqual(engine.compile('name="Lightning Bolt"').dsl, {
    match_phrase: {
      name: "Lightning Bolt",
    },
  });
});

test("compiles multi-word bare shorthand as name-scoped weighted clauses", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("acad man").dsl, {
    bool: {
      must: [
        buildNameLooseClause("acad"),
        buildNameLooseClause("man"),
      ],
    },
  });
});

test("compiles oracle text search with match + prefix + infix paths", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("o:factor").dsl, {
    ...buildPartialTextClause(
      [
        "oracle_text",
        "oracle_text.prefix",
        "oracle_text.infix",
        "card_faces.oracle_text",
        "card_faces.oracle_text.prefix",
        "card_faces.oracle_text.infix",
      ],
      "factor"
    ),
  });
});

test("compiles flavor text search with match + prefix + infix paths", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("ft:factory").dsl, {
    ...buildPartialTextClause(
      [
        "flavor_text",
        "flavor_text.prefix",
        "flavor_text.infix",
        "card_faces.flavor_text",
        "card_faces.flavor_text.prefix",
        "card_faces.flavor_text.infix",
      ],
      "factory"
    ),
  });
});

test("supports order directives", () => {
  const engine = createEngine();

  const fieldOrderCases = [
    ["order:cmc", "cmc", { order: "asc", unmapped_type: "double" }],
    ["order:power", "power_num", { order: "asc", unmapped_type: "double" }],
    ["order:toughness", "toughness_num", { order: "asc", unmapped_type: "double" }],
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

    assert.deepEqual(result.dsl.query, { match_all: {} });
    assert.deepEqual(result.dsl.sort[0], { [field]: expected });
  }

  const rarity = engine.compile("order:rarity");
  const color = engine.compile("order:color");

  assert.deepEqual(rarity.dsl.query, { match_all: {} });
  assert.equal(rarity.dsl.sort[0]._script.order, "asc");
  assert.match(rarity.dsl.sort[0]._script.script.source, /rarity/);

  assert.deepEqual(color.dsl.query, { match_all: {} });
  assert.equal(color.dsl.sort[0]._script.order, "asc");
  assert.equal(color.dsl.sort[0]._script.script.params.field, "colors");
});

test("supports direction directives", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("order:cmc direction:desc").dsl, {
    query: { match_all: {} },
    sort: [{ cmc: { order: "desc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("order:cmc direction:asc").dsl, {
    query: { match_all: {} },
    sort: [{ cmc: { order: "asc", unmapped_type: "double" } }],
  });
});

test("supports lang directive as a preference sort without filtering", () => {
  const engine = createEngine();

  const preferredLanguage = engine.compile("lang:ja");
  assert.deepEqual(preferredLanguage.dsl.query, { match_all: {} });
  assert.equal(preferredLanguage.dsl.sort[0]._script.order, "asc");
  assert.equal(preferredLanguage.dsl.sort[0]._script.script.params.field, "lang");
  assert.equal(preferredLanguage.dsl.sort[0]._script.script.params.lang, "ja");

  const withOtherDirectives = engine.compile("lang:es order:name direction:desc prefer:newest");
  assert.deepEqual(withOtherDirectives.dsl.query, { match_all: {} });
  assert.equal(withOtherDirectives.dsl.sort[0]._script.script.params.lang, "es");
  assert.deepEqual(withOtherDirectives.dsl.sort[1], { "name.keyword": { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(withOtherDirectives.dsl.sort[2], { released_at: { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(withOtherDirectives.dsl.sort[3], {
    collector_number: { order: "desc", unmapped_type: "keyword" },
  });
});

test("supports prefer directives", () => {
  const engine = createEngine();

  const preferredDefault = engine.compile("prefer:default");

  assert.deepEqual(preferredDefault.dsl.query, { match_all: {} });
  assert.deepEqual(preferredDefault.dsl.sort, [
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

  assert.deepEqual(engine.compile("prefer:oldest").dsl, {
    query: { match_all: {} },
    sort: [
      { released_at: { order: "asc", unmapped_type: "keyword" } },
      { collector_number: { order: "asc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:newest").dsl, {
    query: { match_all: {} },
    sort: [
      { released_at: { order: "desc", unmapped_type: "keyword" } },
      { collector_number: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:usd-low").dsl, {
    query: { match_all: {} },
    sort: [{ "prices.usd": { order: "asc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("prefer:usd-high").dsl, {
    query: { match_all: {} },
    sort: [{ "prices.usd": { order: "desc", unmapped_type: "double" } }],
  });

  assert.deepEqual(engine.compile("prefer:promo").dsl, {
    query: { match_all: {} },
    sort: [
      { promo: { order: "desc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:ub").dsl, {
    query: { match_all: {} },
    sort: [
      { universes_beyond: { order: "desc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  assert.deepEqual(engine.compile("prefer:notub").dsl, {
    query: { match_all: {} },
    sort: [
      { universes_beyond: { order: "asc", unmapped_type: "boolean" } },
      { released_at: { order: "desc", unmapped_type: "keyword" } },
    ],
  });

  const atypical = engine.compile("prefer:atypical");
  assert.deepEqual(atypical.dsl.query, { match_all: {} });
  assert.equal(atypical.dsl.sort[0]._script.order, "desc");
  assert.match(atypical.dsl.sort[0]._script.script.source, /promo/);
});

test("supports is: token cross-reference matching", () => {
  const engine = createEngine();

  const { dsl: result } = engine.compile('is:etched name:"Lightning Bolt"');

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

test("supports is:commander semantic shortcut without coupling generic is: to legality", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:commander").dsl, {
    bool: {
      should: [
        {
          bool: {
            must: [
              { term: { "legalities.commander": "legal" } },
              {
                bool: {
                  should: [
                    { match: { type_line: { query: "legendary", operator: "and" } } },
                    wrapNested("card_faces", { match: { "card_faces.type_line": { query: "legendary", operator: "and" } } }),
                  ],
                  minimum_should_match: 1,
                },
              },
              {
                bool: {
                  should: [
                    { match: { type_line: { query: "artifact", operator: "and" } } },
                    wrapNested("card_faces", { match: { "card_faces.type_line": { query: "artifact", operator: "and" } } }),
                    { match: { type_line: { query: "creature", operator: "and" } } },
                    wrapNested("card_faces", { match: { "card_faces.type_line": { query: "creature", operator: "and" } } }),
                  ],
                  minimum_should_match: 1,
                },
              },
              { exists: { field: "power" } },
              { exists: { field: "toughness" } },
            ],
          },
        },
        {
          bool: {
            should: [
              { match_phrase: { oracle_text: "can be your commander" } },
              wrapNested("card_faces", { match_phrase: { "card_faces.oracle_text": "can be your commander" } }),
            ],
            minimum_should_match: 1,
          },
        },
      ],
      minimum_should_match: 1,
    },
  });
});

test("supports is:spell semantic shortcut type-line disjunction including battle", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:spell").dsl, {
    bool: {
      should: [
        { match: { type_line: { query: "creature", operator: "and" } } },
        { match: { type_line: { query: "artifact", operator: "and" } } },
        { match: { type_line: { query: "instant", operator: "and" } } },
        { match: { type_line: { query: "sorcery", operator: "and" } } },
        { match: { type_line: { query: "enchantment", operator: "and" } } },
        { match: { type_line: { query: "planeswalker", operator: "and" } } },
        { match: { type_line: { query: "battle", operator: "and" } } },
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "creature", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "artifact", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "instant", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "sorcery", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "enchantment", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "planeswalker", operator: "and" } } }),
        wrapNested("card_faces", { match: { "card_faces.type_line": { query: "battle", operator: "and" } } }),
      ],
      minimum_should_match: 1,
    },
  });

  const meta = engine.compile("is:spell");
  assert.deepEqual(meta.meta.terms.valid, ["is:spell"]);
  assert.deepEqual(meta.meta.terms.invalid, []);
});

test("supports not:spell semantic negation of is:spell disjunction", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("not:spell").dsl, {
    bool: {
      must_not: [
        {
          bool: {
            should: [
              { match: { type_line: { query: "creature", operator: "and" } } },
              { match: { type_line: { query: "artifact", operator: "and" } } },
              { match: { type_line: { query: "instant", operator: "and" } } },
              { match: { type_line: { query: "sorcery", operator: "and" } } },
              { match: { type_line: { query: "enchantment", operator: "and" } } },
              { match: { type_line: { query: "planeswalker", operator: "and" } } },
              { match: { type_line: { query: "battle", operator: "and" } } },
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "creature", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "artifact", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "instant", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "sorcery", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "enchantment", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "planeswalker", operator: "and" } } }),
              wrapNested("card_faces", { match: { "card_faces.type_line": { query: "battle", operator: "and" } } }),
            ],
            minimum_should_match: 1,
          },
        },
      ],
    },
  });

  const meta = engine.compile("not:spell");
  assert.deepEqual(meta.meta.terms.valid, ["not:spell"]);
  assert.deepEqual(meta.meta.terms.invalid, []);
});

test("supports not: token cross-reference matching", () => {
  const engine = createEngine();

  const { dsl: result } = engine.compile('lightning not:showcase');

  assert.equal(result.bool.must.length, 2);
  assert.deepEqual(result.bool.must[0], buildNameLooseClause("lightning"));
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

  assert.deepEqual(engine.compile("st:masterpiece -border:borderless -frame:future").dsl, {
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

  assert.deepEqual(engine.compile("is:default").dsl, {
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

test("compile treats is:default as a valid shortcut", () => {
  const engine = createEngine();
  const result = engine.compile("is:default");

  assert.deepEqual(result.meta.terms.valid, ["is:default"]);
  assert.deepEqual(result.meta.terms.invalid, []);
  assert.equal(result.meta.warnings.length, 0);
});

test("compile treats is:commander as a valid semantic shortcut", () => {
  const engine = createEngine();
  const result = engine.compile("is:commander");

  assert.deepEqual(result.meta.terms.valid, ["is:commander"]);
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
    assert.deepEqual(engine.compile(query).dsl, expected);
  }
});

test("supports combined is:default atoms across same and different fields", () => {
  const engine = createEngine();

  assert.deepEqual(
    engine.compile("not:extendedart not:fullart -frame:future -frame:colorshifted not:stamped -border:borderless").dsl,
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
    engine.compile("not:extendedart -border:borderless unique:cards order:usd direction:desc prefer:newest").dsl,
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
      aggs: {
        collapsed_total: {
          cardinality: {
            field: "oracle_id",
          },
        },
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
    ).dsl,
    {
      query: {
        bool: {
          must_not: [{ term: { frame_effects: "extendedart" } }],
        },
      },
      collapse: {
        field: "illustration_id",
      },
      aggs: {
        collapsed_total: {
          cardinality: {
            field: "illustration_id",
          },
        },
      },
      sort: [
        { cmc: { order: "asc", unmapped_type: "double" } },
        { promo: { order: "desc", unmapped_type: "boolean" } },
        { released_at: { order: "desc", unmapped_type: "keyword" } },
      ],
    }
  );
});

test("compile returns valid and invalid is/not terms in meta", () => {
  const engine = createEngine();

  const result = engine.compile("is:rare is:bibbityboppityboo");

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

  assert.deepEqual(engine.compile("is:bibbityboppityboo").dsl, { match_all: {} });
});

test("combines unique:cards with not: shortcuts and directives", () => {
  const engine = createEngine();

  const { dsl: result } = engine.compile("lightning unique:cards not:showcase");

  assert.deepEqual(result.collapse, {
    field: "oracle_id",
  });
  assert.deepEqual(result.aggs, {
    collapsed_total: {
      cardinality: {
        field: "oracle_id",
      },
    },
  });
  assert.equal(result.sort.length, 1);
  assert.equal(result.query.bool.must.length, 2);
  assert.deepEqual(result.query.bool.must[0], buildNameLooseClause("lightning"));
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

  const { dsl: result } = engine.compile("lightning unique:cards not:showcase prefer:default");

  assert.deepEqual(result.aggs, {
    collapsed_total: {
      cardinality: {
        field: "oracle_id",
      },
    },
  });
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

test("parses exact-name bang terms as non-merged name terms", () => {
  const engine = createEngine();
  const ast = engine.parse('!fire !"sift through sands"');

  assert.deepEqual(ast, {
    type: "boolean",
    operator: "and",
    clauses: [
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "fire",
        implicit: true,
        exactNameBang: true,
        negated: false,
      },
      {
        type: "term",
        field: "name",
        operator: ":",
        value: "sift through sands",
        implicit: true,
        exactNameBang: true,
        quoted: true,
        negated: false,
      },
    ],
  });
});

test("keeps boolean keywords literal inside quoted values", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('o:"choose one or both" name:"Fire and Ice"').dsl, {
    bool: {
      must: [
        {
          bool: {
            should: [
              { match_phrase: { oracle_text: "choose one or both" } },
              wrapNested("card_faces", { match_phrase: { "card_faces.oracle_text": "choose one or both" } }),
            ],
            minimum_should_match: 1,
          },
        },
        { match_phrase: { name: "Fire and Ice" } },
      ],
    },
  });
});

test("compiles quoted oracle/flavor text as match_phrase", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('o:"draw a card"').dsl, {
    bool: {
      should: [
        { match_phrase: { oracle_text: "draw a card" } },
        wrapNested("card_faces", { match_phrase: { "card_faces.oracle_text": "draw a card" } }),
      ],
      minimum_should_match: 1,
    },
  });

  assert.deepEqual(engine.compile('ft:"some flavor phrase"').dsl, {
    bool: {
      should: [
        { match_phrase: { flavor_text: "some flavor phrase" } },
        wrapNested("card_faces", { match_phrase: { "card_faces.flavor_text": "some flavor phrase" } }),
      ],
      minimum_should_match: 1,
    },
  });
});

test("unescapes escaped quotes inside quoted values", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile('o:"Whenever a card says \\"draw\\"..."').dsl, {
    bool: {
      should: [
        { match_phrase: { oracle_text: 'Whenever a card says "draw"...' } },
        wrapNested("card_faces", { match_phrase: { "card_faces.oracle_text": 'Whenever a card says "draw"...' } }),
      ],
      minimum_should_match: 1,
    },
  });
});

test("fails on unterminated quoted values", () => {
  const engine = createEngine();

  assert.throws(() => engine.parse('name:"Lightning Bolt'), /Unterminated quoted string/);
});

test("fails on unsupported exact-name bang forms", () => {
  const engine = createEngine();

  assert.throws(
    () => engine.parse("!name:fire"),
    /Fielded bang term "![^"]+" is not supported/
  );
  assert.throws(
    () => engine.parse("!o:draw"),
    /Fielded bang term "![^"]+" is not supported/
  );
  assert.throws(
    () => engine.parse("!"),
    /Exact-name bang term is missing a value/
  );
});

test("rejects order:oldest and order:newest as invalid order values", () => {
  const engine = createEngine();

  assert.throws(
    () => engine.compile("order:oldest"),
    /Unknown order expression "oldest"/
  );
  assert.throws(
    () => engine.compile("order:newest"),
    /Unknown order expression "newest"/
  );
});

test("rejects invalid esPath characters on field registration", () => {
  const engine = createEngine();

  assert.throws(
    () => engine.registerField("bad_field", {
      esPath: "a b",
      compile: () => ({ match_all: {} }),
    }),
    /contains invalid characters/
  );

  assert.throws(
    () => engine.registerField("bad_field2", {
      esPath: "a;b",
      compile: () => ({ match_all: {} }),
    }),
    /contains invalid characters/
  );
});

test("compile always returns dsl and meta", () => {
  const engine = createEngine();

  const result = engine.compile("c:red");

  assert.ok(Object.prototype.hasOwnProperty.call(result, "dsl"));
  assert.ok(Object.prototype.hasOwnProperty.call(result, "meta"));
  assert.ok(Object.prototype.hasOwnProperty.call(result.meta, "terms"));
  assert.ok(Object.prototype.hasOwnProperty.call(result.meta, "warnings"));

  const emptyResult = engine.compile("is:foo");
  assert.deepEqual(emptyResult.dsl, { match_all: {} });
  assert.deepEqual(emptyResult.meta.terms.valid, []);
  assert.deepEqual(emptyResult.meta.terms.invalid, ["is:foo"]);
  assert.equal(emptyResult.meta.warnings.length, 1);
});

test("supports game: and in: fields for game environment filtering", () => {
  const engine = createEngine();

  // game: and in: are aliases — both search the games array field
  assert.deepEqual(engine.compile("game:paper").dsl, { term: { games: "paper" } });
  assert.deepEqual(engine.compile("in:paper").dsl, { term: { games: "paper" } });
  assert.deepEqual(engine.compile("game:mtgo").dsl, { term: { games: "mtgo" } });
  assert.deepEqual(engine.compile("in:mtgo").dsl, { term: { games: "mtgo" } });
  assert.deepEqual(engine.compile("game:arena").dsl, { term: { games: "arena" } });
  assert.deepEqual(engine.compile("in:arena").dsl, { term: { games: "arena" } });

  // combined game filter
  assert.deepEqual(engine.compile("in:paper in:arena").dsl, {
    bool: {
      must: [
        { term: { games: "paper" } },
        { term: { games: "arena" } },
      ],
    },
  });
});

test("paper/mtgo/arena are no longer valid is: tokens", () => {
  const engine = createEngine();

  // These were previously (incorrectly) searchable via is: — they must now be invalid
  const paperResult = engine.compile("is:paper");
  assert.deepEqual(paperResult.dsl, { match_all: {} });
  assert.deepEqual(paperResult.meta.terms.invalid, ["is:paper"]);

  const mtgoResult = engine.compile("is:mtgo");
  assert.deepEqual(mtgoResult.dsl, { match_all: {} });
  assert.deepEqual(mtgoResult.meta.terms.invalid, ["is:mtgo"]);
});

test("supports is:digital as shorthand for mtgo or arena game environment", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:digital").dsl, {
    bool: {
      should: [
        { term: { games: "mtgo" } },
        { term: { games: "arena" } },
      ],
      minimum_should_match: 1,
    },
  });

  const result = engine.compile("is:digital");
  assert.deepEqual(result.meta.terms.valid, ["is:digital"]);
  assert.deepEqual(result.meta.terms.invalid, []);
});

test("supports is:promo against the promo boolean field", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:promo").dsl, { term: { promo: true } });

  const result = engine.compile("is:promo");
  assert.deepEqual(result.meta.terms.valid, ["is:promo"]);
  assert.deepEqual(result.meta.terms.invalid, []);
});

test("supports is:spotlight against the story_spotlight boolean field", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:spotlight").dsl, { term: { story_spotlight: true } });

  const result = engine.compile("is:spotlight");
  assert.deepEqual(result.meta.terms.valid, ["is:spotlight"]);
  assert.deepEqual(result.meta.terms.invalid, []);
});

test("is:alchemy and is:rebalanced search promo_types only (not set_type)", () => {
  const engine = createEngine();

  // is:alchemy → { term: { promo_types: "alchemy" } }, NOT set_type
  const alchemyResult = engine.compile("is:alchemy");
  assert.deepEqual(alchemyResult.dsl, { term: { promo_types: "alchemy" } });

  // is:rebalanced → { term: { promo_types: "rebalanced" } }
  const rebalancedResult = engine.compile("is:rebalanced");
  assert.deepEqual(rebalancedResult.dsl, { term: { promo_types: "rebalanced" } });

  // st:alchemy still works for set_type
  assert.deepEqual(engine.compile("st:alchemy").dsl, { term: { set_type: "alchemy" } });
});

test("is:promo and st:promo remain distinct", () => {
  const engine = createEngine();

  // is:promo → boolean field (promo: true)
  assert.deepEqual(engine.compile("is:promo").dsl, { term: { promo: true } });

  // st:promo → REMOVED from set_type; promo is not a valid set_type anymore for is:
  // (st:promo itself still works as a direct keyword field lookup)
  // st:promo tests the set_type field directly — this is unchanged behavior
  assert.deepEqual(engine.compile("st:promo").dsl, { term: { set_type: "promo" } });
});

test("registerField accepts valid ES field names including @ and hyphens", () => {
  const engine = createEngine();

  // @timestamp — common in ECS-compliant Elasticsearch indexes
  assert.doesNotThrow(() =>
    engine.registerField("timestamp", {
      esPath: "@timestamp",
      type: "keyword",
      operators: [":", "="],
      compile: compileKeywordField,
    })
  );

  // hyphenated field name
  assert.doesNotThrow(() =>
    engine.registerField("event_type", {
      esPath: "event-type",
      type: "keyword",
      operators: [":", "="],
      compile: compileKeywordField,
    })
  );

  // labels.env (dots still work)
  assert.doesNotThrow(() =>
    engine.registerField("env_label", {
      esPath: "labels.env",
      type: "keyword",
      operators: [":", "="],
      compile: compileKeywordField,
    })
  );
});

test("registerField rejects invalid esPath characters", () => {
  const engine = createEngine();

  // whitespace
  assert.throws(
    () => engine.registerField("bad_field", {
      esPath: "a b",
      operators: [":", "="],
      compile: compileKeywordField,
    }),
    /contains invalid characters/
  );

  // semicolon
  assert.throws(
    () => engine.registerField("bad_field2", {
      esPath: "a;b",
      operators: [":", "="],
      compile: compileKeywordField,
    }),
    /contains invalid characters/
  );
});

test("registerField rejects missing or empty operators array for non-control fields", () => {
  const engine = createEngine();

  // no operators property
  assert.throws(
    () => engine.registerField("no_operators", {
      esPath: "some.field",
      compile: compileKeywordField,
    }),
    /must define a non-empty "operators" array/
  );

  // empty operators array
  assert.throws(
    () => engine.registerField("empty_operators", {
      esPath: "some.field",
      operators: [],
      compile: compileKeywordField,
    }),
    /must define a non-empty "operators" array/
  );
});
