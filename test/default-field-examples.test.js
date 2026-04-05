import test from "node:test";
import assert from "node:assert/strict";

import { createEngine } from "../src/index.js";
import { createDefaultFieldDefinitions } from "../src/fields/defaults.js";

test("all createDefaultFieldDefinitions examples compile", () => {
  const engine = createEngine();
  const definitions = createDefaultFieldDefinitions();

  for (const [fieldName, definition] of Object.entries(definitions)) {
    for (const example of definition.examples ?? []) {
      try {
        const result = engine.compile(example);
        assert.deepEqual(
          result.meta?.terms?.invalid ?? [],
          [],
          `Example produced invalid terms for field "${fieldName}": ${example}`
        );
      } catch (error) {
        assert.fail(
          `Example failed to compile for field "${fieldName}": ${example}\n${error?.message ?? String(error)}`
        );
      }
    }
  }
});
