/**
 * descriptors.js — the doc-safe field descriptor shape.
 *
 * One normalization function produces every descriptor returned by
 * `registry.listFields()` and `engine.describeFields()`, whether it comes from a
 * registered field definition or from a `supported` synthetic entry in
 * `groups.js`. Both classes must emerge with the *same own-property set*:
 * consumers index the payload directly, and a descriptor missing `name` is
 * dropped on the floor rather than rendered (moxfall's `normalizeReference()`
 * filters nameless fields), so a half-shaped synthetic disappears silently from
 * the very reference this API exists to keep honest.
 *
 * The shape is an allowlist on purpose. Building it by cloning a definition and
 * deleting internal keys would start leaking `esPath`, `compile`, or whatever
 * property is added next — a denylist fails open, this fails closed.
 *
 * Browser-safe: data and pure functions only.
 */

/**
 * Build a doc-safe descriptor.
 *
 * Every key is always present, so consumers never branch on `undefined`. The
 * registry validator requires neither `type` nor (for search controls)
 * `operators`, so both have defaults rather than being assumed.
 *
 * @param {string} name - Canonical field name (or synthetic label such as `is:foil`).
 * @param {object} [source] - Values to project: `aliases`, `operators`, `type`,
 *   `description`, `examples`, `searchControl`. Anything else is ignored.
 * @param {object} [options]
 * @param {string[]} [options.defaultOperators=[]] - Operators to use when `source`
 *   defines none. Synthetics pass `[":", "="]` to match what the generated page
 *   has always shown for them.
 * @returns {object} A fully populated descriptor whose arrays are fresh copies.
 */
export function normalizeFieldDescriptor(name, source = {}, options = {}) {
  const { defaultOperators = [] } = options;

  const canonicalName = String(name);
  const aliases = (Array.isArray(source.aliases) ? source.aliases : [])
    .map(String)
    .filter((alias) => alias !== canonicalName);

  const operators = Array.isArray(source.operators) && source.operators.length
    ? source.operators.map(String)
    : [...defaultOperators];

  return {
    name: canonicalName,
    names: [canonicalName, ...aliases],
    aliases,
    operators,
    type: typeof source.type === "string" ? source.type : "",
    description: typeof source.description === "string" ? source.description : "",
    examples: (Array.isArray(source.examples) ? source.examples : []).map(String),
    searchControl: Boolean(source.searchControl),
  };
}

/** Operators shown for `supported` synthetics, which carry none of their own. */
export const SYNTHETIC_OPERATORS = [":", "="];
