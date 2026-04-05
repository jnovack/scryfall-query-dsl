/**
 * Compiler helper functions for use with `engine.registerField()`.
 *
 * Each compile helper receives a single argument object containing `fieldName`,
 * `definition`, `operator`, `value`, and optionally `node` (text fields) or
 * `registry` (shortcut fields). Pass one of these as the `compile` property
 * in a field definition.
 *
 * @module scryfall-query-dsl/helpers
 */

const ATOM_PATTERN = /^(-)?([^:><=]+)(>=|<=|:|=|>|<)(.+)$/;

const RANGE_OPERATOR_MAP = {
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
};

const ORDERED_COLORS = ["white", "blue", "black", "red", "green"];
const COLOR_SYMBOLS = {
  white: "W",
  blue: "U",
  black: "B",
  red: "R",
  green: "G",
};

const COLOR_ALIASES = {
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
  artifice: ["white", "blue", "black", "green"],
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
        [esPath]: values[0],
      },
    };
  }

  return {
    bool: {
      should: values.map((value) => ({
        term: {
          [esPath]: value,
        },
      })),
      minimum_should_match: 1,
    },
  };
}

function compilePathDisjunction(clauses) {
  if (clauses.length === 1) {
    return clauses[0];
  }

  return {
    bool: {
      should: clauses,
      minimum_should_match: 1,
    },
  };
}

function negateCompiledClause(clause) {
  return {
    bool: {
      must_not: [clause],
    },
  };
}

function createMatchClause(fieldPath, value, options = {}) {
  if (!Object.keys(options).length) {
    return {
      match: {
        [fieldPath]: value,
      },
    };
  }

  return {
    match: {
      [fieldPath]: {
        query: value,
        ...options,
      },
    },
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
  const exactEsPaths =
    Array.isArray(definition.exactEsPaths) && definition.exactEsPaths.length
      ? definition.exactEsPaths
      : [`${basePath}.keyword`];
  const nestedContainers = definition.nestedContainers;
  const hasWhitespace = /\s/.test(value);
  const operator = hasWhitespace ? "and" : undefined;

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
        [basePath]: value,
      },
    };
  }

  return {
    bool: {
      should: [
        createMatchClause(basePath, value, {
          ...(operator ? { operator } : {}),
          boost: 4,
        }),
        createMatchClause(`${basePath}.prefix`, value, {
          ...(operator ? { operator } : {}),
          boost: 3,
        }),
        createMatchClause(`${basePath}.infix`, value, {
          ...(operator ? { operator } : {}),
          boost: 2,
        }),
      ],
      minimum_should_match: 1,
    },
  };
}

function compileDateComparisonClause(esPath, operator, value) {
  if (operator === ":" || operator === "=") {
    return {
      term: {
        [esPath]: value,
      },
    };
  }

  return {
    range: {
      [esPath]: {
        [RANGE_OPERATOR_MAP[operator]]: value,
      },
    },
  };
}

function compilePartialTextField({ definition, value, node }) {
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const nestedContainers = definition.nestedContainers;

  if (node?.quoted) {
    const clauses = esPaths.map((path) => {
      const clause = { match_phrase: { [path]: value } };
      const nestedPath = resolveNestedPath(nestedContainers, path);
      return nestedPath ? wrapNested(nestedPath, clause) : clause;
    });
    return compilePathDisjunction(clauses);
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

/**
 * Compile a numeric field (power, toughness, cmc, prices, etc.).
 * Supports `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: number }} args
 */
export function compileNumericField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value,
      },
    };
  }

  if (operator === "!=") {
    return negateCompiledClause({
      term: {
        [definition.esPath]: value,
      },
    });
  }

  return {
    range: {
      [definition.esPath]: {
        [RANGE_OPERATOR_MAP[operator]]: value,
      },
    },
  };
}

/**
 * Compile a keyword field (exact term match against an ES keyword field).
 * Supports `:` and `=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string }} args
 */
export function compileKeywordField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const terms = esPaths.map((esPath) => ({
    term: {
      [esPath]: value,
    },
  }));

  if (operator === "!=") {
    return negateCompiledClause(compilePathDisjunction(terms));
  }

  return compilePathDisjunction(terms);
}

/**
 * Compile a text field (full-text search against an ES text field).
 * Quoted values emit `match_phrase`; unquoted values emit `match` or partial word queries.
 * If `definition.enablePartialSubfields` is true, unquoted values expand to sub-word queries.
 * Supports `:` and `=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string, node: object }} args
 */
export function compileTextField({ fieldName, definition, operator, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const nestedContainers = definition.nestedContainers;
  const normalizedFieldName = definition.name ?? fieldName;

  if (normalizedFieldName === "name" && (operator === ":" || operator === "=") && typeof value === "string" && esPaths.length === 1) {
    return compileNameTextField({
      definition,
      value,
      node,
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
      node,
    });
  }

  const matches = esPaths.map((esPath) => {
    const clause = createMatchClause(esPath, value);
    const nestedPath = resolveNestedPath(nestedContainers, esPath);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  });

  return compilePathDisjunction(matches);
}

/**
 * Compile a boolean field (e.g. `promo:true`).
 * Value must be coercible to a boolean via `parseValue`. Supports `:` and `=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: boolean }} args
 */
export function compileBooleanField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  return {
    term: {
      [definition.esPath]: value,
    },
  };
}

export function compileSearchDirectiveField({ fieldName, definition, operator, value, directive }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  return {
    control: {
      directive,
      value,
    },
  };
}

/** Compile a `unique:` search control directive. @param {object} args */
export function compileSearchUniqueField(args) {
  return compileSearchDirectiveField({ ...args, directive: "unique" });
}

/** Compile an `order:` search control directive. @param {object} args */
export function compileSearchOrderField(args) {
  return compileSearchDirectiveField({ ...args, directive: "order" });
}

/** Compile a `prefer:` search control directive. @param {object} args */
export function compileSearchPreferField(args) {
  return compileSearchDirectiveField({ ...args, directive: "prefer" });
}

/** Compile a `direction:` search control directive. @param {object} args */
export function compileSearchDirectionField(args) {
  return compileSearchDirectiveField({ ...args, directive: "direction" });
}

/** Compile a `lang:` search control directive. @param {object} args */
export function compileSearchLangField(args) {
  return compileSearchDirectiveField({ ...args, directive: "lang" });
}

/**
 * Compile a legality field (legal, banned, restricted).
 * Checks `legalities.[format]` for the status defined in `definition.legalityStatus`.
 * Supports `:` and `=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string }} args
 */
export function compileLegalityField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  const legalityStatus = definition.legalityStatus ?? "legal";

  return {
    term: {
      [`${definition.esPath}.${value}`]: legalityStatus,
    },
  };
}

/**
 * Compile a date field (released_at) using YYYY-MM-DD formatted values.
 * Supports `:`, `=`, `>`, `>=`, `<`, `<=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string }} args
 */
export function compileDateField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  return compileDateComparisonClause(definition.esPath, operator, value);
}

/**
 * Compile a year field against `released_at`. Converts the 4-digit year to a date range.
 * Supports `:`, `=`, `>`, `>=`, `<`, `<=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: number }} args
 */
export function compileYearField({ fieldName, definition, operator, value }) {
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
          lte: yearEnd,
        },
      },
    };
  }

  if (operator === ">") {
    return {
      range: {
        [esPath]: {
          gt: yearEnd,
        },
      },
    };
  }

  if (operator === ">=") {
    return {
      range: {
        [esPath]: {
          gte: yearStart,
        },
      },
    };
  }

  if (operator === "<") {
    return {
      range: {
        [esPath]: {
          lt: yearStart,
        },
      },
    };
  }

  if (operator === "<=") {
    return {
      range: {
        [esPath]: {
          lte: yearEnd,
        },
      },
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
      must_not: [clause],
    },
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
    registry,
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
        must: clauses,
      },
    },
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: ["shortcut-expansion"],
      expandedAtoms: atoms,
    },
  };
}

function compileCommanderSemanticShortcut(tokenConfig) {
  const legalityPath = tokenConfig?.legalityPath;
  const typePaths = Array.isArray(tokenConfig?.typePaths) ? tokenConfig.typePaths : [];
  const oraclePaths = Array.isArray(tokenConfig?.oraclePaths) ? tokenConfig.oraclePaths : [];
  const powerPath = tokenConfig?.powerPath;
  const toughnessPath = tokenConfig?.toughnessPath;
  const nestedContainers = Array.isArray(tokenConfig?.nestedContainers) ? tokenConfig.nestedContainers : [];

  if (
    typeof legalityPath !== "string" ||
    !legalityPath ||
    !typePaths.length ||
    !oraclePaths.length ||
    typeof powerPath !== "string" ||
    !powerPath ||
    typeof toughnessPath !== "string" ||
    !toughnessPath
  ) {
    throw new Error("Semantic shortcut \"is:commander\" is missing required path configuration.");
  }

  function wrapPathIfNested(path, clause) {
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  }

  const legendaryClause = {
    bool: {
      should: typePaths.map((path) =>
        wrapPathIfNested(path, createMatchClause(path, "legendary", { operator: "and" }))
      ),
      minimum_should_match: 1,
    },
  };

  const artifactOrCreatureClause = {
    bool: {
      should: [
        ...typePaths.map((path) =>
          wrapPathIfNested(path, createMatchClause(path, "artifact", { operator: "and" }))
        ),
        ...typePaths.map((path) =>
          wrapPathIfNested(path, createMatchClause(path, "creature", { operator: "and" }))
        ),
      ],
      minimum_should_match: 1,
    },
  };

  const textExceptionClause = {
    bool: {
      should: oraclePaths.map((path) =>
        wrapPathIfNested(path, { match_phrase: { [path]: "can be your commander" } })
      ),
      minimum_should_match: 1,
    },
  };

  return {
    bool: {
      should: [
        {
          bool: {
            must: [
              {
                term: {
                  [legalityPath]: "legal",
                },
              },
              legendaryClause,
              artifactOrCreatureClause,
              // Planeswalker commanders lack P/T; they are covered by textExceptionClause below.
              { exists: { field: powerPath } },
              { exists: { field: toughnessPath } },
            ],
          },
        },
        textExceptionClause,
      ],
      minimum_should_match: 1,
    },
  };
}

// Compiles is:promo, is:spotlight, and similar tokens that test a single boolean field.
// tokenConfig must have { kind: "boolean", field: <esPath> }.
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
      semanticKind: "boolean",
    },
  };
}

// Compiles is:digital and similar tokens that expand to a disjunction of term clauses.
// tokenConfig must have { kind: "term-disjunction", field: <esPath>, values: [...] }.
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
  const clause =
    clauses.length === 1
      ? clauses[0]
      : { bool: { should: clauses, minimum_should_match: 1 } };

  return {
    __sqdsl_clause: clause,
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: [field],
      semanticKind: "term-disjunction",
    },
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

  function wrapPathIfNested(path, clause) {
    const nestedPath = resolveNestedPath(nestedContainers, path);
    return nestedPath ? wrapNested(nestedPath, clause) : clause;
  }

  const clauses = [];

  for (const path of typePaths) {
    for (const value of values) {
      clauses.push(wrapPathIfNested(path, createMatchClause(path, value, { operator: "and" })));
    }
  }

  const clause =
    clauses.length === 1
      ? clauses[0]
      : {
          bool: {
            should: clauses,
            minimum_should_match: 1,
          },
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
      semanticKind: "type-line-disjunction",
    },
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
        semanticKind: semanticConfig.kind,
      },
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

/**
 * Compile an `is:` shortcut field. Dispatches through semantic shortcuts, token expansions,
 * and the `tokenFieldMap` to produce the appropriate ES clause.
 * @param {{ fieldName: string, definition: object, value: string, node: object, registry: object }} args
 */
export function compileIsShortcutField({ fieldName, definition, value, node, registry }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, node?.operator ?? ":");
  const token = String(value).toLowerCase();
  const mappedFields = definition.tokenFieldMap?.[token] ?? [];
  const term = `${definition.name}:${token}`;
  const semanticShortcut = compileIsSemanticShortcut({
    definition,
    token,
    term,
  });

  if (semanticShortcut) {
    return semanticShortcut;
  }

  const expansion = compileIsDefaultShortcut({
    definition,
    token,
    term,
    registry,
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
        valid: false,
      },
    };
  }

  const shouldClauses = mappedFields.map((fieldPath) => ({
    term: {
      [fieldPath]: token,
    },
  }));

  const clause =
    shouldClauses.length === 1
      ? shouldClauses[0]
      : {
          bool: {
            should: shouldClauses,
            minimum_should_match: 1,
          },
        };

  return {
    __sqdsl_clause: clause,
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: mappedFields,
    },
  };
}

/**
 * Compile a `not:` shortcut field. Negates the same token vocabulary as `is:`.
 * @param {{ fieldName: string, definition: object, value: string, node: object }} args
 */
export function compileNotShortcutField({ fieldName, definition, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, node?.operator ?? ":");
  const token = String(value).toLowerCase();
  const mappedFields = definition.tokenFieldMap?.[token] ?? [];
  const term = `${definition.name}:${token}`;
  const semanticShortcut = compileIsSemanticShortcut({
    definition,
    token,
    term,
  });

  if (semanticShortcut) {
    return {
      ...semanticShortcut,
      __sqdsl_clause: negateShortcutClause(semanticShortcut.__sqdsl_clause),
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
        valid: false,
      },
    };
  }

  return {
    __sqdsl_clause: {
      bool: {
        must_not: mappedFields.map((fieldPath) => ({
          term: {
            [fieldPath]: token,
          },
        })),
      },
    },
    __sqdsl_meta: {
      type: "shortcut-term",
      field: definition.name,
      token,
      term,
      valid: true,
      matchedFields: mappedFields,
    },
  };
}

export function createFieldSort(field, direction, options = {}) {
  return {
    [field]: {
      order: direction,
      ...options,
    },
  };
}

export function createScriptSort(source, params, direction = "asc") {
  return {
    _script: {
      type: "number",
      order: direction,
      script: {
        lang: "painless",
        source,
        params,
      },
    },
  };
}

// Build the prefer:default sort chain using explicit field paths so callers
// can remap the same behavior to alternate profile layouts.
export function createDefaultPrintingSorts(fields = {}) {
  const {
    fullArt = "full_art",
    promoTypes = "promo_types",
    frameEffects = "frame_effects",
    setType = "set_type",
    frame = "frame",
    finishes = "finishes",
    borderColor = "border_color",
    releasedAt = "released_at",
    collectorNumber = "collector_number",
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
    createFieldSort(collectorNumber, "desc", { unmapped_type: "keyword" }),
  ];
}

/**
 * Compile an ordered keyword field (rarity). Supports comparison operators by mapping
 * the keyword value to its position in `definition.order`.
 * Supports `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string }} args
 */
export function compileOrderedKeywordField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value,
      },
    };
  }

  if (operator === "!=") {
    return negateCompiledClause({
      term: {
        [definition.esPath]: value,
      },
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

/**
 * Compile a collector number field. Handles numeric comparisons and suffix variants
 * (e.g. `123a`, `123★`). Supports `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` operators.
 * @param {{ fieldName: string, definition: object, operator: string, value: string }} args
 */
export function compileCollectorNumberField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  if (operator === ":" || operator === "=") {
    return {
      term: {
        [definition.esPath]: value,
      },
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
            "return Integer.parseInt(collectorNumber) != params.value;",
          ].join(" "),
          params: {
            value: numericValue,
          },
        },
      },
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
          `return Integer.parseInt(collectorNumber) ${operator} params.value;`,
        ].join(" "),
        params: {
          value: numericValue,
        },
      },
    },
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
      if (mask & (1 << index)) {
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
        [esPath]: COLOR_SYMBOLS[color],
      },
    }));
  }

  if (excludedColors.length) {
    bool.must_not = excludedColors.map((color) => ({
      term: {
        [esPath]: COLOR_SYMBOLS[color],
      },
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
      minimum_should_match: 1,
    },
  };
}

function compileColorlessField(esPath) {
  return {
    bool: {
      must_not: [
        {
          exists: {
            field: esPath,
          },
        },
      ],
    },
  };
}

function resolveColorPaths(definition) {
  if (Array.isArray(definition.esPaths) && definition.esPaths.length) {
    return definition.esPaths;
  }

  return [definition.esPath];
}

/**
 * Return the nested container path for `esPath` if it lives inside a nested mapping,
 * or null if the path is at the top level.
 * @param {string[]} nestedContainers - e.g. ["card_faces"] or ["card.card_faces"]
 * @param {string} esPath
 * @returns {string|null}
 */
function resolveNestedPath(nestedContainers, esPath) {
  if (!Array.isArray(nestedContainers) || !nestedContainers.length) return null;
  // Use the longest matching container prefix to handle doubly-nested paths
  // correctly regardless of registration order.
  const matches = nestedContainers.filter(
    (container) => esPath === container || esPath.startsWith(`${container}.`)
  );
  if (!matches.length) return null;
  return matches.reduce((best, candidate) => (candidate.length > best.length ? candidate : best));
}

/**
 * Wrap a compiled clause in an Elasticsearch `nested` query.
 * @param {string} nestedPath - The nested path (e.g. "card_faces")
 * @param {object} clause - The inner query clause
 * @returns {object}
 */
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
      minimum_should_match: 1,
    },
  };
}

function compileColorEqualityClause(definition, value) {
  if (value.kind === "multicolor") {
    return compileColorAcrossPaths(definition, (esPath) =>
      compileColorSetDisjunction(
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
        must: paths.map((esPath) => compileColorlessField(esPath)),
      },
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
      colors: uniqueColors(aliasHit),
    };
  }

  if (/^[wubrg]+$/.test(normalized)) {
    return {
      kind: "set",
      colors: uniqueColors(
        normalized.split("").map((letter) => COLOR_ALIASES[letter][0])
      ),
    };
  }

  throw new Error(`Unknown color expression "${rawValue}".`);
}

/**
 * Parse a color expression string into a normalized color value object.
 * Accepts color letters (W, U, B, R, G), color names (white, blue, etc.),
 * guild/shard/wedge names (boros, esper, grixis, etc.), and special values
 * (colorless, multicolor).
 *
 * Pass as `parseValue` in a custom field definition that uses `compileColorField`.
 *
 * @param {string} rawValue - The raw color expression string from the query.
 * @returns {object} Parsed color value object consumed by `compileColorField`.
 * @throws {Error} If the value cannot be parsed as a valid color expression.
 *
 * @example
 * parseColorExpression('red');   // { colors: ['R'] }
 * parseColorExpression('wu');    // { colors: ['W', 'U'] }
 * parseColorExpression('boros'); // { colors: ['R', 'W'] }
 */
export function parseColorExpression(rawValue) {
  return parseColorValueToken(rawValue);
}

/**
 * Compile a color-set field (colors, color_identity).
 * Supports subset `:`, exact `=`, not-equal `!=`, and comparison `>`, `>=`, `<`, `<=` operators.
 * Use `parseColorExpression` as the `parseValue` for this field type.
 * @param {{ fieldName: string, definition: object, operator: string, value: object }} args
 */
export function compileColorField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  if (operator === "!=") {
    return negateCompiledClause(compileColorEqualityClause(definition, value));
  }

  if (value.kind === "multicolor") {
    if (operator !== ":" && operator !== "=") {
      throw new Error(`Field "${fieldName}" does not support operator "${operator}" for multicolor.`);
    }

    return compileColorAcrossPaths(definition, (esPath) =>
      compileColorSetDisjunction(
        esPath,
        enumerateColorSets().filter((colors) => colors.length >= 2)
      )
    );
  }

  const targetColors = value.colors;
  const allSets = enumerateColorSets();

  if (!targetColors.length) {
    if (operator === ":" || operator === "=" || operator === "<=") {
      // Colorless detection: check only the primary (card-level) path.
      // The card-level colors field is authoritative — a card is colorless if and only
      // if its top-level colors array is empty, regardless of individual face colors.
      // With nested mapping, per-face colorless checks require complex nested NOT logic,
      // and the card-level check is always sufficient and correct.
      return compileColorlessField(definition.esPath);
    }

    if (operator === "<") {
      return { match_none: {} };
    }
  }

  if (operator === "=") {
    return compileColorEqualityClause(definition, value);
  }

  // Scryfall parity: ":" maps to different directions depending on the field.
  //   colors:         ":" = ">=" (contains at least) — c:red means "is red or has red"
  //   color_identity: ":" = "<=" (fits within)       — id:esper means "can play in esper deck"
  // Fields opt into subset semantics via colonMeansSubset: true.
  const effectiveOperator = operator === ":" ? (definition.colonMeansSubset ? "<=" : ">=") : operator;

  if (effectiveOperator === ">=") {
    return compileColorAcrossPaths(definition, (esPath) => ({
      bool: {
        must: targetColors.map((color) => ({
          term: {
            [esPath]: COLOR_SYMBOLS[color],
          },
        })),
      },
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
            [esPath]: COLOR_SYMBOLS[color],
          },
        })),
        should: extraColors.map((color) => ({
          term: {
            [esPath]: COLOR_SYMBOLS[color],
          },
        })),
        minimum_should_match: 1,
      },
    }));
  }

  if (effectiveOperator === "<=") {
    return compileColorAcrossPaths(definition, (esPath) =>
      compileColorSetDisjunction(
        esPath,
        allSets.filter((colors) => colors.every((color) => targetColors.includes(color)))
      )
    );
  }

  if (effectiveOperator === "<") {
    // Scryfall parity: c<u means "any path does not contain all target colors".
    // For nested face paths, the nested query naturally scopes per-face — a colorless
    // back face matches even if the front face contains the target colors (e.g. Aang).
    // For flat object mappings (no nestedContainers), a non-primary face path is guarded
    // with an exists check so single-face cards don't spuriously match on absent paths.
    const paths = resolveColorPaths(definition);
    const nestedContainers = definition.nestedContainers;
    const clauses = paths.map((esPath) => {
      const mustNotHaveAll = [
        {
          bool: {
            must: targetColors.map((color) => ({
              term: { [esPath]: COLOR_SYMBOLS[color] },
            })),
          },
        },
      ];
      const nestedPath = resolveNestedPath(nestedContainers, esPath);
      if (nestedPath) {
        return wrapNested(nestedPath, { bool: { must_not: mustNotHaveAll } });
      }
      if (esPath === definition.esPath) {
        return { bool: { must_not: mustNotHaveAll } };
      }
      // Flat mapping face path: guard with exists to avoid spurious matches.
      return { bool: { must: [{ exists: { field: esPath } }], must_not: mustNotHaveAll } };
    });
    if (clauses.length === 1) return clauses[0];
    return { bool: { should: clauses, minimum_should_match: 1 } };
  }

  throw new Error(`Unsupported operator "${effectiveOperator}" for field "${fieldName}".`);
}
