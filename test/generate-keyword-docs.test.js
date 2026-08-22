import test from "node:test";
import assert from "node:assert/strict";

import { buildKeywordDocsHtml } from "../scripts/generate-keyword-docs.mjs";
import { collectSyntheticFields, KEYWORD_GROUPS } from "../src/fields/groups.js";
import { createDefaultFieldDefinitions } from "../src/fields/defaults.js";

function extractSection(html, sectionId) {
  const pattern = new RegExp(`<section class="group" id="${sectionId}">[\\s\\S]*?<\\/section>`);
  return html.match(pattern)?.[0] ?? "";
}

test("border-frame renders is:foil and is:nonfoil as supported cards", () => {
  const html = buildKeywordDocsHtml();
  const borderFrameSection = extractSection(html, "border-frame");

  assert.ok(borderFrameSection.length > 0, "Expected border-frame section to exist.");

  // Supported card rendering should use the standard supported field-card template.
  assert.match(borderFrameSection, /id="field-is:foil"/);
  assert.match(borderFrameSection, /id="field-is:nonfoil"/);
  assert.match(borderFrameSection, /<span class="field-names"><code class="badge badge-name">is:foil<\/code><\/span>/);
  assert.match(borderFrameSection, /<span class="field-names"><code class="badge badge-name">is:nonfoil<\/code><\/span>/);

  // They must no longer appear as unsupported entries.
  assert.doesNotMatch(borderFrameSection, /badge-name badge-unsupported">is:foil<\/code>/);
  assert.doesNotMatch(borderFrameSection, /badge-name badge-unsupported">is:nonfoil<\/code>/);

  // Existing unsupported entries in this section remain unsupported.
  assert.match(borderFrameSection, /badge-name badge-unsupported">is:hires<\/code>/);
  assert.match(borderFrameSection, /badge-name badge-unsupported">stamp:<\/code>/);
});

test("tagger-tags renders otag as a single supported card with its oracletag/function aliases", () => {
  const html = buildKeywordDocsHtml();
  const taggerTagsSection = extractSection(html, "tagger-tags");

  assert.ok(taggerTagsSection.length > 0, "Expected tagger-tags section to exist.");

  // otag renders as one supported field card carrying all three name badges
  // (otag plus its oracletag/function aliases), not three separate cards.
  assert.match(taggerTagsSection, /id="field-otag"/);
  assert.match(
    taggerTagsSection,
    /<span class="field-names"><code class="badge badge-name">otag<\/code> <code class="badge badge-name">oracletag<\/code> <code class="badge badge-name">function<\/code><\/span>/
  );

  // None of the three names may appear as an unsupported entry.
  assert.doesNotMatch(taggerTagsSection, /badge-name badge-unsupported">otag<\/code>/);
  assert.doesNotMatch(taggerTagsSection, /badge-name badge-unsupported">oracletag<\/code>/);
  assert.doesNotMatch(taggerTagsSection, /badge-name badge-unsupported">function:<\/code>/);
  assert.doesNotMatch(taggerTagsSection, /badge-name badge-unsupported">function<\/code>/);

  // art:/atag: remain unsupported.
  assert.match(taggerTagsSection, /badge-name badge-unsupported">art:<\/code>/);
  assert.match(taggerTagsSection, /badge-name badge-unsupported">atag:<\/code>/);
});

// KEYWORD_GROUPS is a public export shared by the docs generator and
// engine.describeFields(). If a consumer could mutate it, one sort() or push()
// would change what every engine instance in that realm reports thereafter, so
// the data is deep-frozen at module load. This test fails the moment the freeze
// is dropped or a newly nested structure is missed by it.
test("KEYWORD_GROUPS is deep-frozen, so a consumer cannot mutate engine output", () => {
  const before = JSON.parse(JSON.stringify(KEYWORD_GROUPS));

  assert.throws(() => KEYWORD_GROUPS.push({ id: "injected" }), TypeError);
  assert.throws(() => {
    KEYWORD_GROUPS[0].label = "mutated";
  }, TypeError);
  assert.throws(() => KEYWORD_GROUPS[0].fields.push("injected"), TypeError);
  assert.throws(() => KEYWORD_GROUPS[0].unsupported.push({ label: "injected" }), TypeError);

  const grouped = KEYWORD_GROUPS.find((group) => (group.unsupported || []).length > 0);
  assert.throws(() => {
    grouped.unsupported[0].label = "mutated";
  }, TypeError);

  const withSupported = KEYWORD_GROUPS.find((group) => (group.supported || []).length > 0);
  assert.throws(() => {
    withSupported.supported[0].name = "mutated";
  }, TypeError);

  assert.deepEqual(JSON.parse(JSON.stringify(KEYWORD_GROUPS)), before);
});

// The generator used to warn about ungrouped fields and then render without
// them, so a field added without a group appeared in consumers' references (via
// describeFields) and stayed missing from this library's own page. Driving this
// from a fixture rather than from today's defaults matters: asserting "the
// defaults have no orphans" passes forever while the page silently drops the
// next unassigned field.
test("an ungrouped field renders under Other Fields instead of being dropped", () => {
  const html = buildKeywordDocsHtml({
    fieldDefinitions: {
      colors: {
        aliases: ["c"],
        operators: [":"],
        description: "Match card colors.",
        examples: ["c:red"],
      },
      deck_count: {
        aliases: [],
        operators: [">"],
        description: "Number of decks running this card.",
        examples: ["deck_count>100"],
      },
    },
    groups: [{ id: "colors", label: "Colors", fields: ["colors"], unsupported: [] }],
  });

  const otherSection = extractSection(html, "other");

  assert.ok(otherSection.length > 0, "Expected an Other Fields section for the ungrouped field.");
  assert.match(otherSection, /<h2>Other Fields<\/h2>/);
  assert.match(otherSection, /id="field-deck_count"/);
  assert.match(otherSection, /Number of decks running this card\./);
  assert.match(html, /<li><a href="#other">Other Fields<\/a><\/li>/);
});

test("the generated page has no Other Fields section while every built-in is grouped", () => {
  const html = buildKeywordDocsHtml();

  assert.equal(extractSection(html, "other"), "");
});

// Semantic shortcuts are hand-written semantics a consumer cannot infer from a
// field definition: is:commander is not a token, it is a compiled legality +
// type-line + P/T check. Four of the five were discoverable only by reading the
// is: field's prose. This test is what keeps shortcut six from repeating that.
test("every is: semantic shortcut has a card in the keyword groups", () => {
  const definitions = createDefaultFieldDefinitions();
  const shortcuts = Object.keys(definitions.is.semanticShortcuts);
  const documented = collectSyntheticFields();

  for (const shortcut of shortcuts) {
    assert.ok(
      documented.has(`is:${shortcut}`),
      `is:${shortcut} compiles but has no supported card in src/fields/groups.js`
    );
  }
});
