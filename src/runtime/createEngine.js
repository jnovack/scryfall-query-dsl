import { createCompiler } from "../compiler/index.js";
import { createPrefixedControlConfig } from "../compiler/control-config.js";
import { createParser } from "../parser/index.js";
import { createCtxCardProfileExtension } from "../profiles/ctx-card.js";
import { createRegistry } from "../registry/index.js";
import { RELEASE } from "./version.js";

function createCompilationContext({ extension, controlConfig } = {}) {
  const registry = createRegistry();

  if (extension) {
    registry.extend(extension);
  }

  const compiler = createCompiler({ registry, controlConfig });

  return {
    registry,
    compiler,
  };
}

/**
 * Engine factory and engine instance API.
 *
 * @module scryfall-query-dsl/engine
 */

/**
 * @typedef {object} CompileMeta
 * @property {{ valid: string[], invalid: string[] }} terms - Shortcut terms encountered during compilation.
 * @property {string[]} warnings - Non-fatal warnings generated during compilation.
 */

/**
 * @typedef {object} CompileResult
 * @property {object} dsl - The compiled Elasticsearch query DSL object.
 * @property {CompileMeta} meta - Metadata about the compilation.
 */

/**
 * @typedef {object} FieldDefinition
 * @property {string[]} [aliases] - Alternative names that resolve to this field.
 * @property {string} [esPath] - Primary Elasticsearch field path.
 * @property {string[]} [esPaths] - Multiple ES paths searched together (multi-match).
 * @property {string[]} operators - Supported operators (`:`, `=`, `!=`, `>`, `>=`, `<`, `<=`).
 * @property {string} type - Value type: `"text"`, `"keyword"`, `"number"`, `"boolean"`, `"color-set"`, `"date"`, or `"control"`.
 * @property {string} [description] - Human-readable description (rendered in the keyword reference page).
 * @property {string[]} [examples] - Example query strings (rendered in the keyword reference page).
 * @property {Function} compile - Compiler function that produces an ES clause from a parsed node.
 * @property {Function} [parseValue] - Value parser/validator called before compilation.
 */

/**
 * @typedef {object} FieldExtension
 * @property {boolean} [override] - If true, field definitions replace existing ones instead of merging.
 * @property {Record<string, FieldDefinition>} fields - Map of field name to field definition.
 */

/**
 * @typedef {object} Engine
 * @property {string} version - Library release version string.
 */

/**
 * Create a new query engine instance.
 *
 * The engine ships with two built-in profiles:
 * - `"default"` — standard flat Scryfall-style document layout
 * - `"ctx.card"` — nested layout where all card fields are prefixed with `card.`
 *
 * NOTE: The default profile's controlConfig cannot be customized at `createEngine()` time.
 * Only `extension` is accepted here. To use a custom controlConfig for the default profile,
 * create a separate engine instance or use `createPrefixedControlConfig()` when building a
 * named profile via `registerProfile()`. Omitting this option silently uses
 * `DEFAULT_CONTROL_CONFIG`, which may emit incorrect field paths if your ES index differs.
 *
 * @param {object} [options]
 * @param {FieldExtension} [options.extension] - Field definitions to merge into the default profile at startup.
 * @returns {Engine} A configured engine instance.
 *
 * @example
 * import { createEngine } from 'scryfall-query-dsl';
 * const engine = createEngine();
 * const { dsl } = engine.compile('t:creature c:red');
 */
export function createEngine(options = {}) {
  const parser = createParser();
  const profiles = new Map();

  profiles.set("default", createCompilationContext({ extension: options.extension }));
  profiles.set(
    "ctx.card",
    createCompilationContext({
      extension: createCtxCardProfileExtension(),
      controlConfig: createPrefixedControlConfig("card"),
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
    registerProfile(name, extension = {}, options = {}) {
      if (!name || typeof name !== "string") {
        throw new Error("Profile name must be a non-empty string.");
      }

      const { override = false } = options;
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
    extend(extension, options = {}) {
      const { profile = "default" } = options;
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
    registerAlias(alias, fieldName, options) {
      const profile = options?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerAlias(alias, fieldName, options);
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
    registerField(fieldName, definition, options) {
      const profile = options?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerField(fieldName, definition, options);
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
    resolveFieldName(nameOrAlias, options = {}) {
      const { profile = "default" } = options;
      const context = getProfileContext(profile);
      return context.registry.resolveFieldName(nameOrAlias);
    },
  };
}
