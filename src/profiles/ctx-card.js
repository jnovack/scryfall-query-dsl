import { createDefaultFieldDefinitions } from "../fields/defaults.js";

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

  // Functions and primitives should remain referentially stable.
  return value;
}

function prefixPath(path, prefix) {
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

  return paths.map((path) => prefixPath(path, prefix));
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

// DEVIATION: This function hard-codes the path keys used by each semantic shortcut kind:
//   "commander"        — legalityPath, typePaths, oraclePaths, powerPath, toughnessPath
//   "boolean"          — field
//   "term-disjunction" — field (values are literal strings, not paths)
//   "type-line-disjunction" — typePaths, nestedContainers
// If a new semantic shortcut kind is added with different path keys, those paths will
// NOT be prefixed and the ctx.card profile will emit incorrect base-document paths.
// When adding a new semantic shortcut kind, update this function to handle its keys.
function prefixSemanticShortcuts(semanticShortcuts, prefix) {
  if (!isPlainObject(semanticShortcuts)) {
    return semanticShortcuts;
  }

  const nextSemanticShortcuts = {};

  for (const [token, config] of Object.entries(semanticShortcuts)) {
    const nextConfig = cloneValue(config);
    // "commander" kind paths
    nextConfig.legalityPath = prefixPath(nextConfig.legalityPath, prefix);
    nextConfig.typePaths = prefixPathList(nextConfig.typePaths, prefix);
    nextConfig.oraclePaths = prefixPathList(nextConfig.oraclePaths, prefix);
    nextConfig.powerPath = prefixPath(nextConfig.powerPath, prefix);
    nextConfig.toughnessPath = prefixPath(nextConfig.toughnessPath, prefix);
    nextConfig.nestedContainers = prefixPathList(nextConfig.nestedContainers, prefix);
    // "type-line-disjunction" kind paths
    nextConfig.typePaths = prefixPathList(nextConfig.typePaths, prefix);
    // "boolean" and "term-disjunction" kind paths
    nextConfig.field = prefixPath(nextConfig.field, prefix);
    nextSemanticShortcuts[token] = nextConfig;
  }

  return nextSemanticShortcuts;
}

function deriveFieldDefinitionForCtxCard(definition, prefix) {
  const nextDefinition = cloneValue(definition);

  // Search controls (unique/order/prefer/direction/lang) do not point at query
  // field paths directly, so they are intentionally left as-is here.
  if (nextDefinition.searchControl) {
    return nextDefinition;
  }

  nextDefinition.esPath = prefixPath(nextDefinition.esPath, prefix);
  nextDefinition.esPaths = prefixPathList(nextDefinition.esPaths, prefix);
  nextDefinition.exactEsPaths = prefixPathList(nextDefinition.exactEsPaths, prefix);
  nextDefinition.nestedContainers = prefixPathList(nextDefinition.nestedContainers, prefix);
  nextDefinition.tokenFieldMap = prefixTokenFieldMap(nextDefinition.tokenFieldMap, prefix);
  nextDefinition.semanticShortcuts = prefixSemanticShortcuts(nextDefinition.semanticShortcuts, prefix);

  return nextDefinition;
}

/**
 * Profile extension for nested card document layouts (`ctx.card`).
 *
 * @module scryfall-query-dsl/profiles/ctx-card
 */

/**
 * Derive field definitions with all ES field paths prefixed for a nested card document layout.
 *
 * In a `ctx.card` document, card data lives under a top-level `card` key, so field paths like
 * `"colors"` become `"card.colors"`. This function applies that prefix to every path in the
 * base field definitions.
 *
 * @param {object} [options]
 * @param {string} [options.prefix="card"] - The path prefix to apply. Must be a non-empty string.
 * @param {object} [options.baseFieldDefinitions] - Override the base field definitions to prefix.
 *   Defaults to `createDefaultFieldDefinitions()`.
 * @returns {Record<string, object>} Prefixed field definition map.
 * @throws {Error} If `prefix` is empty or not a string.
 */
export function deriveCtxCardFieldDefinitions(options = {}) {
  const {
    prefix = "card",
    baseFieldDefinitions = createDefaultFieldDefinitions(),
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

/**
 * Create a profile extension object for use with `engine.registerProfile()` that compiles
 * queries against a nested card document layout (all card fields under a `card.` prefix).
 *
 * This is the extension used internally to build the built-in `"ctx.card"` profile.
 * You can use it directly to create additional prefixed profiles with custom options.
 *
 * @param {object} [options]
 * @param {string} [options.prefix="card"] - The path prefix for all card field paths.
 * @param {object} [options.baseFieldDefinitions] - Override the base field definitions.
 * @returns {{ override: boolean, fields: Record<string, object> }} A field extension object.
 *
 * @example
 * import { createEngine, createCtxCardProfileExtension } from 'scryfall-query-dsl';
 * const engine = createEngine();
 * engine.registerProfile('nested-card', createCtxCardProfileExtension({ prefix: 'card' }));
 * const { dsl } = engine.compile('c:red', { profile: 'nested-card' });
 * // dsl queries against card.colors, card.color_identity, etc.
 */
export function createCtxCardProfileExtension(options = {}) {
  return {
    override: true,
    fields: deriveCtxCardFieldDefinitions(options),
  };
}
