import { createDefaultFieldDefinitions } from "../fields/defaults.js";
import { normalizeFieldDescriptor } from "../fields/descriptors.js";

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

  if (!definition.searchControl && !/^[@a-zA-Z0-9_.\-]+$/.test(definition.esPath)) {
    throw new Error(
      `Field "${name}" esPath "${definition.esPath}" contains invalid characters. Only letters, digits, underscores, dots, hyphens, and @ are allowed.`
    );
  }

  if (typeof definition.compile !== "function") {
    throw new Error(`Field "${name}" must define a "compile" function.`);
  }

  if (
    !definition.searchControl &&
    (!Array.isArray(definition.operators) || definition.operators.length === 0)
  ) {
    throw new Error(`Field "${name}" must define a non-empty "operators" array.`);
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

  /**
   * Group the live alias map by the field each alias currently resolves to.
   *
   * Deliberately not `definition.aliases`: `registerAlias()` and
   * `extend({ aliases })` write only to `aliases`, so a definition-derived list
   * would omit every runtime alias, and after an override reassigns an alias the
   * old definition still claims a spelling the compiler now sends elsewhere —
   * printing one alias on two cards. Reading the map keeps descriptors in step
   * with `resolveFieldName()`, which is the entire point of this API.
   *
   * Insertion order gives definition aliases first, then runtime additions.
   */
  function groupAliasesByField() {
    const byField = new Map();

    for (const [alias, fieldName] of aliases) {
      if (alias === fieldName) {
        continue;
      }

      const existing = byField.get(fieldName);
      if (existing) {
        existing.push(alias);
      } else {
        byField.set(fieldName, [alias]);
      }
    }

    return byField;
  }

  /**
   * Project every registered field into a doc-safe descriptor, in registration order.
   *
   * Internal: `createRegistry()` is not exported, so this is reached through
   * `engine.describeFields()`. Returned objects and arrays are fresh on every
   * call — a caller that mutates them must not be able to change what the
   * registry reports next.
   *
   * @returns {object[]} Descriptors as defined in `descriptors.js`.
   */
  function listFields() {
    const aliasesByField = groupAliasesByField();

    return [...fields.entries()].map(([name, definition]) =>
      normalizeFieldDescriptor(name, {
        aliases: aliasesByField.get(name) ?? [],
        operators: definition.operators,
        type: definition.type,
        description: definition.description,
        examples: definition.examples,
        searchControl: definition.searchControl,
      })
    );
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
    fields: createDefaultFieldDefinitions(),
  });

  return {
    extend,
    getField,
    listFields,
    parseValue,
    registerAlias,
    registerField,
    resolveFieldName,
  };
}
