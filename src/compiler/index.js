import { createDefaultPrintingSorts, createFieldSort, createScriptSort } from "./helpers.js";
import { DEFAULT_CONTROL_CONFIG } from "./control-config.js";

const RARITY_RANKS = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
  special: 4,
  bonus: 5,
};

function normalizeCompiledClause(clause) {
  if (!clause) {
    throw new Error("Compiler produced an empty Elasticsearch clause.");
  }

  if (Object.prototype.hasOwnProperty.call(clause, "__sqdsl_clause")) {
    return {
      clause: clause.__sqdsl_clause ?? null,
      controls: [],
      meta: clause.__sqdsl_meta ? [clause.__sqdsl_meta] : [],
    };
  }

  if (clause.control) {
    return {
      clause: null,
      controls: [clause.control],
      meta: [],
    };
  }

  return {
    clause,
    controls: [],
    meta: [],
  };
}

function negateClause(clause) {
  return {
    bool: {
      must_not: [clause],
    },
  };
}

function boolKeyForOperator(operator) {
  if (operator === "and") {
    return "must";
  }

  if (operator === "or") {
    return "should";
  }

  throw new Error(`Unsupported boolean operator "${operator}".`);
}

function mergeBooleanResults(operator, results) {
  const clauses = [];
  const controls = [];
  const meta = [];

  for (const result of results) {
    controls.push(...result.controls);
    meta.push(...(result.meta ?? []));
    if (result.clause) {
      clauses.push(result.clause);
    }
  }

  if (!clauses.length) {
    return { clause: null, controls, meta };
  }

  if (clauses.length === 1) {
    return { clause: clauses[0], controls, meta };
  }

  const boolKey = boolKeyForOperator(operator);
  const bool = {
    [boolKey]: clauses,
  };

  if (boolKey === "should") {
    bool.minimum_should_match = 1;
  }

  return {
    clause: { bool },
    controls,
    meta,
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function resolveControlPath(path, context) {
  if (typeof path !== "string" || !path) {
    throw new Error(`Compiler control configuration missing "${context}".`);
  }

  return path;
}

function buildOrderSorts(order, direction, controlConfig) {
  const normalizedDirection = direction ?? "asc";
  const orderFields = controlConfig.orderFields ?? {};
  const orderScriptFields = controlConfig.orderScriptFields ?? {};

  if (order === "cmc") {
    return [createFieldSort(resolveControlPath(orderFields.cmc, "orderFields.cmc"), normalizedDirection, { unmapped_type: "double" })];
  }

  if (order === "power") {
    return [
      createFieldSort(resolveControlPath(orderFields.power, "orderFields.power"), normalizedDirection, {
        unmapped_type: "double",
      }),
    ];
  }

  if (order === "toughness") {
    return [
      createFieldSort(resolveControlPath(orderFields.toughness, "orderFields.toughness"), normalizedDirection, {
        unmapped_type: "double",
      }),
    ];
  }

  if (order === "set") {
    return [createFieldSort(resolveControlPath(orderFields.set, "orderFields.set"), normalizedDirection, { unmapped_type: "keyword" })];
  }

  if (order === "name") {
    return [createFieldSort(resolveControlPath(orderFields.name, "orderFields.name"), normalizedDirection, { unmapped_type: "keyword" })];
  }

  if (order === "usd" || order === "eur" || order === "tix") {
    return [
      createFieldSort(resolveControlPath(orderFields[order], `orderFields.${order}`), normalizedDirection, {
        unmapped_type: "double",
      }),
    ];
  }

  if (order === "edhrec") {
    return [
      createFieldSort(resolveControlPath(orderFields.edhrec, "orderFields.edhrec"), normalizedDirection, {
        unmapped_type: "long",
      }),
    ];
  }

  if (order === "released") {
    return [
      createFieldSort(resolveControlPath(orderFields.released, "orderFields.released"), normalizedDirection, {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (order === "rarity") {
    return [
      createScriptSort(
        `
          def rarity = doc.containsKey(params.field) && !doc[params.field].empty ? doc[params.field].value : null;
          if (rarity == null) {
            return params.fallback;
          }
          return params.ranks.containsKey(rarity) ? params.ranks.get(rarity) : params.fallback;
        `,
        {
          field: resolveControlPath(orderScriptFields.rarity, "orderScriptFields.rarity"),
          fallback: 999,
          ranks: RARITY_RANKS,
        },
        normalizedDirection
      ),
    ];
  }

  if (order === "color") {
    return [
      createScriptSort(
        `
          return doc.containsKey(params.field) && !doc[params.field].empty ? doc[params.field].size() : 0;
        `,
        {
          field: resolveControlPath(orderScriptFields.colors, "orderScriptFields.colors"),
        },
        normalizedDirection
      ),
    ];
  }

  throw new Error(`Unknown order expression "${order}".`);
}

function buildPreferSorts(prefer, controlConfig) {
  const preferConfig = controlConfig.prefer ?? {};

  if (prefer === "default") {
    return createDefaultPrintingSorts(preferConfig.defaultPrintingSortFields);
  }

  if (prefer === "oldest") {
    const oldestFields = preferConfig.oldestFields ?? {};
    return [
      createFieldSort(resolveControlPath(oldestFields.releasedAt, "prefer.oldestFields.releasedAt"), "asc", {
        unmapped_type: "keyword",
      }),
      createFieldSort(resolveControlPath(oldestFields.collectorNumber, "prefer.oldestFields.collectorNumber"), "asc", {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (prefer === "newest") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword",
      }),
      createFieldSort(resolveControlPath(newestFields.collectorNumber, "prefer.newestFields.collectorNumber"), "desc", {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (prefer === "usd-low") {
    return [createFieldSort(resolveControlPath(preferConfig.usdField, "prefer.usdField"), "asc", { unmapped_type: "double" })];
  }

  if (prefer === "usd-high") {
    return [
      createFieldSort(resolveControlPath(preferConfig.usdField, "prefer.usdField"), "desc", { unmapped_type: "double" }),
    ];
  }

  if (prefer === "promo") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.promoField, "prefer.promoField"), "desc", {
        unmapped_type: "boolean",
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (prefer === "ub") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.universesBeyondField, "prefer.universesBeyondField"), "desc", {
        unmapped_type: "boolean",
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (prefer === "notub") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.universesBeyondField, "prefer.universesBeyondField"), "asc", {
        unmapped_type: "boolean",
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword",
      }),
    ];
  }

  if (prefer === "atypical") {
    const atypicalFields = preferConfig.atypicalFields ?? {};

    return [
      createScriptSort(
        `
          def score = 0;
          if (doc.containsKey(params.promoField) && !doc[params.promoField].empty && doc[params.promoField].value) {
            score += 8;
          }
          if (doc.containsKey(params.frameEffectField) && !doc[params.frameEffectField].empty) {
            score += 4;
          }
          if (doc.containsKey(params.fullArtField) && !doc[params.fullArtField].empty && doc[params.fullArtField].value) {
            score += 2;
          }
          if (doc.containsKey(params.oversizedField) && !doc[params.oversizedField].empty && doc[params.oversizedField].value) {
            score += 1;
          }
          return score;
        `,
        {
          promoField: resolveControlPath(atypicalFields.promo, "prefer.atypicalFields.promo"),
          frameEffectField: resolveControlPath(atypicalFields.frameEffect, "prefer.atypicalFields.frameEffect"),
          fullArtField: resolveControlPath(atypicalFields.fullArt, "prefer.atypicalFields.fullArt"),
          oversizedField: resolveControlPath(atypicalFields.oversized, "prefer.atypicalFields.oversized"),
        },
        "desc"
      ),
    ];
  }

  throw new Error(`Unknown prefer expression "${prefer}".`);
}

function buildLangSorts(lang, controlConfig) {
  return [
    createScriptSort(
      `
        if (!doc.containsKey(params.field) || doc[params.field].empty) {
          return 1;
        }
        return doc[params.field].value == params.lang ? 0 : 1;
      `,
      {
        field: resolveControlPath(controlConfig.langField, "langField"),
        lang,
      },
      "asc"
    ),
  ];
}

function applySearchControls(controls, controlConfig) {
  const state = {
    unique: null,
    order: null,
    prefer: null,
    direction: "asc",
    lang: null,
  };

  for (const control of controls) {
    if (control.directive === "unique") {
      state.unique = control.value;
    } else if (control.directive === "order") {
      state.order = control.value;
    } else if (control.directive === "prefer") {
      state.prefer = control.value;
    } else if (control.directive === "direction") {
      state.direction = control.value;
    } else if (control.directive === "lang") {
      state.lang = control.value;
    }
  }

  const request = {};
  const collapseFields = controlConfig.collapseFields ?? {};

  if (state.unique === "cards") {
    request.collapse = {
      field: resolveControlPath(collapseFields.cards, "collapseFields.cards"),
    };
  } else if (state.unique === "art") {
    request.collapse = {
      field: resolveControlPath(collapseFields.art, "collapseFields.art"),
    };
  }

  const sort = [];

  if (state.lang) {
    sort.push(...buildLangSorts(state.lang, controlConfig));
  }

  if (state.order) {
    sort.push(...buildOrderSorts(state.order, state.direction, controlConfig));
  } else if (state.unique === "cards") {
    sort.push(...buildOrderSorts("name", state.direction, controlConfig));
  }

  if (state.prefer) {
    sort.push(...buildPreferSorts(state.prefer, controlConfig));
  }

  if (sort.length) {
    request.sort = sort;
  }

  return request;
}

export function createCompiler({ registry, controlConfig = DEFAULT_CONTROL_CONFIG }) {
  function compileTerm(node) {
    const fieldDefinition = registry.getField(node.field);
    const value = registry.parseValue(node.field, node.value);
    const compiled = normalizeCompiledClause(
      fieldDefinition.compile({
        fieldName: node.field,
        definition: fieldDefinition,
        operator: node.operator,
        value,
        node,
        registry,
      })
    );

    if (compiled.controls.length && node.negated) {
      throw new Error(`Search directive "${node.field}" cannot be negated.`);
    }

    return {
      clause: node.negated && compiled.clause ? negateClause(compiled.clause) : compiled.clause,
      controls: compiled.controls,
      meta: compiled.meta,
    };
  }

  function compileNode(node) {
    if (!node || typeof node !== "object") {
      throw new Error("Cannot compile an invalid AST node.");
    }

    if (node.type === "term") {
      return compileTerm(node);
    }

    if (node.type === "group") {
      const compiled = compileNode(node.clause);

      if (node.negated && compiled.clause) {
        return {
          clause: negateClause(compiled.clause),
          controls: compiled.controls,
          meta: compiled.meta,
        };
      }

      return compiled;
    }

    if (node.type === "boolean") {
      const results = node.clauses.map(compileNode);
      return mergeBooleanResults(node.operator, results);
    }

    throw new Error(`Unsupported AST node type "${node.type}".`);
  }

  return {
    compile(ast) {
      const compiled = compileNode(ast);
      const query = compiled.clause ?? { match_all: {} };
      const controls = applySearchControls(compiled.controls, controlConfig);
      const hasControls = Object.keys(controls).length > 0;

      if (!hasControls) {
        return query;
      }

      return {
        query,
        ...controls,
      };
    },
    compileWithMeta(ast) {
      const compiled = compileNode(ast);
      const query = compiled.clause ?? { match_all: {} };
      const controls = applySearchControls(compiled.controls, controlConfig);
      const hasControls = Object.keys(controls).length > 0;
      const dsl = hasControls
        ? {
            query,
            ...controls,
          }
        : query;

      const shortcutTerms = (compiled.meta ?? []).filter((entry) => entry?.type === "shortcut-term");
      const validTerms = uniqueStrings(shortcutTerms.filter((entry) => entry.valid).map((entry) => entry.term));
      const invalidTerms = uniqueStrings(shortcutTerms.filter((entry) => !entry.valid).map((entry) => entry.term));
      const warnings = shortcutTerms
        .filter((entry) => !entry.valid)
        .map((entry) => ({
          code: "UNKNOWN_IS_NOT_TOKEN",
          field: entry.field,
          token: entry.token,
          term: entry.term,
        }));

      return {
        dsl,
        meta: {
          terms: {
            valid: validTerms,
            invalid: invalidTerms,
          },
          warnings,
        },
      };
    },
  };
}
