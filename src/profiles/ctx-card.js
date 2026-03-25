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

function prefixSemanticShortcuts(semanticShortcuts, prefix) {
  if (!isPlainObject(semanticShortcuts)) {
    return semanticShortcuts;
  }

  const nextSemanticShortcuts = {};

  for (const [token, config] of Object.entries(semanticShortcuts)) {
    const nextConfig = cloneValue(config);
    nextConfig.legalityPath = prefixPath(nextConfig.legalityPath, prefix);
    nextConfig.typePaths = prefixPathList(nextConfig.typePaths, prefix);
    nextConfig.oraclePaths = prefixPathList(nextConfig.oraclePaths, prefix);
    nextConfig.powerPath = prefixPath(nextConfig.powerPath, prefix);
    nextConfig.toughnessPath = prefixPath(nextConfig.toughnessPath, prefix);
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
  nextDefinition.tokenFieldMap = prefixTokenFieldMap(nextDefinition.tokenFieldMap, prefix);
  nextDefinition.semanticShortcuts = prefixSemanticShortcuts(nextDefinition.semanticShortcuts, prefix);

  return nextDefinition;
}

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

export function createCtxCardProfileExtension(options = {}) {
  return {
    override: true,
    fields: deriveCtxCardFieldDefinitions(options),
  };
}
