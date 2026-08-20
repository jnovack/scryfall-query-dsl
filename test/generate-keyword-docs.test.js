import test from "node:test";
import assert from "node:assert/strict";

import { buildKeywordDocsHtml } from "../scripts/generate-keyword-docs.mjs";

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
