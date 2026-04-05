import test from "node:test";
import assert from "node:assert/strict";

import { createEngine, compileColorField, parseColorExpression } from "../src/index.js";
import { DEFAULT_CONTROL_CONFIG, createPrefixedControlConfig } from "../src/compiler/control-config.js";
import { createDefaultFieldDefinitions } from "../src/fields/defaults.js";
import { createCtxCardProfileExtension, deriveCtxCardFieldDefinitions } from "../src/profiles/ctx-card.js";

function wrapNested(path, clause) {
  return { nested: { path, query: clause, ignore_unmapped: true } };
}

function buildContainsColorClause(path, colors) {
  return {
    bool: {
      must: colors.map((symbol) => ({ term: { [path]: symbol } })),
    },
  };
}

test("derives ctx.card field definitions with deterministic path prefixing", () => {
  const extension = createCtxCardProfileExtension();

  assert.equal(extension.override, true);

  assert.equal(extension.fields.colors.esPath, "card.colors");
  assert.deepEqual(extension.fields.colors.esPaths, ["card.colors", "card.card_faces.colors"]);

  assert.equal(extension.fields.oracle_text.esPath, "card.oracle_text");
  assert.deepEqual(extension.fields.oracle_text.esPaths, ["card.oracle_text", "card.card_faces.oracle_text"]);
  assert.deepEqual(extension.fields.name.exactEsPaths, ["card.name.keyword", "card.card_faces.name.keyword"]);
  assert.equal(extension.fields.is.semanticShortcuts.commander.legalityPath, "card.legalities.commander");
  assert.deepEqual(extension.fields.is.semanticShortcuts.commander.typePaths, [
    "card.type_line",
    "card.card_faces.type_line",
  ]);
  assert.deepEqual(extension.fields.is.semanticShortcuts.commander.oraclePaths, [
    "card.oracle_text",
    "card.card_faces.oracle_text",
  ]);
  assert.equal(extension.fields.is.semanticShortcuts.commander.powerPath, "card.power");
  assert.equal(extension.fields.is.semanticShortcuts.commander.toughnessPath, "card.toughness");

  assert.equal(extension.fields.unique.searchControl, true);
  assert.equal(Object.prototype.hasOwnProperty.call(extension.fields.unique, "esPath"), false);

  assert.ok(extension.fields.is.tokenFieldMap.showcase.includes("card.frame_effects"));
  assert.ok(extension.fields.not.tokenFieldMap.playtest.includes("card.promo_types"));
});

test("derived ctx.card profile compiles non-control clauses against card-prefixed fields", () => {
  const engine = createEngine();
  engine.registerProfile("ctx_card_manual", createCtxCardProfileExtension(), { override: true });

  const { dsl } = engine.compile("c:red t:dragon mv<=5 not:showcase", { profile: "ctx_card_manual" });

  assert.deepEqual(dsl, {
    bool: {
      must: [
        {
          bool: {
            should: [
              buildContainsColorClause("card.colors", ["R"]),
              wrapNested("card.card_faces", buildContainsColorClause("card.card_faces.colors", ["R"])),
            ],
            minimum_should_match: 1,
          },
        },
        {
          bool: {
            should: [
              { match: { "card.type_line": "dragon" } },
              wrapNested("card.card_faces", { match: { "card.card_faces.type_line": "dragon" } }),
            ],
            minimum_should_match: 1,
          },
        },
        { range: { "card.cmc": { lte: 5 } } },
        {
          bool: {
            must_not: [
              { term: { "card.frame_effects": "showcase" } },
            ],
          },
        },
      ],
    },
  });
});

test("ctx.card derivation keeps field-name parity with default definitions", () => {
  const defaultFields = createDefaultFieldDefinitions();
  const ctxCardFields = deriveCtxCardFieldDefinitions();

  assert.deepEqual(Object.keys(ctxCardFields).sort(), Object.keys(defaultFields).sort());

  for (const [fieldName, definition] of Object.entries(defaultFields)) {
    const ctxDefinition = ctxCardFields[fieldName];
    assert.deepEqual(ctxDefinition.aliases ?? [], definition.aliases ?? []);
    assert.equal(Boolean(ctxDefinition.searchControl), Boolean(definition.searchControl));
  }
});

test("ctx.card derivation prefixes non-control paths and leaves controls untouched", () => {
  const defaultFields = createDefaultFieldDefinitions();
  const ctxCardFields = deriveCtxCardFieldDefinitions();

  for (const [fieldName, defaultDefinition] of Object.entries(defaultFields)) {
    const ctxDefinition = ctxCardFields[fieldName];

    if (defaultDefinition.searchControl) {
      assert.equal(ctxDefinition.esPath, defaultDefinition.esPath);
      assert.deepEqual(ctxDefinition.esPaths, defaultDefinition.esPaths);
      continue;
    }

    if (typeof defaultDefinition.esPath === "string" && defaultDefinition.esPath.length) {
      assert.equal(ctxDefinition.esPath, `card.${defaultDefinition.esPath}`);
    }

    if (Array.isArray(defaultDefinition.esPaths)) {
      assert.deepEqual(
        ctxDefinition.esPaths,
        defaultDefinition.esPaths.map((path) => `card.${path}`)
      );
    }

    if (Array.isArray(defaultDefinition.exactEsPaths)) {
      assert.deepEqual(
        ctxDefinition.exactEsPaths,
        defaultDefinition.exactEsPaths.map((path) => `card.${path}`)
      );
    }

    if (defaultDefinition.tokenFieldMap) {
      for (const [token, paths] of Object.entries(defaultDefinition.tokenFieldMap)) {
        assert.deepEqual(
          ctxDefinition.tokenFieldMap[token],
          paths.map((path) => `card.${path}`)
        );
      }
    }
  }
});

test("prefixed control config preserves control coverage while remapping fields", () => {
  const prefixed = createPrefixedControlConfig("card");

  assert.deepEqual(Object.keys(prefixed.collapseFields).sort(), Object.keys(DEFAULT_CONTROL_CONFIG.collapseFields).sort());
  assert.deepEqual(Object.keys(prefixed.orderFields).sort(), Object.keys(DEFAULT_CONTROL_CONFIG.orderFields).sort());
  assert.deepEqual(Object.keys(prefixed.orderScriptFields).sort(), Object.keys(DEFAULT_CONTROL_CONFIG.orderScriptFields).sort());

  assert.equal(prefixed.collapseFields.cards, "card.oracle_id");
  assert.equal(prefixed.collapseFields.art, "card.illustration_id");
  assert.equal(prefixed.orderFields.name, "card.name.keyword");
  assert.equal(prefixed.orderScriptFields.rarity, "card.rarity");
  assert.equal(prefixed.langField, "card.lang");
  assert.equal(prefixed.prefer.defaultPrintingSortFields.frameEffects, "card.frame_effects");
  assert.equal(prefixed.prefer.atypicalFields.frameEffect, "card.frame_effect");
});

test("prefixed control config covers all prefer sub-keys from DEFAULT_CONTROL_CONFIG", () => {
  // Guard against key drift: if a new key is added to DEFAULT_CONTROL_CONFIG.prefer.*
  // but not to createPrefixedControlConfig, the ctx.card profile silently uses the
  // wrong (un-prefixed) path. This test will fail when a key is added to one but not both.
  const prefixed = createPrefixedControlConfig("card");

  assert.deepEqual(
    Object.keys(prefixed.prefer).sort(),
    Object.keys(DEFAULT_CONTROL_CONFIG.prefer).sort(),
    "prefer top-level keys must match between DEFAULT_CONTROL_CONFIG and createPrefixedControlConfig"
  );

  assert.deepEqual(
    Object.keys(prefixed.prefer.defaultPrintingSortFields).sort(),
    Object.keys(DEFAULT_CONTROL_CONFIG.prefer.defaultPrintingSortFields).sort(),
    "prefer.defaultPrintingSortFields keys must match"
  );

  assert.deepEqual(
    Object.keys(prefixed.prefer.oldestFields).sort(),
    Object.keys(DEFAULT_CONTROL_CONFIG.prefer.oldestFields).sort(),
    "prefer.oldestFields keys must match"
  );

  assert.deepEqual(
    Object.keys(prefixed.prefer.newestFields).sort(),
    Object.keys(DEFAULT_CONTROL_CONFIG.prefer.newestFields).sort(),
    "prefer.newestFields keys must match"
  );

  assert.deepEqual(
    Object.keys(prefixed.prefer.atypicalFields).sort(),
    Object.keys(DEFAULT_CONTROL_CONFIG.prefer.atypicalFields).sort(),
    "prefer.atypicalFields keys must match"
  );

  // Spot-check that string fields are also prefixed (not nested objects)
  assert.equal(prefixed.prefer.usdField, "card.prices.usd");
  assert.equal(prefixed.prefer.promoField, "card.promo");
  assert.equal(prefixed.prefer.universesBeyondField, "card.universes_beyond");
});

test("built-in ctx.card profile is available without manual registration", () => {
  const engine = createEngine();

  assert.ok(engine.listProfiles().includes("default"));
  assert.ok(engine.listProfiles().includes("ctx.card"));
});

test("built-in ctx.card profile applies control paths to card-prefixed fields", () => {
  const engine = createEngine();
  const { dsl } = engine.compile("c:red unique:cards order:name direction:desc prefer:newest lang:ja", {
    profile: "ctx.card",
  });

  assert.deepEqual(dsl.query, {
    bool: {
      should: [
        buildContainsColorClause("card.colors", ["R"]),
        wrapNested("card.card_faces", buildContainsColorClause("card.card_faces.colors", ["R"])),
      ],
      minimum_should_match: 1,
    },
  });

  assert.deepEqual(dsl.collapse, { field: "card.oracle_id" });
  assert.equal(dsl.sort[0]._script.script.params.field, "card.lang");
  assert.equal(dsl.sort[0]._script.script.params.lang, "ja");
  assert.deepEqual(dsl.sort[1], { "card.name.keyword": { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(dsl.sort[2], { "card.released_at": { order: "desc", unmapped_type: "keyword" } });
  assert.deepEqual(dsl.sort[3], { "card.collector_number": { order: "desc", unmapped_type: "keyword" } });
});

test("built-in ctx.card profile supports order mappings across card-prefixed fields", () => {
  const engine = createEngine();

  const fieldOrderCases = [
    ["order:cmc", "card.cmc", { order: "asc", unmapped_type: "double" }],
    ["order:power", "card.power_num", { order: "asc", unmapped_type: "double" }],
    ["order:toughness", "card.toughness_num", { order: "asc", unmapped_type: "double" }],
    ["order:set", "card.set", { order: "asc", unmapped_type: "keyword" }],
    ["order:name", "card.name.keyword", { order: "asc", unmapped_type: "keyword" }],
    ["order:usd", "card.prices.usd", { order: "asc", unmapped_type: "double" }],
    ["order:tix", "card.prices.tix", { order: "asc", unmapped_type: "double" }],
    ["order:eur", "card.prices.eur", { order: "asc", unmapped_type: "double" }],
    ["order:edhrec", "card.edhrec_rank", { order: "asc", unmapped_type: "long" }],
    ["order:released", "card.released_at", { order: "asc", unmapped_type: "keyword" }],
  ];

  for (const [query, field, expected] of fieldOrderCases) {
    const result = engine.compile(query, { profile: "ctx.card" });
    assert.deepEqual(result.dsl.query, { match_all: {} });
    assert.deepEqual(result.dsl.sort[0], { [field]: expected });
  }

  const rarity = engine.compile("order:rarity", { profile: "ctx.card" });
  const color = engine.compile("order:color", { profile: "ctx.card" });

  assert.equal(rarity.dsl.sort[0]._script.script.params.field, "card.rarity");
  assert.equal(color.dsl.sort[0]._script.script.params.field, "card.colors");
});

test("built-in ctx.card profile supports unique and prefer mappings on card-prefixed fields", () => {
  const engine = createEngine();

  const uniqueCards = engine.compile("unique:cards", { profile: "ctx.card" });
  assert.deepEqual(uniqueCards.dsl.collapse, { field: "card.oracle_id" });
  assert.deepEqual(uniqueCards.dsl.aggs, {
    collapsed_total: {
      cardinality: {
        field: "card.oracle_id",
      },
    },
  });
  assert.deepEqual(uniqueCards.dsl.sort[0], { "card.name.keyword": { order: "asc", unmapped_type: "keyword" } });

  const uniqueArt = engine.compile("unique:art", { profile: "ctx.card" });
  assert.deepEqual(uniqueArt.dsl.collapse, { field: "card.illustration_id" });
  assert.deepEqual(uniqueArt.dsl.aggs, {
    collapsed_total: {
      cardinality: {
        field: "card.illustration_id",
      },
    },
  });

  const preferredDefault = engine.compile("prefer:default", { profile: "ctx.card" });
  assert.deepEqual(preferredDefault.dsl.query, { match_all: {} });
  assert.deepEqual(preferredDefault.dsl.sort, [
    { "card.full_art": { order: "asc", unmapped_type: "boolean" } },
    { "card.promo_types": { order: "asc", unmapped_type: "keyword", missing: "_first" } },
    { "card.frame_effects": { order: "asc", unmapped_type: "keyword", missing: "_first" } },
    { "card.set_type": { order: "asc", unmapped_type: "keyword" } },
    { "card.frame": { order: "asc", unmapped_type: "keyword" } },
    { "card.finishes": { order: "desc", unmapped_type: "keyword" } },
    { "card.border_color": { order: "desc", unmapped_type: "keyword" } },
    { "card.released_at": { order: "desc", unmapped_type: "keyword" } },
    { "card.collector_number": { order: "desc", unmapped_type: "keyword" } },
  ]);
});

test("built-in ctx.card keeps default order-value validation behavior", () => {
  const engine = createEngine();

  assert.throws(
    () => engine.compile("order:oldest", { profile: "ctx.card" }),
    /Unknown order expression "oldest"/
  );
  assert.throws(
    () => engine.compile("order:newest", { profile: "ctx.card" }),
    /Unknown order expression "newest"/
  );
});

test("built-in ctx.card profile compiles exact-name bang against card-prefixed exact paths", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("!fire", { profile: "ctx.card" }).dsl, {
    bool: {
      should: [
        { term: { "card.name.keyword": "fire" } },
        wrapNested("card.card_faces", { term: { "card.card_faces.name.keyword": "fire" } }),
      ],
      minimum_should_match: 1,
    },
  });
});

test("built-in ctx.card profile applies name= include-style semantics", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("name=jace", { profile: "ctx.card" }).dsl, {
    bool: {
      should: [
        {
          match: {
            "card.name": {
              query: "jace",
              boost: 4,
            },
          },
        },
        {
          match: {
            "card.name.prefix": {
              query: "jace",
              boost: 3,
            },
          },
        },
        {
          match: {
            "card.name.infix": {
              query: "jace",
              boost: 2,
            },
          },
        },
      ],
      minimum_should_match: 1,
    },
  });
});

test("built-in ctx.card profile supports legality aliases and date/year fields", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("f:modern banned:historic restricted:vintage", { profile: "ctx.card" }).dsl, {
    bool: {
      must: [
        { term: { "card.legalities.modern": "legal" } },
        { term: { "card.legalities.historic": "banned" } },
        { term: { "card.legalities.vintage": "restricted" } },
      ],
    },
  });

  assert.deepEqual(engine.compile("date>=2015-08-18 year<=2020", { profile: "ctx.card" }).dsl, {
    bool: {
      must: [
        { range: { "card.released_at": { gte: "2015-08-18" } } },
        { range: { "card.released_at": { lte: "2020-12-31" } } },
      ],
    },
  });
});

test("built-in ctx.card profile compiles is:commander semantic shortcut against card-prefixed fields", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:commander", { profile: "ctx.card" }).dsl, {
    bool: {
      should: [
        {
          bool: {
            must: [
              { term: { "card.legalities.commander": "legal" } },
              {
                bool: {
                  should: [
                    { match: { "card.type_line": { query: "legendary", operator: "and" } } },
                    wrapNested("card.card_faces", { match: { "card.card_faces.type_line": { query: "legendary", operator: "and" } } }),
                  ],
                  minimum_should_match: 1,
                },
              },
              {
                bool: {
                  should: [
                    { match: { "card.type_line": { query: "artifact", operator: "and" } } },
                    wrapNested("card.card_faces", { match: { "card.card_faces.type_line": { query: "artifact", operator: "and" } } }),
                    { match: { "card.type_line": { query: "creature", operator: "and" } } },
                    wrapNested("card.card_faces", { match: { "card.card_faces.type_line": { query: "creature", operator: "and" } } }),
                  ],
                  minimum_should_match: 1,
                },
              },
              { exists: { field: "card.power" } },
              { exists: { field: "card.toughness" } },
            ],
          },
        },
        {
          bool: {
            should: [
              { match_phrase: { "card.oracle_text": "can be your commander" } },
              wrapNested("card.card_faces", { match_phrase: { "card.card_faces.oracle_text": "can be your commander" } }),
            ],
            minimum_should_match: 1,
          },
        },
      ],
      minimum_should_match: 1,
    },
  });
});

test("built-in ctx.card profile supports comparison-style not-equals and rejects keyword not-equals", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("mv!=3", { profile: "ctx.card" }).dsl, {
    bool: {
      must_not: [
        { term: { "card.cmc": 3 } },
      ],
    },
  });

  assert.throws(
    () => engine.compile("set!=lea", { profile: "ctx.card" }),
    /does not support operator \"!=\"/
  );
});

test("built-in ctx.card profile compiles numeric power/toughness fields against card companion paths", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("pow>=3 tou<=2", { profile: "ctx.card" }).dsl, {
    bool: {
      must: [
        { range: { "card.power_num": { gte: 3 } } },
        { range: { "card.toughness_num": { lte: 2 } } },
      ],
    },
  });
});

test("built-in ctx.card profile compiles game:/in: against card-prefixed games field", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("game:paper", { profile: "ctx.card" }).dsl, {
    term: { "card.games": "paper" },
  });

  assert.deepEqual(engine.compile("in:mtgo", { profile: "ctx.card" }).dsl, {
    term: { "card.games": "mtgo" },
  });
});

test("built-in ctx.card profile compiles is:digital against card-prefixed games field", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:digital", { profile: "ctx.card" }).dsl, {
    bool: {
      should: [
        { term: { "card.games": "mtgo" } },
        { term: { "card.games": "arena" } },
      ],
      minimum_should_match: 1,
    },
  });
});

test("built-in ctx.card profile compiles is:promo and is:spotlight against card-prefixed boolean fields", () => {
  const engine = createEngine();

  assert.deepEqual(engine.compile("is:promo", { profile: "ctx.card" }).dsl, {
    term: { "card.promo": true },
  });

  assert.deepEqual(engine.compile("is:spotlight", { profile: "ctx.card" }).dsl, {
    term: { "card.story_spotlight": true },
  });
});

test("resolveNestedPath uses longest-matching container regardless of registration order", () => {
  // Regression test for first-match vs. longest-match behavior.
  // When nestedContainers includes both "outer" and "outer.inner" and the esPath
  // is "outer.inner.colors", the correct container is "outer.inner", not "outer".
  // A first-match implementation with ["outer", "outer.inner"] would incorrectly
  // pick "outer"; longest-match must win.
  const engine = createEngine();

  // Register a color-type field with doubly-nested containers listed shallower-first.
  // If first-match is used, "outer" would win over "outer.inner" for path "outer.inner.colors".
  engine.registerProfile("nested_test", {
    override: true,
    fields: {
      colors: {
        aliases: ["c", "color"],
        esPath: "outer.inner.colors",
        esPaths: ["outer.inner.colors"],
        nestedContainers: ["outer", "outer.inner"],
        type: "color-set",
        operators: [":", "=", "!=", ">", ">=", "<", "<="],
        parseValue: parseColorExpression,
        compile: compileColorField,
      },
    },
  });

  const { dsl } = engine.compile("c:red", { profile: "nested_test" });

  // The nested query must use the deepest matching container "outer.inner",
  // not the shallower "outer".
  assert.equal(dsl.nested?.path, "outer.inner", "nested path must be the longest match");
  assert.deepEqual(dsl.nested?.query, {
    bool: {
      must: [{ term: { "outer.inner.colors": "R" } }],
    },
  });
});
