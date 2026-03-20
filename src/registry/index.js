import { createDefaultFieldDefinitions } from "../fields/defaults.js";

function cloneFieldDefinition(definition) {
  return {
    ...definition,
    aliases: [...(definition.aliases ?? [])],
  };
}

function assertFieldDefinition(name, definition) {
  if (!definition || typeof definition !== "object") {
    throw new Error(`Field "${name}" must be an object.`);
  }

  if (!definition.searchControl && (typeof definition.esPath !== "string" || !definition.esPath)) {
    throw new Error(`Field "${name}" must define a non-empty "esPath".`);
  }

  if (typeof definition.compile !== "function") {
    throw new Error(`Field "${name}" must define a "compile" function.`);
  }
}

export function createRegistry() {
  const fields = new Map();
  const aliases = new Map();

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
      for (const alias of [name, ...(previous.aliases ?? [])]) {
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

    if (!definition.aliases.includes(alias)) {
      definition.aliases.push(alias);
    }
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
    fields: createDefaultFieldDefinitions(),
  });

  return {
    extend,
    getField,
    parseValue,
    registerAlias,
    registerField,
    resolveFieldName,
  };
}
