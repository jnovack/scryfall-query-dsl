/* scryfall-query-dsl v0.2.0-rc.1+3f372f7 | built 2026-04-05T19:14:30.731Z */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  BUILD_DATE: () => BUILD_DATE,
  RELEASE: () => RELEASE,
  VERSION: () => VERSION,
  announceBrowserBuild: () => announceBrowserBuild,
  compileBooleanField: () => compileBooleanField,
  compileCollectorNumberField: () => compileCollectorNumberField,
  compileColorField: () => compileColorField,
  compileDateField: () => compileDateField,
  compileIsShortcutField: () => compileIsShortcutField,
  compileKeywordField: () => compileKeywordField,
  compileLegalityField: () => compileLegalityField,
  compileNotShortcutField: () => compileNotShortcutField,
  compileNumericField: () => compileNumericField,
  compileOrderedKeywordField: () => compileOrderedKeywordField,
  compileSearchDirectionField: () => compileSearchDirectionField,
  compileSearchLangField: () => compileSearchLangField,
  compileSearchOrderField: () => compileSearchOrderField,
  compileSearchPreferField: () => compileSearchPreferField,
  compileSearchUniqueField: () => compileSearchUniqueField,
  compileTextField: () => compileTextField,
  compileYearField: () => compileYearField,
  createEngine: () => createEngine,
  parseColorExpression: () => parseColorExpression
});
module.exports = __toCommonJS(index_exports);

// src/compiler/helpers.js
var ATOM_PATTERN = /^(-)?([^:><=]+)(>=|<=|:|=|>|<)(.+)$/;
var RANGE_OPERATOR_MAP = {
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte"
};
var ORDERED_COLORS = ["white", "blue", "black", "red", "green"];
var COLOR_SYMBOLS = {
  white: "W",
  blue: "U",
  black: "B",
  red: "R",
  green: "G"
};
var COLOR_ALIASES = {
  w: ["white"],
  white: ["white"],
  u: ["blue"],
  blue: ["blue"],
  b: ["black"],
  black: ["black"],
  r: ["red"],
  red: ["red"],
  g: ["green"],
  green: ["green"],
  c: [],
  colorless: [],
  m: "__multicolor__",
  multicolor: "__multicolor__",
  azorius: ["white", "blue"],
  dimir: ["blue", "black"],
  rakdos: ["black", "red"],
  gruul: ["red", "green"],
  selesnya: ["white", "green"],
  orzhov: ["white", "black"],
  izzet: ["blue", "red"],
  golgari: ["black", "green"],
  boros: ["white", "red"],
  simic: ["blue", "green"],
  bant: ["white", "blue", "green"],
  esper: ["white", "blue", "black"],
  grixis: ["blue", "black", "red"],
  jund: ["black", "red", "green"],
  naya: ["white", "red", "green"],
  abzan: ["white", "black", "green"],
  jeskai: ["white", "blue", "red"],
  sultai: ["blue", "black", "green"],
  mardu: ["white", "black", "red"],
  temur: ["blue", "red", "green"],
  dromoka: ["white", "green"],
  ojutai: ["white", "blue"],
  silumgar: ["blue", "black"],
  kolaghan: ["black", "red"],
  atarka: ["red", "green"],
  broker: ["white", "blue", "green"],
  brokers: ["white", "blue", "green"],
  obscura: ["white", "blue", "black"],
  maestros: ["blue", "black", "red"],
  riveteers: ["black", "red", "green"],
  cabaretti: ["white", "red", "green"],
  lorehold: ["white", "red"],
  prismari: ["blue", "red"],
  quandrix: ["blue", "green"],
  silverquill: ["white", "black"],
  witherbloom: ["black", "green"],
  chaos: ["blue", "black", "red", "green"],
  aggression: ["white", "black", "red", "green"],
  altruism: ["white", "blue", "red", "green"],
  growth: ["white", "blue", "black", "red"],
  artifice: ["white", "blue", "black", "green"]
};
function assertSupportedOperator(fieldName, supportedOperators, operator) {
  if (!supportedOperators.includes(operator)) {
    throw new Error(
      `Field "${fieldName}" does not support operator "${operator}". Supported operators: ${supportedOperators.join(", ")}`
    );
  }
}
function compileKeywordDisjunction(esPath, values) {
  if (!values.length) {
    return { match_none: {} };
  }
  if (values.length === 1) {
    return {
      term: {
        [esPath]: values[0]
      }
    };
  }
  return {
    bool: {
      should: values.map((value) => ({
        term: {
          [esPath]: value
        }
      })),
      minimum_should_match: 1
    }
  };
}
function compilePathDisjunction(clauses) {
  if (clauses.length === 1) {
    return clauses[0];
  }
  return {
    bool: {
      should: clauses,
      minimum_should_match: 1
    }
  };
}
function negateCompiledClause(clause) {
  return {
    bool: {
      must_not: [clause]
    }
  };
}
function createMatchClause(fieldPath, value, options = {}) {
  if (!Object.keys(options).length) {
    return {
      match: {
        [fieldPath]: value
      }
    };
  }
  return {
    match: {
      [fieldPath]: {
        query: value,
        ...options
      }
    }
  };
}
function createPartialPathVariants(basePath, subfields = []) {
  if (!Array.isArray(subfields) || !subfields.length) {
    return [basePath];
  }
  return [basePath, ...subfields.map((subfield) => `${basePath}.${subfield}`)];
}
function compileNameTextField({ definition, value, node }) {
  const basePath = definition.esPath;
  const exactEsPaths = Array.isArray(definition.exactEsPaths) && definition.exactEsPaths.length ? definition.exactEsPaths : [`${basePath}.keyword`];
  const nestedContainers = definition.nestedContainers;
  const hasWhitespace = /\s/.test(value);
  const operator = hasWhitespace ? "and" : void 0;
  if (node?.exactNameBang) {
    const terms = exactEsPaths.map((esPath) => {
      const clause = { term: { [esPath]: value } };
      const nestedPath = resolveNestedPath(nestedContainers, esPath);
      return nestedPath ? wrapNested(nestedPath, clause) : clause;
    });
    return compilePathDisjunction(terms);
  }
  if (node?.quoted) {
    return {
      match_phrase: {
        [basePath]: value
      }
    };
  }
  return {
    bool: {
      should: [
        createMatchClause(basePath, value, {
          ...operator ? { operator } : {},
          boost: 4
        }),
        createMatchClause(`${basePath}.prefix`, value, {
          ...operator ? { operator } : {},
          boost: 3
        }),
        createMatchClause(`${basePath}.infix`, value, {
          ...operator ? { operator } : {},
          boost: 2
        })
      ],
      minimum_should_match: 1
    }
  };
}
function compileDateComparisonClause(esPath, operator, value) {
  if (operator === ":" || operator === "=") {
    return {
      term: {
        [esPath]: value
      }
    };
  }
  return {
    range: {
      [esPath]: {
        [RANGE_OPERATOR_MAP[operator]]: value
      }
    }
  };
}
function compilePartialTextField({ definition, value, node }) {
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const nestedContainers = definition.nestedContainers;
  if (node?.quoted) {
    const clauses2 = esPaths.map((path) => {
      const clause = { match_phrase: { [path]: value } };
      const nestedPath = resolveNestedPath(nestedContainers, path);
      return nestedPath ? wrapNested(nestedPath, clause) : clause;
    });
    return compilePathDisjunction(clauses2);
  }
  const subfields = definition.partialSubfields ?? ["prefix", "infix"];
  const pathVariants = esPaths.flatMap((path) => createPartialPathVariants(path, subfields));
  const clauses = pathVariants.map((path) => {
    const clause = createMatchClause(path, value);
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  });
  return compilePathDisjunction(clauses);
}
function compileNumericField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value
      }
    };
  }
  if (operator === "!=") {
    return negateCompiledClause({
      term: {
        [definition.esPath]: value
      }
    });
  }
  return {
    range: {
      [definition.esPath]: {
        [RANGE_OPERATOR_MAP[operator]]: value
      }
    }
  };
}
function compileKeywordField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const terms = esPaths.map((esPath) => ({
    term: {
      [esPath]: value
    }
  }));
  if (operator === "!=") {
    return negateCompiledClause(compilePathDisjunction(terms));
  }
  return compilePathDisjunction(terms);
}
function compileTextField({ fieldName, definition, operator, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const nestedContainers = definition.nestedContainers;
  const normalizedFieldName = definition.name ?? fieldName;
  if (normalizedFieldName === "name" && (operator === ":" || operator === "=") && typeof value === "string" && esPaths.length === 1) {
    return compileNameTextField({
      definition,
      value,
      node
    });
  }
  if (operator === "=") {
    const terms = esPaths.map((esPath) => {
      const clause = { term: { [esPath]: value } };
      const nestedPath = resolveNestedPath(nestedContainers, esPath);
      return nestedPath ? wrapNested(nestedPath, clause) : clause;
    });
    return compilePathDisjunction(terms);
  }
  if (definition.enablePartialSubfields) {
    return compilePartialTextField({
      definition,
      value,
      node
    });
  }
  const matches = esPaths.map((esPath) => {
    const clause = createMatchClause(esPath, value);
    const nestedPath = resolveNestedPath(nestedContainers, esPath);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  });
  return compilePathDisjunction(matches);
}
function compileBooleanField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  return {
    term: {
      [definition.esPath]: value
    }
  };
}
function compileSearchDirectiveField({ fieldName, definition, operator, value, directive }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  return {
    control: {
      directive,
      value
    }
  };
}
function compileSearchUniqueField(args) {
  return compileSearchDirectiveField({ ...args, directive: "unique" });
}
function compileSearchOrderField(args) {
  return compileSearchDirectiveField({ ...args, directive: "order" });
}
function compileSearchPreferField(args) {
  return compileSearchDirectiveField({ ...args, directive: "prefer" });
}
function compileSearchDirectionField(args) {
  return compileSearchDirectiveField({ ...args, directive: "direction" });
}
function compileSearchLangField(args) {
  return compileSearchDirectiveField({ ...args, directive: "lang" });
}
function compileLegalityField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const legalityStatus = definition.legalityStatus ?? "legal";
  return {
    term: {
      [`${definition.esPath}.${value}`]: legalityStatus
    }
  };
}
function compileDateField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  return compileDateComparisonClause(definition.esPath, operator, value);
}
function compileYearField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const year = Number(value);
  if (!Number.isInteger(year)) {
    throw new Error(`Year comparisons require an integer year value. Received "${value}".`);
  }
  const esPath = definition.esPath;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (operator === ":" || operator === "=") {
    return {
      range: {
        [esPath]: {
          gte: yearStart,
          lte: yearEnd
        }
      }
    };
  }
  if (operator === ">") {
    return {
      range: {
        [esPath]: {
          gt: yearEnd
        }
      }
    };
  }
  if (operator === ">=") {
    return {
      range: {
        [esPath]: {
          gte: yearStart
        }
      }
    };
  }
  if (operator === "<") {
    return {
      range: {
        [esPath]: {
          lt: yearStart
        }
      }
    };
  }
  if (operator === "<=") {
    return {
      range: {
        [esPath]: {
          lte: yearEnd
        }
      }
    };
  }
  throw new Error(`Unsupported operator "${operator}" for field "${fieldName}".`);
}
function normalizeShortcutCompiledClause(clause) {
  if (!clause) {
    throw new Error("Shortcut compiler produced an empty clause.");
  }
  if (Object.prototype.hasOwnProperty.call(clause, "__sqdsl_clause")) {
    return clause.__sqdsl_clause ?? null;
  }
  if (clause.control) {
    throw new Error("Shortcut expansion cannot emit search controls.");
  }
  return clause;
}
function negateShortcutClause(clause) {
  return {
    bool: {
      must_not: [clause]
    }
  };
}
function compileShortcutAtomClause(atom, registry) {
  const match = atom.match(ATOM_PATTERN);
  if (!match) {
    throw new Error(`Invalid is:default atom "${atom}".`);
  }
  const [, unaryNegation, fieldName, operator, rawValue] = match;
  const definition = registry.getField(fieldName);
  const parsedValue = registry.parseValue(fieldName, rawValue);
  const compiled = definition.compile({
    fieldName,
    definition,
    operator,
    value: parsedValue,
    node: null,
    registry
  });
  const clause = normalizeShortcutCompiledClause(compiled);
  if (!clause) {
    throw new Error(`is:default atom "${atom}" produced no query clause.`);
  }
  return unaryNegation ? negateShortcutClause(clause) : clause;
}
function compileIsDefaultShortcut({ definition, token, term, registry }) {
  const atoms = definition.tokenExpansions?.[token];
  if (!Array.isArray(atoms) || !atoms.length) {
    return null;
  }
  const clauses = atoms.map((atom) => compileShortcutAtomClause(atom, registry));
  return {
    __sqdsl_clause: {
      bool: {
        must: clauses
      }
    },
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: ["shortcut-expansion"],
      expandedAtoms: atoms
    }
  };
}
function compileCommanderSemanticShortcut(tokenConfig) {
  const legalityPath = tokenConfig?.legalityPath;
  const typePaths = Array.isArray(tokenConfig?.typePaths) ? tokenConfig.typePaths : [];
  const oraclePaths = Array.isArray(tokenConfig?.oraclePaths) ? tokenConfig.oraclePaths : [];
  const powerPath = tokenConfig?.powerPath;
  const toughnessPath = tokenConfig?.toughnessPath;
  const nestedContainers = Array.isArray(tokenConfig?.nestedContainers) ? tokenConfig.nestedContainers : [];
  if (typeof legalityPath !== "string" || !legalityPath || !typePaths.length || !oraclePaths.length || typeof powerPath !== "string" || !powerPath || typeof toughnessPath !== "string" || !toughnessPath) {
    throw new Error('Semantic shortcut "is:commander" is missing required path configuration.');
  }
  function wrapPathIfNested(path, clause) {
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  }
  const legendaryClause = {
    bool: {
      should: typePaths.map(
        (path) => wrapPathIfNested(path, createMatchClause(path, "legendary", { operator: "and" }))
      ),
      minimum_should_match: 1
    }
  };
  const artifactOrCreatureClause = {
    bool: {
      should: [
        ...typePaths.map(
          (path) => wrapPathIfNested(path, createMatchClause(path, "artifact", { operator: "and" }))
        ),
        ...typePaths.map(
          (path) => wrapPathIfNested(path, createMatchClause(path, "creature", { operator: "and" }))
        )
      ],
      minimum_should_match: 1
    }
  };
  const textExceptionClause = {
    bool: {
      should: oraclePaths.map(
        (path) => wrapPathIfNested(path, { match_phrase: { [path]: "can be your commander" } })
      ),
      minimum_should_match: 1
    }
  };
  return {
    bool: {
      should: [
        {
          bool: {
            must: [
              {
                term: {
                  [legalityPath]: "legal"
                }
              },
              legendaryClause,
              artifactOrCreatureClause,
              // Planeswalker commanders lack P/T; they are covered by textExceptionClause below.
              { exists: { field: powerPath } },
              { exists: { field: toughnessPath } }
            ]
          }
        },
        textExceptionClause
      ],
      minimum_should_match: 1
    }
  };
}
function compileBooleanSemanticShortcut(tokenConfig, { definition, token, term }) {
  const field = tokenConfig?.field;
  if (typeof field !== "string" || !field) {
    throw new Error(`Semantic shortcut "is:${token}" is missing required field configuration.`);
  }
  return {
    __sqdsl_clause: { term: { [field]: true } },
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: [field],
      semanticKind: "boolean"
    }
  };
}
function compileTermDisjunctionSemanticShortcut(tokenConfig, { definition, token, term }) {
  const field = tokenConfig?.field;
  const values = tokenConfig?.values;
  if (typeof field !== "string" || !field) {
    throw new Error(`Semantic shortcut "is:${token}" is missing required field configuration.`);
  }
  if (!Array.isArray(values) || !values.length) {
    throw new Error(`Semantic shortcut "is:${token}" is missing required values configuration.`);
  }
  const clauses = values.map((value) => ({ term: { [field]: value } }));
  const clause = clauses.length === 1 ? clauses[0] : { bool: { should: clauses, minimum_should_match: 1 } };
  return {
    __sqdsl_clause: clause,
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: [field],
      semanticKind: "term-disjunction"
    }
  };
}
function compileTypeLineDisjunctionSemanticShortcut(tokenConfig, { definition, token, term }) {
  const typePaths = Array.isArray(tokenConfig?.typePaths) ? tokenConfig.typePaths : [];
  const nestedContainers = Array.isArray(tokenConfig?.nestedContainers) ? tokenConfig.nestedContainers : [];
  const values = Array.isArray(tokenConfig?.values) ? tokenConfig.values : [];
  if (!typePaths.length) {
    throw new Error(`Semantic shortcut "is:${token}" is missing required typePaths configuration.`);
  }
  if (!values.length) {
    throw new Error(`Semantic shortcut "is:${token}" is missing required values configuration.`);
  }
  function wrapPathIfNested(path, clause2) {
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause2) : clause2;
  }
  const clauses = [];
  for (const path of typePaths) {
    for (const value of values) {
      clauses.push(wrapPathIfNested(path, createMatchClause(path, value, { operator: "and" })));
    }
  }
  const clause = clauses.length === 1 ? clauses[0] : {
    bool: {
      should: clauses,
      minimum_should_match: 1
    }
  };
  return {
    __sqdsl_clause: clause,
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: typePaths,
      semanticKind: "type-line-disjunction"
    }
  };
}
function compileIsSemanticShortcut({ definition, token, term }) {
  const semanticConfig = definition.semanticShortcuts?.[token];
  if (!semanticConfig) {
    return null;
  }
  if (semanticConfig.kind === "commander") {
    return {
      __sqdsl_clause: compileCommanderSemanticShortcut(semanticConfig),
      __sqdsl_meta: {
        type: "shortcut-term",
        field: definition.name,
        token,
        term,
        valid: true,
        matchedFields: ["semantic-shortcut"],
        semanticKind: semanticConfig.kind
      }
    };
  }
  if (semanticConfig.kind === "boolean") {
    return compileBooleanSemanticShortcut(semanticConfig, { definition, token, term });
  }
  if (semanticConfig.kind === "term-disjunction") {
    return compileTermDisjunctionSemanticShortcut(semanticConfig, { definition, token, term });
  }
  if (semanticConfig.kind === "type-line-disjunction") {
    return compileTypeLineDisjunctionSemanticShortcut(semanticConfig, { definition, token, term });
  }
  throw new Error(`Unsupported semantic shortcut kind "${semanticConfig.kind}" for token "${token}".`);
}
function compileIsShortcutField({ fieldName, definition, value, node, registry }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, node?.operator ?? ":");
  const token = String(value).toLowerCase();
  const mappedFields = definition.tokenFieldMap?.[token] ?? [];
  const term = `${definition.name}:${token}`;
  const semanticShortcut = compileIsSemanticShortcut({
    definition,
    token,
    term
  });
  if (semanticShortcut) {
    return semanticShortcut;
  }
  const expansion = compileIsDefaultShortcut({
    definition,
    token,
    term,
    registry
  });
  if (expansion) {
    return expansion;
  }
  if (!mappedFields.length) {
    return {
      __sqdsl_clause: null,
      __sqdsl_meta: {
        type: "shortcut-term",
        field: definition.name,
        token,
        term,
        valid: false
      }
    };
  }
  const shouldClauses = mappedFields.map((fieldPath) => ({
    term: {
      [fieldPath]: token
    }
  }));
  const clause = shouldClauses.length === 1 ? shouldClauses[0] : {
    bool: {
      should: shouldClauses,
      minimum_should_match: 1
    }
  };
  return {
    __sqdsl_clause: clause,
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: mappedFields
    }
  };
}
function compileNotShortcutField({ fieldName, definition, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, node?.operator ?? ":");
  const token = String(value).toLowerCase();
  const mappedFields = definition.tokenFieldMap?.[token] ?? [];
  const term = `${definition.name}:${token}`;
  const semanticShortcut = compileIsSemanticShortcut({
    definition,
    token,
    term
  });
  if (semanticShortcut) {
    return {
      ...semanticShortcut,
      __sqdsl_clause: negateShortcutClause(semanticShortcut.__sqdsl_clause)
    };
  }
  if (!mappedFields.length) {
    return {
      __sqdsl_clause: null,
      __sqdsl_meta: {
        type: "shortcut-term",
        field: definition.name,
        token,
        term,
        valid: false
      }
    };
  }
  return {
    __sqdsl_clause: {
      bool: {
        must_not: mappedFields.map((fieldPath) => ({
          term: {
            [fieldPath]: token
          }
        }))
      }
    },
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: mappedFields
    }
  };
}
function createFieldSort(field, direction, options = {}) {
  return {
    [field]: {
      order: direction,
      ...options
    }
  };
}
function createScriptSort(source, params, direction = "asc") {
  return {
    _script: {
      type: "number",
      order: direction,
      script: {
        lang: "painless",
        source,
        params
      }
    }
  };
}
function createDefaultPrintingSorts(fields = {}) {
  const {
    fullArt = "full_art",
    promoTypes = "promo_types",
    frameEffects = "frame_effects",
    setType = "set_type",
    frame = "frame",
    finishes = "finishes",
    borderColor = "border_color",
    releasedAt = "released_at",
    collectorNumber = "collector_number"
  } = fields;
  return [
    createFieldSort(fullArt, "asc", { unmapped_type: "boolean" }),
    createFieldSort(promoTypes, "asc", { unmapped_type: "keyword", missing: "_first" }),
    createFieldSort(frameEffects, "asc", { unmapped_type: "keyword", missing: "_first" }),
    createFieldSort(setType, "asc", { unmapped_type: "keyword" }),
    createFieldSort(frame, "asc", { unmapped_type: "keyword" }),
    createFieldSort(finishes, "desc", { unmapped_type: "keyword" }),
    createFieldSort(borderColor, "desc", { unmapped_type: "keyword" }),
    createFieldSort(releasedAt, "desc", { unmapped_type: "keyword" }),
    createFieldSort(collectorNumber, "desc", { unmapped_type: "keyword" })
  ];
}
function compileOrderedKeywordField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value
      }
    };
  }
  if (operator === "!=") {
    return negateCompiledClause({
      term: {
        [definition.esPath]: value
      }
    });
  }
  const orderedValues = definition.order ?? [];
  const valueIndex = orderedValues.indexOf(value);
  if (valueIndex < 0) {
    throw new Error(`Unknown ordered value "${value}" for field "${fieldName}".`);
  }
  if (operator === ">") {
    return compileKeywordDisjunction(definition.esPath, orderedValues.slice(valueIndex + 1));
  }
  if (operator === ">=") {
    return compileKeywordDisjunction(definition.esPath, orderedValues.slice(valueIndex));
  }
  if (operator === "<") {
    return compileKeywordDisjunction(definition.esPath, orderedValues.slice(0, valueIndex));
  }
  if (operator === "<=") {
    return compileKeywordDisjunction(definition.esPath, orderedValues.slice(0, valueIndex + 1));
  }
  throw new Error(`Unsupported operator "${operator}" for field "${fieldName}".`);
}
function compileCollectorNumberField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value
      }
    };
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new Error(`Collector number comparisons require a numeric value. Received "${value}".`);
  }
  if (operator === "!=") {
    return {
      script: {
        script: {
          lang: "painless",
          source: [
            `if (doc['${definition.esPath}'].size() == 0) return false;`,
            `String collectorNumber = doc['${definition.esPath}'].value;`,
            "if (!/^[0-9]+$/.matcher(collectorNumber).matches()) return false;",
            "return Integer.parseInt(collectorNumber) != params.value;"
          ].join(" "),
          params: {
            value: numericValue
          }
        }
      }
    };
  }
  return {
    script: {
      script: {
        lang: "painless",
        source: [
          `if (doc['${definition.esPath}'].size() == 0) return false;`,
          `String collectorNumber = doc['${definition.esPath}'].value;`,
          "if (!/^[0-9]+$/.matcher(collectorNumber).matches()) return false;",
          `return Integer.parseInt(collectorNumber) ${operator} params.value;`
        ].join(" "),
        params: {
          value: numericValue
        }
      }
    }
  };
}
function uniqueColors(colors) {
  return [...new Set(colors)].sort(
    (left, right) => ORDERED_COLORS.indexOf(left) - ORDERED_COLORS.indexOf(right)
  );
}
function enumerateColorSets() {
  const sets = [];
  const total = 2 ** ORDERED_COLORS.length;
  for (let mask = 0; mask < total; mask += 1) {
    const colors = [];
    for (let index = 0; index < ORDERED_COLORS.length; index += 1) {
      if (mask & 1 << index) {
        colors.push(ORDERED_COLORS[index]);
      }
    }
    sets.push(colors);
  }
  return sets;
}
function compileExactColorSet(esPath, colors) {
  const requiredColors = uniqueColors(colors);
  const excludedColors = ORDERED_COLORS.filter((color) => !requiredColors.includes(color));
  const bool = {};
  if (requiredColors.length) {
    bool.must = requiredColors.map((color) => ({
      term: {
        [esPath]: COLOR_SYMBOLS[color]
      }
    }));
  }
  if (excludedColors.length) {
    bool.must_not = excludedColors.map((color) => ({
      term: {
        [esPath]: COLOR_SYMBOLS[color]
      }
    }));
  }
  return { bool };
}
function compileColorSetDisjunction(esPath, colorSets) {
  if (!colorSets.length) {
    return { match_none: {} };
  }
  if (colorSets.length === 1) {
    return compileExactColorSet(esPath, colorSets[0]);
  }
  return {
    bool: {
      should: colorSets.map((colors) => compileExactColorSet(esPath, colors)),
      minimum_should_match: 1
    }
  };
}
function compileColorlessField(esPath) {
  return {
    bool: {
      must_not: [
        {
          exists: {
            field: esPath
          }
        }
      ]
    }
  };
}
function resolveColorPaths(definition) {
  if (Array.isArray(definition.esPaths) && definition.esPaths.length) {
    return definition.esPaths;
  }
  return [definition.esPath];
}
function resolveNestedPath(nestedContainers, esPath) {
  if (!Array.isArray(nestedContainers) || !nestedContainers.length) return null;
  const matches = nestedContainers.filter(
    (container) => esPath === container || esPath.startsWith(`${container}.`)
  );
  if (!matches.length) return null;
  return matches.reduce((best, candidate) => candidate.length > best.length ? candidate : best);
}
function wrapNested(nestedPath, clause) {
  return { nested: { path: nestedPath, query: clause, ignore_unmapped: true } };
}
function compileColorAcrossPaths(definition, builder) {
  const paths = resolveColorPaths(definition);
  const nestedContainers = definition.nestedContainers;
  const clauses = paths.map((path) => {
    const clause = builder(path);
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  });
  if (clauses.length === 1) {
    return clauses[0];
  }
  return {
    bool: {
      should: clauses,
      minimum_should_match: 1
    }
  };
}
function compileColorEqualityClause(definition, value) {
  if (value.kind === "multicolor") {
    return compileColorAcrossPaths(
      definition,
      (esPath) => compileColorSetDisjunction(
        esPath,
        enumerateColorSets().filter((colors) => colors.length >= 2)
      )
    );
  }
  const targetColors = value.colors;
  if (!targetColors.length) {
    const paths = resolveColorPaths(definition);
    if (paths.length === 1) {
      return compileColorlessField(paths[0]);
    }
    return {
      bool: {
        must: paths.map((esPath) => compileColorlessField(esPath))
      }
    };
  }
  return compileColorAcrossPaths(definition, (esPath) => compileExactColorSet(esPath, targetColors));
}
function parseColorValueToken(rawValue) {
  const normalized = String(rawValue).trim().toLowerCase();
  const aliasHit = COLOR_ALIASES[normalized];
  if (aliasHit) {
    if (aliasHit === "__multicolor__") {
      return { kind: "multicolor" };
    }
    return {
      kind: "set",
      colors: uniqueColors(aliasHit)
    };
  }
  if (/^[wubrg]+$/.test(normalized)) {
    return {
      kind: "set",
      colors: uniqueColors(
        normalized.split("").map((letter) => COLOR_ALIASES[letter][0])
      )
    };
  }
  throw new Error(`Unknown color expression "${rawValue}".`);
}
function parseColorExpression(rawValue) {
  return parseColorValueToken(rawValue);
}
function compileColorField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  if (operator === "!=") {
    return negateCompiledClause(compileColorEqualityClause(definition, value));
  }
  if (value.kind === "multicolor") {
    if (operator !== ":" && operator !== "=") {
      throw new Error(`Field "${fieldName}" does not support operator "${operator}" for multicolor.`);
    }
    return compileColorAcrossPaths(
      definition,
      (esPath) => compileColorSetDisjunction(
        esPath,
        enumerateColorSets().filter((colors) => colors.length >= 2)
      )
    );
  }
  const targetColors = value.colors;
  const allSets = enumerateColorSets();
  if (!targetColors.length) {
    if (operator === ":" || operator === "=" || operator === "<=") {
      return compileColorlessField(definition.esPath);
    }
    if (operator === "<") {
      return { match_none: {} };
    }
  }
  if (operator === "=") {
    return compileColorEqualityClause(definition, value);
  }
  const effectiveOperator = operator === ":" ? definition.colonMeansSubset ? "<=" : ">=" : operator;
  if (effectiveOperator === ">=") {
    return compileColorAcrossPaths(definition, (esPath) => ({
      bool: {
        must: targetColors.map((color) => ({
          term: {
            [esPath]: COLOR_SYMBOLS[color]
          }
        }))
      }
    }));
  }
  if (effectiveOperator === ">") {
    const extraColors = ORDERED_COLORS.filter((color) => !targetColors.includes(color));
    if (!extraColors.length) {
      return { match_none: {} };
    }
    return compileColorAcrossPaths(definition, (esPath) => ({
      bool: {
        must: targetColors.map((color) => ({
          term: {
            [esPath]: COLOR_SYMBOLS[color]
          }
        })),
        should: extraColors.map((color) => ({
          term: {
            [esPath]: COLOR_SYMBOLS[color]
          }
        })),
        minimum_should_match: 1
      }
    }));
  }
  if (effectiveOperator === "<=") {
    return compileColorAcrossPaths(
      definition,
      (esPath) => compileColorSetDisjunction(
        esPath,
        allSets.filter((colors) => colors.every((color) => targetColors.includes(color)))
      )
    );
  }
  if (effectiveOperator === "<") {
    const paths = resolveColorPaths(definition);
    const nestedContainers = definition.nestedContainers;
    const clauses = paths.map((esPath) => {
      const mustNotHaveAll = [
        {
          bool: {
            must: targetColors.map((color) => ({
              term: { [esPath]: COLOR_SYMBOLS[color] }
            }))
          }
        }
      ];
      const nestedPath = resolveNestedPath(nestedContainers, esPath);
      if (nestedPath) {
        return wrapNested(nestedPath, { bool: { must_not: mustNotHaveAll } });
      }
      if (esPath === definition.esPath) {
        return { bool: { must_not: mustNotHaveAll } };
      }
      return { bool: { must: [{ exists: { field: esPath } }], must_not: mustNotHaveAll } };
    });
    if (clauses.length === 1) return clauses[0];
    return { bool: { should: clauses, minimum_should_match: 1 } };
  }
  throw new Error(`Unsupported operator "${effectiveOperator}" for field "${fieldName}".`);
}

// src/compiler/control-config.js
function assertPrefix(prefix) {
  if (typeof prefix !== "string" || !prefix.trim()) {
    throw new Error("Control-config prefix must be a non-empty string.");
  }
}
function prefixPath(path, prefix) {
  return `${prefix}.${path}`;
}
var DEFAULT_CONTROL_CONFIG = {
  collapseFields: {
    cards: "oracle_id",
    art: "illustration_id"
  },
  orderFields: {
    cmc: "cmc",
    power: "power_num",
    toughness: "toughness_num",
    set: "set",
    name: "name.keyword",
    usd: "prices.usd",
    eur: "prices.eur",
    tix: "prices.tix",
    edhrec: "edhrec_rank",
    released: "released_at"
  },
  orderScriptFields: {
    rarity: "rarity",
    colors: "colors"
  },
  langField: "lang",
  prefer: {
    defaultPrintingSortFields: {
      fullArt: "full_art",
      promoTypes: "promo_types",
      frameEffects: "frame_effects",
      setType: "set_type",
      frame: "frame",
      finishes: "finishes",
      borderColor: "border_color",
      releasedAt: "released_at",
      collectorNumber: "collector_number"
    },
    oldestFields: {
      releasedAt: "released_at",
      collectorNumber: "collector_number"
    },
    newestFields: {
      releasedAt: "released_at",
      collectorNumber: "collector_number"
    },
    usdField: "prices.usd",
    promoField: "promo",
    universesBeyondField: "universes_beyond",
    atypicalFields: {
      promo: "promo",
      frameEffect: "frame_effect",
      fullArt: "full_art",
      oversized: "oversized"
    }
  }
};
function createPrefixedControlConfig(prefix, baseConfig = DEFAULT_CONTROL_CONFIG) {
  assertPrefix(prefix);
  return {
    collapseFields: {
      cards: prefixPath(baseConfig.collapseFields.cards, prefix),
      art: prefixPath(baseConfig.collapseFields.art, prefix)
    },
    orderFields: {
      cmc: prefixPath(baseConfig.orderFields.cmc, prefix),
      power: prefixPath(baseConfig.orderFields.power, prefix),
      toughness: prefixPath(baseConfig.orderFields.toughness, prefix),
      set: prefixPath(baseConfig.orderFields.set, prefix),
      name: prefixPath(baseConfig.orderFields.name, prefix),
      usd: prefixPath(baseConfig.orderFields.usd, prefix),
      eur: prefixPath(baseConfig.orderFields.eur, prefix),
      tix: prefixPath(baseConfig.orderFields.tix, prefix),
      edhrec: prefixPath(baseConfig.orderFields.edhrec, prefix),
      released: prefixPath(baseConfig.orderFields.released, prefix)
    },
    orderScriptFields: {
      rarity: prefixPath(baseConfig.orderScriptFields.rarity, prefix),
      colors: prefixPath(baseConfig.orderScriptFields.colors, prefix)
    },
    langField: prefixPath(baseConfig.langField, prefix),
    prefer: {
      defaultPrintingSortFields: {
        fullArt: prefixPath(baseConfig.prefer.defaultPrintingSortFields.fullArt, prefix),
        promoTypes: prefixPath(baseConfig.prefer.defaultPrintingSortFields.promoTypes, prefix),
        frameEffects: prefixPath(baseConfig.prefer.defaultPrintingSortFields.frameEffects, prefix),
        setType: prefixPath(baseConfig.prefer.defaultPrintingSortFields.setType, prefix),
        frame: prefixPath(baseConfig.prefer.defaultPrintingSortFields.frame, prefix),
        finishes: prefixPath(baseConfig.prefer.defaultPrintingSortFields.finishes, prefix),
        borderColor: prefixPath(baseConfig.prefer.defaultPrintingSortFields.borderColor, prefix),
        releasedAt: prefixPath(baseConfig.prefer.defaultPrintingSortFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.defaultPrintingSortFields.collectorNumber, prefix)
      },
      oldestFields: {
        releasedAt: prefixPath(baseConfig.prefer.oldestFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.oldestFields.collectorNumber, prefix)
      },
      newestFields: {
        releasedAt: prefixPath(baseConfig.prefer.newestFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.newestFields.collectorNumber, prefix)
      },
      usdField: prefixPath(baseConfig.prefer.usdField, prefix),
      promoField: prefixPath(baseConfig.prefer.promoField, prefix),
      universesBeyondField: prefixPath(baseConfig.prefer.universesBeyondField, prefix),
      atypicalFields: {
        promo: prefixPath(baseConfig.prefer.atypicalFields.promo, prefix),
        frameEffect: prefixPath(baseConfig.prefer.atypicalFields.frameEffect, prefix),
        fullArt: prefixPath(baseConfig.prefer.atypicalFields.fullArt, prefix),
        oversized: prefixPath(baseConfig.prefer.atypicalFields.oversized, prefix)
      }
    }
  };
}

// src/compiler/index.js
var RARITY_RANKS = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
  special: 4,
  bonus: 5
};
function normalizeCompiledClause(clause) {
  if (!clause) {
    throw new Error("Compiler produced an empty Elasticsearch clause.");
  }
  if (Object.prototype.hasOwnProperty.call(clause, "__sqdsl_clause")) {
    return {
      clause: clause.__sqdsl_clause ?? null,
      controls: [],
      meta: clause.__sqdsl_meta ? [clause.__sqdsl_meta] : []
    };
  }
  if (clause.control) {
    return {
      clause: null,
      controls: [clause.control],
      meta: []
    };
  }
  return {
    clause,
    controls: [],
    meta: []
  };
}
function negateClause(clause) {
  return {
    bool: {
      must_not: [clause]
    }
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
    meta.push(...result.meta ?? []);
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
    [boolKey]: clauses
  };
  if (boolKey === "should") {
    bool.minimum_should_match = 1;
  }
  return {
    clause: { bool },
    controls,
    meta
  };
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
        unmapped_type: "double"
      })
    ];
  }
  if (order === "toughness") {
    return [
      createFieldSort(resolveControlPath(orderFields.toughness, "orderFields.toughness"), normalizedDirection, {
        unmapped_type: "double"
      })
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
        unmapped_type: "double"
      })
    ];
  }
  if (order === "edhrec") {
    return [
      createFieldSort(resolveControlPath(orderFields.edhrec, "orderFields.edhrec"), normalizedDirection, {
        unmapped_type: "long"
      })
    ];
  }
  if (order === "released") {
    return [
      createFieldSort(resolveControlPath(orderFields.released, "orderFields.released"), normalizedDirection, {
        unmapped_type: "keyword"
      })
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
          ranks: RARITY_RANKS
        },
        normalizedDirection
      )
    ];
  }
  if (order === "color") {
    return [
      createScriptSort(
        `
          return doc.containsKey(params.field) && !doc[params.field].empty ? doc[params.field].size() : 0;
        `,
        {
          field: resolveControlPath(orderScriptFields.colors, "orderScriptFields.colors")
        },
        normalizedDirection
      )
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
        unmapped_type: "keyword"
      }),
      createFieldSort(resolveControlPath(oldestFields.collectorNumber, "prefer.oldestFields.collectorNumber"), "asc", {
        unmapped_type: "keyword"
      })
    ];
  }
  if (prefer === "newest") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword"
      }),
      createFieldSort(resolveControlPath(newestFields.collectorNumber, "prefer.newestFields.collectorNumber"), "desc", {
        unmapped_type: "keyword"
      })
    ];
  }
  if (prefer === "usd-low") {
    return [createFieldSort(resolveControlPath(preferConfig.usdField, "prefer.usdField"), "asc", { unmapped_type: "double" })];
  }
  if (prefer === "usd-high") {
    return [
      createFieldSort(resolveControlPath(preferConfig.usdField, "prefer.usdField"), "desc", { unmapped_type: "double" })
    ];
  }
  if (prefer === "promo") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.promoField, "prefer.promoField"), "desc", {
        unmapped_type: "boolean"
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword"
      })
    ];
  }
  if (prefer === "ub") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.universesBeyondField, "prefer.universesBeyondField"), "desc", {
        unmapped_type: "boolean"
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword"
      })
    ];
  }
  if (prefer === "notub") {
    const newestFields = preferConfig.newestFields ?? {};
    return [
      createFieldSort(resolveControlPath(preferConfig.universesBeyondField, "prefer.universesBeyondField"), "asc", {
        unmapped_type: "boolean"
      }),
      createFieldSort(resolveControlPath(newestFields.releasedAt, "prefer.newestFields.releasedAt"), "desc", {
        unmapped_type: "keyword"
      })
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
          oversizedField: resolveControlPath(atypicalFields.oversized, "prefer.atypicalFields.oversized")
        },
        "desc"
      )
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
        lang
      },
      "asc"
    )
  ];
}
function applySearchControls(controls, controlConfig) {
  const state = {
    unique: null,
    order: null,
    prefer: null,
    direction: "asc",
    lang: null
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
      field: resolveControlPath(collapseFields.cards, "collapseFields.cards")
    };
  } else if (state.unique === "art") {
    request.collapse = {
      field: resolveControlPath(collapseFields.art, "collapseFields.art")
    };
  }
  if (request.collapse?.field) {
    request.aggs = {
      collapsed_total: {
        cardinality: {
          field: request.collapse.field
        }
      }
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
  } else if (state.unique === "prints") {
    sort.push(...buildOrderSorts("released", state.direction, controlConfig));
  }
  if (state.prefer) {
    sort.push(...buildPreferSorts(state.prefer, controlConfig));
  }
  if (sort.length) {
    request.sort = sort;
  }
  return request;
}
function createCompiler({ registry, controlConfig = DEFAULT_CONTROL_CONFIG }) {
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
        registry
      })
    );
    if (compiled.controls.length && node.negated) {
      throw new Error(`Search directive "${node.field}" cannot be negated.`);
    }
    return {
      clause: node.negated && compiled.clause ? negateClause(compiled.clause) : compiled.clause,
      controls: compiled.controls,
      meta: compiled.meta
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
          meta: compiled.meta
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
      const dsl = hasControls ? {
        query,
        ...controls
      } : query;
      const shortcutTerms = (compiled.meta ?? []).filter((entry) => entry?.type === "shortcut-term");
      const validTerms = [...new Set(shortcutTerms.filter((entry) => entry.valid).map((entry) => entry.term))];
      const invalidTerms = [...new Set(shortcutTerms.filter((entry) => !entry.valid).map((entry) => entry.term))];
      const warnings = shortcutTerms.filter((entry) => !entry.valid).map((entry) => ({
        code: "UNKNOWN_IS_NOT_TOKEN",
        field: entry.field,
        token: entry.token,
        term: entry.term
      }));
      return {
        dsl,
        meta: {
          terms: {
            valid: validTerms,
            invalid: invalidTerms
          },
          warnings
        }
      };
    }
  };
}

// src/ast/index.js
function createTermNode({ field, operator, value, negated = false, ...meta }) {
  return {
    type: "term",
    field,
    operator,
    value,
    negated,
    ...meta
  };
}
function createBooleanNode(operator, clauses) {
  return {
    type: "boolean",
    operator,
    clauses
  };
}
function createGroupNode(clause, negated = false) {
  return {
    type: "group",
    clause,
    negated
  };
}

// src/parser/index.js
var OPERATOR_PATTERN = /^(!=|>=|<=|:|=|>|<)$/;
var FIELD_TERM_PATTERN = /^([^:><=!]+)(!=|>=|<=|:|=|>|<)(.+)$/;
function isWhitespace(character) {
  return /\s/.test(character);
}
function isBoundaryCharacter(character) {
  return character === void 0 || isWhitespace(character) || character === "(" || character === ")";
}
function tokenize(query) {
  const tokens = [];
  let index = 0;
  while (index < query.length) {
    const character = query[index];
    if (isWhitespace(character)) {
      index += 1;
      continue;
    }
    if (character === "(" || character === ")") {
      tokens.push({ type: character });
      index += 1;
      continue;
    }
    if (character === "-") {
      tokens.push({ type: "NOT" });
      index += 1;
      continue;
    }
    let end = index;
    let inQuotes = false;
    let escaping = false;
    while (end < query.length) {
      const current = query[end];
      if (escaping) {
        escaping = false;
        end += 1;
        continue;
      }
      if (current === "\\") {
        escaping = true;
        end += 1;
        continue;
      }
      if (current === '"') {
        inQuotes = !inQuotes;
        end += 1;
        continue;
      }
      if (!inQuotes && (isWhitespace(current) || current === "(" || current === ")")) {
        break;
      }
      end += 1;
    }
    if (inQuotes) {
      throw new Error(`Unterminated quoted string starting at position ${index + 1}.`);
    }
    const raw = query.slice(index, end);
    const lowered = raw.toLowerCase();
    if ((lowered === "or" || lowered === "and") && isBoundaryCharacter(query[end])) {
      tokens.push({ type: lowered.toUpperCase() });
    } else {
      tokens.push({ type: "TERM", value: raw });
    }
    index = end;
  }
  return tokens;
}
function unescapeQuotedValue(value) {
  let result = "";
  let escaping = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaping) {
      result += character;
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    result += character;
  }
  if (escaping) {
    result += "\\";
  }
  return result;
}
function parseExactNameBangTerm(rawTerm) {
  const rawValue = rawTerm.slice(1);
  if (!rawValue.length) {
    throw new Error('Exact-name bang term is missing a value. Use !fire or !"sift through sands".');
  }
  const isQuoted = rawValue.startsWith('"') && rawValue.endsWith('"');
  if (!isQuoted && FIELD_TERM_PATTERN.test(rawValue)) {
    throw new Error(
      `Fielded bang term "${rawTerm}" is not supported. Use bare exact-name bang syntax like !fire or !"sift through sands".`
    );
  }
  const normalizedValue = isQuoted ? unescapeQuotedValue(rawValue.slice(1, -1)) : rawValue;
  if (!normalizedValue.length) {
    throw new Error(`Exact-name bang term "${rawTerm}" resolves to an empty value.`);
  }
  return {
    field: "name",
    operator: ":",
    value: normalizedValue,
    implicit: true,
    exactNameBang: true,
    ...isQuoted ? { quoted: true } : {}
  };
}
function parseRawTerm(rawTerm) {
  if (rawTerm.startsWith("!")) {
    return parseExactNameBangTerm(rawTerm);
  }
  const match = rawTerm.match(FIELD_TERM_PATTERN);
  if (!match) {
    const isQuoted2 = rawTerm.startsWith('"') && rawTerm.endsWith('"');
    return {
      field: "name",
      operator: ":",
      value: isQuoted2 ? unescapeQuotedValue(rawTerm.slice(1, -1)) : rawTerm,
      implicit: true,
      ...isQuoted2 ? { quoted: true } : {}
    };
  }
  const [, field, operator, value] = match;
  if (!OPERATOR_PATTERN.test(operator)) {
    throw new Error(`Unsupported operator "${operator}" in term "${rawTerm}".`);
  }
  if (!value.length) {
    throw new Error(`Missing value in term "${rawTerm}".`);
  }
  const isQuoted = value.startsWith('"') && value.endsWith('"');
  const normalizedValue = isQuoted ? unescapeQuotedValue(value.slice(1, -1)) : value;
  return {
    field,
    operator,
    value: normalizedValue,
    ...isQuoted ? { quoted: true } : {}
  };
}
function createParser() {
  return {
    parse(query) {
      if (typeof query !== "string" || !query.trim()) {
        throw new Error("Query must be a non-empty string.");
      }
      const tokens = tokenize(query);
      let position = 0;
      function peek() {
        return tokens[position];
      }
      function consume(expectedType) {
        const token = tokens[position];
        if (!token || token.type !== expectedType) {
          throw new Error(`Expected token "${expectedType}" but found "${token?.type ?? "EOF"}".`);
        }
        position += 1;
        return token;
      }
      function parsePrimary() {
        const token = peek();
        if (!token) {
          throw new Error("Unexpected end of query.");
        }
        if (token.type === "TERM") {
          position += 1;
          return createTermNode(parseRawTerm(token.value));
        }
        if (token.type === "(") {
          consume("(");
          const clause = parseOrExpression();
          consume(")");
          return createGroupNode(clause);
        }
        throw new Error(`Unexpected token "${token.type}".`);
      }
      function parseUnary() {
        const token = peek();
        if (token?.type === "NOT") {
          consume("NOT");
          const clause = parseUnary();
          if (clause.type === "term") {
            return createTermNode({ ...clause, negated: !clause.negated });
          }
          return createGroupNode(clause, true);
        }
        return parsePrimary();
      }
      function parseAndExpression() {
        const clauses = [parseUnary()];
        while (true) {
          const token = peek();
          if (!token || token.type === ")" || token.type === "OR") {
            break;
          }
          if (token.type === "AND") {
            consume("AND");
          }
          clauses.push(parseUnary());
        }
        if (clauses.length === 1) {
          return clauses[0];
        }
        return createBooleanNode("and", clauses);
      }
      function parseOrExpression() {
        const clauses = [parseAndExpression()];
        while (peek()?.type === "OR") {
          consume("OR");
          clauses.push(parseAndExpression());
        }
        if (clauses.length === 1) {
          return clauses[0];
        }
        return createBooleanNode("or", clauses);
      }
      const ast = parseOrExpression();
      if (position < tokens.length) {
        throw new Error(`Unexpected token "${tokens[position].type}" at the end of the query.`);
      }
      return ast;
    }
  };
}

// src/fields/is-not-token-index.js
var IS_NOT_SOURCE_VALUES = {
  frame_effects: [
    "inverted",
    "extendedart",
    "showcase",
    "enchantment",
    "etched",
    "sunmoondfc",
    "devoid",
    "tombstone",
    "fullart",
    "snow",
    "lesson",
    "companion",
    "colorshifted",
    "compasslanddfc",
    "fandfc",
    "miracle",
    "mooneldrazidfc",
    "convertdfc",
    "originpwdfc",
    "draft",
    "spree",
    "shatteredglass",
    "translucent",
    "upsidedowndfc",
    "waxingandwaningmoondfc"
  ],
  promo_types: [
    "boosterfun",
    "universesbeyond",
    "datestamped",
    "prerelease",
    "stamped",
    "promopack",
    "setpromo",
    "surgefoil",
    "mediainsert",
    "playtest",
    "sldbonus",
    "alchemy",
    "galaxyfoil",
    "silverfoil",
    "poster",
    "scroll",
    "ripplefoil",
    "instore",
    "tourney",
    "serialized",
    "startercollection",
    "doublerainbow",
    "boxtopper",
    "fnm",
    "ffvii",
    "ffxiv",
    "planeswalkerdeck",
    "rebalanced",
    "sourcematerial",
    "starterdeck",
    "rainbowfoil",
    "judgegift",
    "ffx",
    "ffvi",
    "halofoil",
    "firstplacefoil",
    "beginnerbox",
    "japanshowcase",
    "buyabox",
    "embossed",
    "textured",
    "bundle",
    "thick",
    "playerrewards",
    "arenaleague",
    "gameday",
    "wizardsplaynetwork",
    "stepandcompleat",
    "jpwalker",
    "release",
    "ffix",
    "portrait",
    "raisedfoil",
    "convention",
    "dossier",
    "schinesealtart",
    "fracturefoil",
    "manafoil",
    "ffviii",
    "storechampionship",
    "ffxv",
    "premiereshop",
    "gilded",
    "resale",
    "event",
    "ffxiii",
    "ffxvi",
    "intropack",
    "confettifoil",
    "ffiv",
    "vault",
    "standardshowdown",
    "themepack",
    "magnified",
    "imagine",
    "neonink",
    "plastic",
    "ffi",
    "ffxii",
    "ffv",
    "ravnicacity",
    "chocobotrackfoil",
    "ffiii",
    "oilslick",
    "brawldeck",
    "doubleexposure",
    "ffii",
    "ffxi",
    "godzillaseries",
    "draculaseries",
    "league",
    "concept",
    "giftbox",
    "commanderparty",
    "playpromo",
    "duels",
    "invisibleink",
    "headliner",
    "openhouse",
    "draftweekend",
    "setextension",
    "glossy",
    "bringafriend",
    "metal",
    "dragonscalefoil",
    "moonlitland",
    "upsidedown",
    "commanderpromo",
    "cosmicfoil",
    "singularityfoil",
    "upsidedownback"
  ],
  set_type: [
    "expansion",
    "masters",
    "commander",
    "core",
    "draft_innovation",
    "memorabilia",
    "box",
    "token",
    "funny",
    "duel_deck",
    "masterpiece",
    "starter",
    "planechase",
    "eternal",
    "treasure_chest",
    "archenemy",
    "from_the_vault",
    "vanguard",
    "premium_deck",
    "minigame",
    "arsenal",
    "spellbook"
  ],
  rarity: ["rare", "common", "uncommon", "mythic", "special", "bonus"],
  layout: [
    "normal",
    "token",
    "art_series",
    "transform",
    "adventure",
    "saga",
    "split",
    "planar",
    "modal_dfc",
    "mutate",
    "emblem",
    "vanguard",
    "double_faced_token",
    "scheme",
    "reversible_card",
    "meld",
    "class",
    "leveler",
    "prototype",
    "flip",
    "host",
    "case",
    "augment"
  ],
  image_status: ["highres_scan", "lowres", "placeholder", "missing"],
  finishes: ["nonfoil", "foil", "etched"],
  "all_parts.component": ["combo_piece", "token", "meld_part", "meld_result"]
};
var IS_DEFAULT_ATOMS = [
  "not:showcase",
  "not:extendedart",
  "-border:borderless",
  "not:fracturefoil",
  "not:etched",
  "not:stamped",
  "not:datestamped",
  "not:fullart",
  "not:surgefoil",
  "not:galaxyfoil",
  "-st:masterpiece",
  "-frame:future",
  "-frame:colorshifted",
  "not:playtest",
  "-frame:inverted",
  "-border:yellow"
];
function createIsNotTokenFieldMap() {
  const tokenFieldMap = {};
  for (const [fieldPath, values] of Object.entries(IS_NOT_SOURCE_VALUES)) {
    for (const value of values) {
      if (!tokenFieldMap[value]) {
        tokenFieldMap[value] = [];
      }
      tokenFieldMap[value].push(fieldPath);
    }
  }
  return tokenFieldMap;
}

// src/fields/defaults.js
function parseNumberValue(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new Error(`Cannot coerce "${value}" into a numeric value.`);
  }
  return numericValue;
}
function normalizeKeywordValue(value) {
  return String(value).trim().toLowerCase();
}
function parseNonEmptyKeywordValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (!normalized.length) {
    throw new Error("Value must be a non-empty string.");
  }
  return normalized;
}
function parseDateValue(value) {
  const normalized = String(value).trim();
  const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = normalized.match(datePattern);
  if (!match) {
    throw new Error(`Invalid date value "${value}". Expected YYYY-MM-DD.`);
  }
  const [, year, month, day] = match;
  const parsedDate = /* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.getUTCFullYear() !== Number(year) || parsedDate.getUTCMonth() + 1 !== Number(month) || parsedDate.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid date value "${value}". Expected a real calendar date in YYYY-MM-DD format.`);
  }
  return normalized;
}
function parseYearValue(value) {
  const normalized = String(value).trim();
  if (!/^\d{4}$/.test(normalized)) {
    throw new Error(`Invalid year value "${value}". Expected a 4-digit year.`);
  }
  return Number(normalized);
}
var RARITY_ORDER = ["common", "uncommon", "rare", "mythic", "special", "bonus"];
var RARITY_ALIASES = {
  c: "common",
  common: "common",
  u: "uncommon",
  uncommon: "uncommon",
  r: "rare",
  rare: "rare",
  m: "mythic",
  mythic: "mythic",
  s: "special",
  special: "special",
  b: "bonus",
  bonus: "bonus"
};
function parseRarityValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (Object.prototype.hasOwnProperty.call(RARITY_ALIASES, normalized)) {
    return RARITY_ALIASES[normalized];
  }
  throw new Error(`Unknown rarity expression "${value}".`);
}
var ORDER_VALUES = /* @__PURE__ */ new Set([
  "cmc",
  "power",
  "toughness",
  "set",
  "name",
  "usd",
  "tix",
  "eur",
  "rarity",
  "color",
  "released",
  "edhrec"
]);
var UNIQUE_ALIASES = {
  cards: "cards",
  card: "cards",
  prints: "prints",
  print: "prints",
  art: "art"
};
var PREFER_ALIASES = {
  oldest: "oldest",
  newest: "newest",
  "usd-low": "usd-low",
  "usd-high": "usd-high",
  promo: "promo",
  default: "default",
  atypical: "atypical",
  ub: "ub",
  universesbeyond: "ub",
  notub: "notub",
  notuniversesbeyond: "notub"
};
var DIRECTION_ALIASES = {
  asc: "asc",
  desc: "desc"
};
function parseOrderValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (!ORDER_VALUES.has(normalized)) {
    throw new Error(`Unknown order expression "${value}".`);
  }
  return normalized;
}
function parseUniqueValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (Object.prototype.hasOwnProperty.call(UNIQUE_ALIASES, normalized)) {
    return UNIQUE_ALIASES[normalized];
  }
  throw new Error(`Unknown unique expression "${value}".`);
}
function parsePreferValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (Object.prototype.hasOwnProperty.call(PREFER_ALIASES, normalized)) {
    return PREFER_ALIASES[normalized];
  }
  throw new Error(`Unknown prefer expression "${value}".`);
}
function parseDirectionValue(value) {
  const normalized = normalizeKeywordValue(value);
  if (Object.prototype.hasOwnProperty.call(DIRECTION_ALIASES, normalized)) {
    return DIRECTION_ALIASES[normalized];
  }
  throw new Error(`Unknown direction expression "${value}".`);
}
function parseShortcutValue(value) {
  return normalizeKeywordValue(value);
}
function createDefaultFieldDefinitions() {
  const isNotTokenFieldMap = createIsNotTokenFieldMap();
  return {
    colors: {
      aliases: ["c", "color"],
      esPath: "colors",
      esPaths: ["colors", "card_faces.colors"],
      nestedContainers: ["card_faces"],
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      description: "Filter by card color(s). Use color letters (W U B R G) or names (white blue black red green). Supports subset (:), exact (=), and comparison (> >= < <=) operators.",
      examples: ["c:red", "color=wu", "c>=boros", "c!=colorless", "-c:green"],
      parseValue: parseColorExpression,
      compile: compileColorField
    },
    color_identity: {
      aliases: ["id", "identity"],
      esPath: "color_identity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      // Scryfall parity: id:esper means "fits within esper" (<=), not "contains esper" (>=).
      colonMeansSubset: true,
      description: "Filter by color identity (commander deck colors). Uses same color syntax as colors. id:esper finds cards that fit within an Esper deck (identity \u2286 {W,U,B}). Useful for finding cards that fit within a commander's color identity.",
      examples: ["id:grixis", "identity=esper", "id<=bant", "id:c"],
      parseValue: parseColorExpression,
      compile: compileColorField
    },
    mana_value: {
      aliases: ["mv", "cmc"],
      esPath: "cmc",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by mana value (formerly converted mana cost). Supports all numeric comparison operators.",
      examples: ["mv=3", "cmc>=5", "mv<2", "mana_value!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by card properties. Supports many token values from Scryfall (frame effects, promo types, layouts, rarities) plus semantic shortcuts: is:commander (legal commander), is:spell (cards with major spell/permanent/battle type lines), is:promo (promotional printing), is:spotlight (story spotlight), is:digital (MTGO or Arena only), is:default (standard printing).",
      examples: ["is:commander", "is:spell", "is:promo", "is:digital", "is:foil", "is:showcase"],
      parseValue: parseShortcutValue,
      compile: compileIsShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
      tokenExpansions: {
        default: IS_DEFAULT_ATOMS
      },
      semanticShortcuts: {
        commander: {
          kind: "commander",
          legalityPath: "legalities.commander",
          typePaths: ["type_line", "card_faces.type_line"],
          oraclePaths: ["oracle_text", "card_faces.oracle_text"],
          powerPath: "power",
          toughnessPath: "toughness",
          nestedContainers: ["card_faces"]
        },
        spell: {
          kind: "type-line-disjunction",
          typePaths: ["type_line", "card_faces.type_line"],
          nestedContainers: ["card_faces"],
          values: ["creature", "artifact", "instant", "sorcery", "enchantment", "planeswalker", "battle"]
        },
        // is:promo — card is a promotional printing (promo: true boolean field).
        promo: {
          kind: "boolean",
          field: "promo"
        },
        // is:spotlight — card is a story spotlight (story_spotlight: true boolean field).
        spotlight: {
          kind: "boolean",
          field: "story_spotlight"
        },
        // is:digital — card exists only in digital form (MTGO or Arena game environment).
        // Equivalent to: in:mtgo or in:arena
        digital: {
          kind: "term-disjunction",
          field: "games",
          values: ["mtgo", "arena"]
        }
      }
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      operators: [":", "="],
      type: "keyword",
      description: "Exclude cards matching a property token. Uses the same token vocabulary as is: but negates the match, including semantic shortcuts such as not:spell.",
      examples: ["not:showcase", "not:extendedart", "not:spell"],
      parseValue: parseShortcutValue,
      compile: compileNotShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
      semanticShortcuts: {
        spell: {
          kind: "type-line-disjunction",
          typePaths: ["type_line", "card_faces.type_line"],
          nestedContainers: ["card_faces"],
          values: ["creature", "artifact", "instant", "sorcery", "enchantment", "planeswalker", "battle"]
        }
      }
    },
    unique: {
      aliases: ["unique"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Control result deduplication. cards: one result per unique oracle identity (default). prints: all individual printings. art: one result per unique artwork.",
      examples: ["unique:cards", "unique:prints", "unique:art"],
      parseValue: parseUniqueValue,
      compile: compileSearchUniqueField
    },
    order: {
      aliases: ["order"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Sort results by a field. Valid values: name, cmc, power, toughness, set, rarity, color, usd, eur, tix, edhrec, released.",
      examples: ["order:name", "order:cmc", "order:usd", "order:released"],
      parseValue: parseOrderValue,
      compile: compileSearchOrderField
    },
    prefer: {
      aliases: ["prefer"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Prefer a specific printing when deduplicating. Valid values: oldest, newest, usd-low, usd-high, promo, default, atypical, ub (Universes Beyond), notub.",
      examples: ["prefer:newest", "prefer:usd-low", "prefer:promo", "prefer:notub"],
      parseValue: parsePreferValue,
      compile: compileSearchPreferField
    },
    direction: {
      aliases: ["direction"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Control sort direction. Valid values: asc (ascending, default) or desc (descending).",
      examples: ["order:usd direction:desc", "order:cmc direction:asc"],
      parseValue: parseDirectionValue,
      compile: compileSearchDirectionField
    },
    lang: {
      aliases: ["language"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Prefer a language when selecting a printing. Uses ISO 639-1 language codes (en, de, fr, es, it, pt, ja, ko, ru, zhs, zht, he, la, grc, ar, sa, ph).",
      examples: ["lang:en", "language:ja", "lang:de"],
      parseValue: normalizeKeywordValue,
      compile: compileSearchLangField
    },
    rarity: {
      aliases: ["r"],
      esPath: "rarity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      description: "Filter by rarity. Ordered from lowest to highest: common < uncommon < rare < mythic < special < bonus. Supports comparison operators.",
      examples: ["rarity:rare", "r>=uncommon", "rarity<mythic", "r=common"],
      parseValue: parseRarityValue,
      compile: compileOrderedKeywordField,
      order: RARITY_ORDER
    },
    set: {
      esPath: "set",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by set code (3\u20135 letter code, lowercased). Use Scryfall set codes such as dmu, mh3, lea, m21.",
      examples: ["set:dmu", "set:mh3", "set:lea", "-set:m21"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField
    },
    // game / in — filter by game environment (paper, mtgo, arena, astral, sega).
    // Mirrors Scryfall's game: and in: syntax, both searching the games array field.
    game: {
      aliases: ["in"],
      esPath: "games",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by game environment. Valid values: paper, mtgo, arena, astral, sega. Use is:digital as a shorthand for in:mtgo or in:arena.",
      examples: ["game:paper", "in:mtgo", "game:arena", "-in:arena"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileKeywordField
    },
    legal: {
      aliases: ["f", "format"],
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards legal in a format. Common formats: standard, pioneer, modern, legacy, vintage, commander, pauper, brawl, historic.",
      examples: ["legal:commander", "f:modern", "format:standard", "legal:pauper"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "legal"
    },
    banned: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards that are banned in a format (legality status is 'banned', not merely absent from the format).",
      examples: ["banned:legacy", "banned:modern", "banned:commander"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "banned"
    },
    restricted: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards that are restricted in a format (limited to one copy). Currently only relevant to vintage.",
      examples: ["restricted:vintage"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "restricted"
    },
    date: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "date",
      description: "Filter by exact release date in YYYY-MM-DD format. Supports comparison operators. Note: != is not supported; use two comparisons instead.",
      examples: ["date=2024-02-09", "date>=2020-01-01", "date<2015-06-01"],
      parseValue: parseDateValue,
      compile: compileDateField
    },
    year: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by release year. Supports all numeric comparison operators. Note: != is not supported for year.",
      examples: ["year=2024", "year>=2020", "year<2015", "year:2019"],
      parseValue: parseYearValue,
      compile: compileYearField
    },
    set_type: {
      aliases: ["st"],
      esPath: "set_type",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by set type. Common values: expansion, masters, commander, core, draft_innovation, memorabilia, token, funny, duel_deck, masterpiece.",
      examples: ["set_type:expansion", "st:commander", "st:masters", "-st:memorabilia"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField
    },
    border_color: {
      aliases: ["border"],
      esPath: "border_color",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by border color. Valid values: black, white, borderless, silver, gold, yellow.",
      examples: ["border_color:borderless", "border:black", "-border:silver"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField
    },
    frame: {
      aliases: [],
      esPath: "frame",
      esPaths: ["frame", "frame_effects"],
      operators: [":", "="],
      type: "keyword",
      description: "Filter by frame style or frame effect. Frame styles: 1993, 1997, 2003, 2015, future. Frame effects: legendary, showcase, extendedart, inverted, colorshifted, etched, snow, and many more.",
      examples: ["frame:2015", "frame:showcase", "frame:legendary", "-frame:future"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField
    },
    collector_number: {
      aliases: ["cn"],
      esPath: "collector_number",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      description: "Filter by collector number within a set. Supports numeric comparisons and suffix variants (e.g. 123a, 123\u2605). Combine with set: for precise lookup.",
      examples: ["cn:1", "set:dmu collector_number<=100", "cn=250a"],
      parseValue: (value) => String(value).trim(),
      compile: compileCollectorNumberField
    },
    usd: {
      esPath: "prices.usd",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by USD price (non-foil). Prices sourced from TCGPlayer via Scryfall.",
      examples: ["usd<1", "usd>=10", "usd=0.25", "usd!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    eur: {
      esPath: "prices.eur",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by EUR price (non-foil). Prices sourced from Cardmarket via Scryfall.",
      examples: ["eur<2", "eur>=5", "eur=1.50"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    tix: {
      esPath: "prices.tix",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by MTGO ticket price. Prices sourced from Cardhoarder via Scryfall.",
      examples: ["tix<1", "tix>=5", "tix=0.01"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    power: {
      aliases: ["pow"],
      esPath: "power_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by power (numeric only; cards with */X/\u221E power are excluded). Supports all numeric comparison operators.",
      examples: ["power>=5", "pow=2", "power<3", "pow!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    toughness: {
      aliases: ["tou"],
      esPath: "toughness_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by toughness (numeric only; cards with */X/\u221E toughness are excluded). Supports all numeric comparison operators.",
      examples: ["toughness>=4", "tou=1", "toughness<5", "tou!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField
    },
    oracle_text: {
      aliases: ["o", "oracle", "text"],
      esPath: "oracle_text",
      esPaths: ["oracle_text", "card_faces.oracle_text"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      description: "Search oracle (rules) text. Unquoted values match word-by-word across subfields. Quoted values match the exact phrase. Searches both faces of double-faced cards.",
      examples: ["o:flying", 'o:"draw a card"', "o:haste o:trample"],
      compile: compileTextField
    },
    flavor_text: {
      aliases: ["ft", "flavor"],
      esPath: "flavor_text",
      esPaths: ["flavor_text", "card_faces.flavor_text"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      description: "Search flavor text. Unquoted values match word-by-word. Quoted values match the exact phrase. Searches both faces of double-faced cards.",
      examples: ["ft:urza", 'flavor:"Rath and Storm"', 'ft:"for the horde"'],
      compile: compileTextField
    },
    type_line: {
      aliases: ["t", "type"],
      esPath: "type_line",
      esPaths: ["type_line", "card_faces.type_line"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      description: "Search the type line (supertypes, types, subtypes). Searches both faces of double-faced cards.",
      examples: ["t:creature", "type:legendary", "t:dragon", "t:planeswalker t:elf"],
      compile: compileTextField
    },
    keywords: {
      aliases: ["kw", "keyword"],
      esPath: "keywords",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by rules keyword (flying, trample, haste, etc.). Matches the keywords array field, not oracle text.",
      examples: ["keywords:flying", "kw:trample", "keyword:deathtouch", "kw:haste kw:flash"],
      parseValue: (value) => String(value).trim(),
      compile: compileKeywordField
    },
    name: {
      aliases: ["name", "n"],
      esPath: "name",
      exactEsPaths: ["name.keyword", "card_faces.name.keyword"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      description: "Search card name. Bare terms (without a field prefix) default to name search. Use = for exact match. Prefix with ! for exact-name bang syntax.",
      examples: ["name:lightning", 'name:"Lightning Bolt"', "n=bolt", '!"Sift Through Sands"'],
      compile: compileTextField
    }
  };
}

// src/profiles/ctx-card.js
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  if (isPlainObject(value)) {
    const clone = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneValue(nestedValue);
    }
    return clone;
  }
  return value;
}
function prefixPath2(path, prefix) {
  if (typeof path !== "string" || !path) {
    return path;
  }
  if (path.startsWith(`${prefix}.`)) {
    return path;
  }
  return `${prefix}.${path}`;
}
function prefixPathList(paths, prefix) {
  if (!Array.isArray(paths)) {
    return paths;
  }
  return paths.map((path) => prefixPath2(path, prefix));
}
function prefixTokenFieldMap(tokenFieldMap, prefix) {
  if (!isPlainObject(tokenFieldMap)) {
    return tokenFieldMap;
  }
  const nextTokenFieldMap = {};
  for (const [token, paths] of Object.entries(tokenFieldMap)) {
    nextTokenFieldMap[token] = prefixPathList(paths, prefix);
  }
  return nextTokenFieldMap;
}
function prefixSemanticShortcuts(semanticShortcuts, prefix) {
  if (!isPlainObject(semanticShortcuts)) {
    return semanticShortcuts;
  }
  const nextSemanticShortcuts = {};
  for (const [token, config] of Object.entries(semanticShortcuts)) {
    const nextConfig = cloneValue(config);
    nextConfig.legalityPath = prefixPath2(nextConfig.legalityPath, prefix);
    nextConfig.typePaths = prefixPathList(nextConfig.typePaths, prefix);
    nextConfig.oraclePaths = prefixPathList(nextConfig.oraclePaths, prefix);
    nextConfig.powerPath = prefixPath2(nextConfig.powerPath, prefix);
    nextConfig.toughnessPath = prefixPath2(nextConfig.toughnessPath, prefix);
    nextConfig.nestedContainers = prefixPathList(nextConfig.nestedContainers, prefix);
    nextConfig.typePaths = prefixPathList(nextConfig.typePaths, prefix);
    nextConfig.field = prefixPath2(nextConfig.field, prefix);
    nextSemanticShortcuts[token] = nextConfig;
  }
  return nextSemanticShortcuts;
}
function deriveFieldDefinitionForCtxCard(definition, prefix) {
  const nextDefinition = cloneValue(definition);
  if (nextDefinition.searchControl) {
    return nextDefinition;
  }
  nextDefinition.esPath = prefixPath2(nextDefinition.esPath, prefix);
  nextDefinition.esPaths = prefixPathList(nextDefinition.esPaths, prefix);
  nextDefinition.exactEsPaths = prefixPathList(nextDefinition.exactEsPaths, prefix);
  nextDefinition.nestedContainers = prefixPathList(nextDefinition.nestedContainers, prefix);
  nextDefinition.tokenFieldMap = prefixTokenFieldMap(nextDefinition.tokenFieldMap, prefix);
  nextDefinition.semanticShortcuts = prefixSemanticShortcuts(nextDefinition.semanticShortcuts, prefix);
  return nextDefinition;
}
function deriveCtxCardFieldDefinitions(options = {}) {
  const {
    prefix = "card",
    baseFieldDefinitions = createDefaultFieldDefinitions()
  } = options;
  if (typeof prefix !== "string" || !prefix.trim()) {
    throw new Error("ctx.card field derivation requires a non-empty prefix string.");
  }
  const fields = {};
  for (const [fieldName, definition] of Object.entries(baseFieldDefinitions)) {
    fields[fieldName] = deriveFieldDefinitionForCtxCard(definition, prefix);
  }
  return fields;
}
function createCtxCardProfileExtension(options = {}) {
  return {
    override: true,
    fields: deriveCtxCardFieldDefinitions(options)
  };
}

// src/registry/index.js
function cloneFieldDefinition(definition) {
  return {
    ...definition,
    aliases: [...definition.aliases ?? []]
  };
}
function assertFieldDefinition(name, definition) {
  if (!definition || typeof definition !== "object") {
    throw new Error(`Field "${name}" must be an object.`);
  }
  if (!definition.searchControl && (typeof definition.esPath !== "string" || !definition.esPath)) {
    throw new Error(`Field "${name}" must define a non-empty "esPath".`);
  }
  if (!definition.searchControl && !/^[@a-zA-Z0-9_.\-]+$/.test(definition.esPath)) {
    throw new Error(
      `Field "${name}" esPath "${definition.esPath}" contains invalid characters. Only letters, digits, underscores, dots, hyphens, and @ are allowed.`
    );
  }
  if (typeof definition.compile !== "function") {
    throw new Error(`Field "${name}" must define a "compile" function.`);
  }
  if (!definition.searchControl && (!Array.isArray(definition.operators) || definition.operators.length === 0)) {
    throw new Error(`Field "${name}" must define a non-empty "operators" array.`);
  }
}
function createRegistry() {
  const fields = /* @__PURE__ */ new Map();
  const aliases = /* @__PURE__ */ new Map();
  function assertAliasAvailable(alias, fieldName, override) {
    const existingFieldName = aliases.get(alias);
    if (existingFieldName && existingFieldName !== fieldName && !override) {
      throw new Error(
        `Alias "${alias}" is already registered to "${existingFieldName}". Use override to replace it.`
      );
    }
  }
  function registerField(name, definition, options = {}) {
    const { override = false } = options;
    assertFieldDefinition(name, definition);
    if (fields.has(name) && !override) {
      throw new Error(`Field "${name}" is already registered. Use override to replace it.`);
    }
    const normalizedDefinition = cloneFieldDefinition(definition);
    normalizedDefinition.name = name;
    for (const alias of [name, ...normalizedDefinition.aliases]) {
      assertAliasAvailable(alias, name, override);
    }
    if (override && fields.has(name)) {
      const previous = fields.get(name);
      for (const alias of [name, ...previous.aliases ?? []]) {
        if (aliases.get(alias) === name) {
          aliases.delete(alias);
        }
      }
    }
    fields.set(name, normalizedDefinition);
    for (const alias of [name, ...normalizedDefinition.aliases]) {
      aliases.set(alias, name);
    }
    return normalizedDefinition;
  }
  function resolveFieldName(nameOrAlias) {
    return aliases.get(nameOrAlias) ?? nameOrAlias;
  }
  function getField(nameOrAlias) {
    const resolvedName = resolveFieldName(nameOrAlias);
    const definition = fields.get(resolvedName);
    if (!definition) {
      throw new Error(`Unknown field "${nameOrAlias}".`);
    }
    return definition;
  }
  function parseValue(nameOrAlias, rawValue) {
    const definition = getField(nameOrAlias);
    if (typeof definition.parseValue === "function") {
      return definition.parseValue(rawValue, definition);
    }
    return rawValue;
  }
  function registerAlias(alias, fieldName, options = {}) {
    const { override = false } = options;
    const definition = getField(fieldName);
    assertAliasAvailable(alias, definition.name, override);
    aliases.set(alias, definition.name);
  }
  function extend(extension = {}) {
    const { fields: nextFields = {}, aliases: nextAliases = {}, override = false } = extension;
    for (const [fieldName, definition] of Object.entries(nextFields)) {
      registerField(fieldName, definition, { override });
    }
    for (const [alias, fieldName] of Object.entries(nextAliases)) {
      registerAlias(alias, fieldName, { override });
    }
  }
  extend({
    fields: createDefaultFieldDefinitions()
  });
  return {
    extend,
    getField,
    parseValue,
    registerAlias,
    registerField,
    resolveFieldName
  };
}

// src/runtime/version.js
var VERSION = true ? "0.2.0-rc.1" : "0.0.0-dev";
var RELEASE = true ? "0.2.0-rc.1+3f372f7" : VERSION;
var BUILD_DATE = true ? "2026-04-05T19:14:30.731Z" : "unbundled";
var announced = false;
function announceBrowserBuild() {
  if (announced || typeof window === "undefined" || typeof console?.info !== "function") {
    return;
  }
  announced = true;
  console.info(`[ScryfallQueryDSL] loaded ${RELEASE}`);
}

// src/runtime/createEngine.js
function createCompilationContext({ extension, controlConfig } = {}) {
  const registry = createRegistry();
  if (extension) {
    registry.extend(extension);
  }
  const compiler = createCompiler({ registry, controlConfig });
  return {
    registry,
    compiler
  };
}
function createEngine(options = {}) {
  const parser = createParser();
  const profiles = /* @__PURE__ */ new Map();
  profiles.set("default", createCompilationContext({ extension: options.extension }));
  profiles.set(
    "ctx.card",
    createCompilationContext({
      extension: createCtxCardProfileExtension(),
      controlConfig: createPrefixedControlConfig("card")
    })
  );
  function getProfileContext(profileName = "default") {
    const context = profiles.get(profileName);
    if (!context) {
      throw new Error(`Unknown profile "${profileName}".`);
    }
    return context;
  }
  return {
    /** @type {string} */
    version: RELEASE,
    /**
     * Parse a Scryfall-style query string into an AST.
     *
     * @param {string} query - A non-empty query string (e.g. `"t:creature c:red"`).
     * @returns {object} The parsed AST node. Pass to `compile()` to avoid re-parsing.
     * @throws {Error} If `query` is empty or syntactically invalid.
     *
     * @example
     * const ast = engine.parse('c:red t:dragon');
     * const { dsl } = engine.compile(ast);
     */
    parse(query) {
      return parser.parse(query);
    },
    /**
     * Compile a query string or pre-parsed AST into an Elasticsearch DSL object.
     *
     * Always returns `{ dsl, meta }`. The `dsl` object can be used directly as the
     * `query` body in an ES search request. The `meta` object contains information about
     * shortcut terms encountered and any non-fatal warnings.
     *
     * @param {string|object} queryOrAst - A query string or a pre-parsed AST from `parse()`.
     * @param {object} [compileOptions]
     * @param {string} [compileOptions.profile="default"] - Profile to compile against. Built-in: `"default"`, `"ctx.card"`.
     * @returns {CompileResult} `{ dsl, meta }` where `dsl` is the ES query object.
     * @throws {Error} If the profile is unknown or the query is syntactically invalid.
     *
     * @example
     * const { dsl, meta } = engine.compile('t:creature c:red');
     * // dsl → { bool: { must: [...] } }
     *
     * @example
     * // Using the ctx.card profile for nested documents
     * const { dsl } = engine.compile('c:red', { profile: 'ctx.card' });
     * // dsl → { bool: { must: [{ term: { 'card.colors': 'R' } }] } }
     */
    compile(queryOrAst, compileOptions = {}) {
      const { profile = "default" } = compileOptions;
      const context = getProfileContext(profile);
      const ast = typeof queryOrAst === "string" ? parser.parse(queryOrAst) : queryOrAst;
      return context.compiler.compile(ast);
    },
    /**
     * Register a new named profile with its own isolated field registry.
     *
     * Profiles let you compile the same query against different ES document layouts.
     * Each profile has an independent set of fields; extending one does not affect others.
     *
     * @param {string} name - Non-empty profile name (must not conflict with existing profiles unless `override` is set).
     * @param {FieldExtension} [extension={}] - Fields to register in the new profile.
     * @param {object} [options]
     * @param {boolean} [options.override=false] - Replace an existing profile with the same name.
     * @returns {Engine} The engine instance (chainable).
     * @throws {Error} If `name` is empty or the profile already exists without `override`.
     *
     * @example
     * engine.registerProfile('my-profile', {
     *   fields: { custom_field: { esPath: 'my_field', operators: [':', '='], compile: compileKeywordField } }
     * });
     * const { dsl } = engine.compile('custom_field:value', { profile: 'my-profile' });
     */
    registerProfile(name, extension = {}, options2 = {}) {
      if (!name || typeof name !== "string") {
        throw new Error("Profile name must be a non-empty string.");
      }
      const { override = false } = options2;
      if (profiles.has(name) && !override) {
        throw new Error(`Profile "${name}" is already registered. Use override to replace it.`);
      }
      profiles.set(name, createCompilationContext({ extension }));
      return this;
    },
    /**
     * Extend an existing profile with additional field definitions.
     *
     * Unlike `registerProfile`, this merges fields into an existing profile rather than
     * creating a new one. Useful for adding fields to the built-in `"ctx.card"` profile.
     *
     * @param {string} name - Name of an existing profile.
     * @param {FieldExtension} extension - Fields to merge into the profile.
     * @returns {Engine} The engine instance (chainable).
     * @throws {Error} If the profile does not exist.
     *
     * @example
     * engine.extendProfile('ctx.card', {
     *   fields: { deck_count: { esPath: 'card.deck_count', operators: [':', '=', '>'], compile: compileNumericField } }
     * });
     */
    extendProfile(name, extension) {
      const context = getProfileContext(name);
      context.registry.extend(extension);
      return this;
    },
    /**
     * List all registered profile names.
     *
     * @returns {string[]} Array of profile names (always includes `"default"` and `"ctx.card"`).
     *
     * @example
     * engine.listProfiles(); // ['default', 'ctx.card']
     */
    listProfiles() {
      return [...profiles.keys()];
    },
    /**
     * Extend a profile with additional field definitions (shorthand for common use-cases).
     *
     * Equivalent to `extendProfile(options.profile ?? 'default', extension)`.
     *
     * @param {FieldExtension} extension - Fields to merge into the profile.
     * @param {object} [options]
     * @param {string} [options.profile="default"] - Profile to extend.
     * @returns {Engine} The engine instance (chainable).
     *
     * @example
     * engine.extend({ fields: { my_field: { ... } } });
     */
    extend(extension, options2 = {}) {
      const { profile = "default" } = options2;
      const context = getProfileContext(profile);
      context.registry.extend(extension);
      return this;
    },
    /**
     * Register a query alias that resolves to an existing field name.
     *
     * After registration, the alias can be used in queries exactly like the original field name.
     *
     * @param {string} alias - The alias token (e.g. `"s"` for set).
     * @param {string} fieldName - The canonical field name the alias maps to.
     * @param {object} [options]
     * @param {string} [options.profile="default"] - Profile to register the alias in.
     * @returns {Engine} The engine instance (chainable).
     *
     * @example
     * engine.registerAlias('s', 'set');
     * engine.compile('s:dmu'); // equivalent to set:dmu
     */
    registerAlias(alias, fieldName, options2) {
      const profile = options2?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerAlias(alias, fieldName, options2);
      return this;
    },
    /**
     * Register a new field definition in a profile.
     *
     * Fields must have a valid `esPath` (letters, digits, underscores, dots only),
     * at least one operator, and a `compile` function.
     *
     * @param {string} fieldName - The field name used in queries (e.g. `"deck_count"`).
     * @param {FieldDefinition} definition - Field configuration object.
     * @param {object} [options]
     * @param {string} [options.profile="default"] - Profile to register the field in.
     * @returns {Engine} The engine instance (chainable).
     * @throws {Error} If the field name is already registered, or if `esPath` contains invalid characters.
     *
     * @example
     * import { compileNumericField } from 'scryfall-query-dsl';
     * engine.registerField('deck_count', {
     *   esPath: 'deck_count',
     *   operators: [':', '=', '>', '>=', '<', '<='],
     *   type: 'number',
     *   description: 'Number of decks running this card.',
     *   examples: ['deck_count>100'],
     *   compile: compileNumericField,
     * });
     */
    registerField(fieldName, definition, options2) {
      const profile = options2?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerField(fieldName, definition, options2);
      return this;
    },
    /**
     * Resolve a field name or alias to its canonical field name.
     *
     * @param {string} nameOrAlias - A field name or registered alias.
     * @param {object} [options]
     * @param {string} [options.profile="default"] - Profile to look up in.
     * @returns {string} The canonical field name.
     * @throws {Error} If the name or alias is not registered in the profile.
     *
     * @example
     * engine.resolveFieldName('c');      // 'colors'
     * engine.resolveFieldName('format'); // 'legal'
     */
    resolveFieldName(nameOrAlias, options2 = {}) {
      const { profile = "default" } = options2;
      const context = getProfileContext(profile);
      return context.registry.resolveFieldName(nameOrAlias);
    }
  };
}

// src/index.js
announceBrowserBuild();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BUILD_DATE,
  RELEASE,
  VERSION,
  announceBrowserBuild,
  compileBooleanField,
  compileCollectorNumberField,
  compileColorField,
  compileDateField,
  compileIsShortcutField,
  compileKeywordField,
  compileLegalityField,
  compileNotShortcutField,
  compileNumericField,
  compileOrderedKeywordField,
  compileSearchDirectionField,
  compileSearchLangField,
  compileSearchOrderField,
  compileSearchPreferField,
  compileSearchUniqueField,
  compileTextField,
  compileYearField,
  createEngine,
  parseColorExpression
});
