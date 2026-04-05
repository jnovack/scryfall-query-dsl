/**
 * Browser-friendly Scryfall-style query parser and Elasticsearch DSL compiler.
 *
 * Quick start:
 * ```js
 * import { createEngine } from 'scryfall-query-dsl';
 * const engine = createEngine();
 * const { dsl, meta } = engine.compile('t:creature c:red');
 * ```
 *
 * The exported `compile*` functions are used when registering custom fields via
 * `engine.registerField()`. Choose the helper that matches your field's value type.
 *
 * Built-in profiles: `"default"` (flat document) and `"ctx.card"` (card fields under `card.` prefix).
 *
 * @module scryfall-query-dsl
 * @see module:scryfall-query-dsl/engine
 */
export { createEngine } from "./runtime/createEngine.js";
export {
  announceBrowserBuild,
  BUILD_DATE,
  RELEASE,
  VERSION,
} from "./runtime/version.js";
export {
  compileBooleanField,
  compileColorField,
  compileCollectorNumberField,
  compileDateField,
  compileLegalityField,
  compileKeywordField,
  compileIsShortcutField,
  compileNotShortcutField,
  compileOrderedKeywordField,
  compileSearchDirectionField,
  compileSearchLangField,
  compileSearchOrderField,
  compileSearchPreferField,
  compileSearchUniqueField,
  compileNumericField,
  compileYearField,
  parseColorExpression,
  compileTextField,
} from "./compiler/helpers.js";

import { announceBrowserBuild } from "./runtime/version.js";

announceBrowserBuild();
