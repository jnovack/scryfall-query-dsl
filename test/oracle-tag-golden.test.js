import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createDefaultFieldDefinitions } from "../src/fields/defaults.js";

// Cross-repo regression: proves this implementation's normalizeOracleTagValue
// agrees with moxfall's canonicalOracleTagTerm (Go) on moxfall's real corpus,
// not just on the 13 invented rows in .local/REFACTOR.md's contract table. A
// normalizer that forgot to collapse "_" would still pass that table's
// explicit "_ramp" row, but a raw-input regression over the real corpus is
// what actually exercises the full contract end to end.
//
// Both fixtures are copied verbatim from moxfall — see
// ../moxfall/test/fixtures/README.md §"Golden search-term corpus" for their
// derivation and update contract. This test only compares; it must never
// write either fixture, and a mismatch must fail rather than update the
// golden file (matching moxfall's own --update-golden-only write contract).

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIDECAR_PATH = join(__dirname, "fixtures", "oracle-tags.jsonl.gz");
const GOLDEN_PATH = join(__dirname, "fixtures", "oracle-tag-terms.golden");

function loadRawOracleTagRecords() {
  const gzipped = readFileSync(SIDECAR_PATH);
  const jsonl = gunzipSync(gzipped).toString("utf8");

  return jsonl
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function loadGoldenTerms() {
  return readFileSync(GOLDEN_PATH, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
}

test("otag.parseValue canonicalizes moxfall's raw oracle-tag corpus to match the golden file", () => {
  const { otag } = createDefaultFieldDefinitions();
  const records = loadRawOracleTagRecords();

  assert.ok(records.length > 0, "sidecar fixture must contain at least one record");

  const terms = new Set();

  for (const record of records) {
    // Raw slug/label/aliases, not the golden file's own output — comparing
    // pre-canonicalized golden output against itself would only prove
    // idempotence, not agreement on source normalization.
    terms.add(otag.parseValue(record.slug));
    terms.add(otag.parseValue(record.label));

    for (const alias of record.aliases ?? []) {
      terms.add(otag.parseValue(alias));
    }
  }

  const actual = Array.from(terms).sort();
  const expected = loadGoldenTerms();

  assert.deepEqual(actual, expected);
});
