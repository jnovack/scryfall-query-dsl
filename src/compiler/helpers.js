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
  const hasWhitespace = /\s/.test(value);
  const operator = hasWhitespace ? "and" : undefined;
  const shortestTokenLength = value
    .trim()
    .split(/\s+/)
    .reduce((shortest, token) => Math.min(shortest, token.length), Infinity);
  const fuzzyPrefixLength = Number.isFinite(shortestTokenLength) ? Math.min(3, Math.max(1, shortestTokenLength)) : 1;
  const fuzzyOptions = {
    fuzziness: "AUTO",
    prefix_length: fuzzyPrefixLength,
    ...(operator ? { operator } : {}),
    boost: 1,
  };

  if (node?.exactNameBang) {
    const terms = exactEsPaths.map((esPath) => ({
      term: {
        [esPath]: value,
      },
    }));

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
        createMatchClause(basePath, value, fuzzyOptions),
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

function compilePartialTextField({ definition, value }) {
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const subfields = definition.partialSubfields ?? ["prefix", "infix"];
  const pathVariants = esPaths.flatMap((path) => createPartialPathVariants(path, subfields));
  const clauses = pathVariants.map((path) => createMatchClause(path, value));

  return compilePathDisjunction(clauses);
}

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

export function compileTextField({ fieldName, definition, operator, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, operator);
  const esPaths = Array.isArray(definition.esPaths) && definition.esPaths.length ? definition.esPaths : [definition.esPath];
  const normalizedFieldName = definition.name ?? fieldName;

  if (normalizedFieldName === "name" && (operator === ":" || operator === "=") && typeof value === "string" && esPaths.length === 1) {
    return compileNameTextField({
      definition,
      value,
      node,
    });
  }

  if (operator === "=") {
    const terms = esPaths.map((esPath) => ({
      term: {
        [esPath]: value,
      },
    }));
    return compilePathDisjunction(terms);
  }

  if (definition.enablePartialSubfields) {
    return compilePartialTextField({
      definition,
      value,
    });
  }

  const matches = esPaths.map((esPath) => createMatchClause(esPath, value));

  return compilePathDisjunction(matches);
}

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

export function compileSearchUniqueField(args) {
  return compileSearchDirectiveField({ ...args, directive: "unique" });
}

export function compileSearchOrderField(args) {
  return compileSearchDirectiveField({ ...args, directive: "order" });
}

export function compileSearchPreferField(args) {
  return compileSearchDirectiveField({ ...args, directive: "prefer" });
}

export function compileSearchDirectionField(args) {
  return compileSearchDirectiveField({ ...args, directive: "direction" });
}

export function compileSearchLangField(args) {
  return compileSearchDirectiveField({ ...args, directive: "lang" });
}

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

export function compileDateField({ fieldName, definition, operator, value }) {
  const supportedOperators = definition.operators ?? [":", "=", ">", ">=", "<", "<="];
  assertSupportedOperator(fieldName, supportedOperators, operator);

  return compileDateComparisonClause(definition.esPath, operator, value);
}

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
  const match = atom.match(/^(-)?([^:><=]+)(>=|<=|:|=|>|<)(.+)$/);

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

  const legendaryClause = {
    bool: {
      should: typePaths.map((path) =>
        createMatchClause(path, "legendary", {
          operator: "and",
        })
      ),
      minimum_should_match: 1,
    },
  };

  const artifactOrCreatureClause = {
    bool: {
      should: [
        ...typePaths.map((path) =>
          createMatchClause(path, "artifact", {
            operator: "and",
          })
        ),
        ...typePaths.map((path) =>
          createMatchClause(path, "creature", {
            operator: "and",
          })
        ),
      ],
      minimum_should_match: 1,
    },
  };

  const textExceptionClause = {
    bool: {
      should: oraclePaths.map((path) => ({
        match_phrase: {
          [path]: "can be your commander",
        },
      })),
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
                bool: {
                  must_not: [
                    {
                      term: {
                        [legalityPath]: "banned",
                      },
                    },
                  ],
                },
              },
              legendaryClause,
              artifactOrCreatureClause,
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

function compileIsSemanticShortcut({ definition, token, term }) {
  const semanticConfig = definition.semanticShortcuts?.[token];

  if (!semanticConfig) {
    return null;
  }

  if (semanticConfig.kind !== "commander") {
    throw new Error(`Unsupported semantic shortcut kind "${semanticConfig.kind}" for token "${token}".`);
  }

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

export function compileNotShortcutField({ fieldName, definition, value, node }) {
  const supportedOperators = definition.operators ?? [":", "="];
  assertSupportedOperator(fieldName, supportedOperators, node?.operator ?? ":");
  const token = String(value).toLowerCase();
  const mappedFields = definition.tokenFieldMap?.[token] ?? [];
  const term = `${definition.name}:${token}`;

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

function compileColorAcrossPaths(definition, builder) {
  const paths = resolveColorPaths(definition);
  const clauses = paths.map((path) => builder(path));

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

export function parseColorExpression(rawValue) {
  return parseColorValueToken(rawValue);
}

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

    if (operator === "<") {
      return { match_none: {} };
    }
  }

  if (operator === ":" || operator === "=") {
    return compileColorEqualityClause(definition, value);
  }

  if (operator === ">=") {
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

  if (operator === ">") {
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

  if (operator === "<=") {
    return compileColorAcrossPaths(definition, (esPath) =>
      compileColorSetDisjunction(
        esPath,
        allSets.filter((colors) => colors.every((color) => targetColors.includes(color)))
      )
    );
  }

  if (operator === "<") {
    return compileColorAcrossPaths(definition, (esPath) =>
      compileColorSetDisjunction(
        esPath,
        allSets.filter(
          (colors) =>
            colors.length < targetColors.length &&
            colors.every((color) => targetColors.includes(color))
        )
      )
    );
  }

  throw new Error(`Unsupported operator "${operator}" for field "${fieldName}".`);
}
