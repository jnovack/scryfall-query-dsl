import { createCompiler } from "../compiler/index.js";
import { createPrefixedControlConfig } from "../compiler/control-config.js";
import { createParser } from "../parser/index.js";
import { createCtxCardProfileExtension } from "../profiles/ctx-card.js";
import { createRegistry } from "../registry/index.js";

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
    parse(query) {
      return parser.parse(query);
    },
    compile(queryOrAst, options = {}) {
      const { profile = "default" } = options;
      const context = getProfileContext(profile);
      const ast = typeof queryOrAst === "string" ? parser.parse(queryOrAst) : queryOrAst;
      return context.compiler.compile(ast);
    },
    compileWithMeta(queryOrAst, options = {}) {
      const { profile = "default" } = options;
      const context = getProfileContext(profile);
      const ast = typeof queryOrAst === "string" ? parser.parse(queryOrAst) : queryOrAst;
      return context.compiler.compileWithMeta(ast);
    },
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
    extendProfile(name, extension) {
      const context = getProfileContext(name);
      context.registry.extend(extension);
      return this;
    },
    listProfiles() {
      return [...profiles.keys()];
    },
    extend(extension, options = {}) {
      const { profile = "default" } = options;
      const context = getProfileContext(profile);
      context.registry.extend(extension);
      return this;
    },
    registerAlias(alias, fieldName, options) {
      const profile = options?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerAlias(alias, fieldName, options);
      return this;
    },
    registerField(fieldName, definition, options) {
      const profile = options?.profile ?? "default";
      const context = getProfileContext(profile);
      context.registry.registerField(fieldName, definition, options);
      return this;
    },
    resolveFieldName(nameOrAlias, options = {}) {
      const { profile = "default" } = options;
      const context = getProfileContext(profile);
      return context.registry.resolveFieldName(nameOrAlias);
    },
  };
}
