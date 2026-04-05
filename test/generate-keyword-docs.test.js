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
