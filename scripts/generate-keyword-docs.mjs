/**
 * generate-keyword-docs.mjs
 *
 * Reads field definitions from src/fields/defaults.js at build time and emits
 * website/keywords.html — a standalone keyword reference page.
 *
 * Section order and headings mirror the Scryfall syntax documentation page
 * (https://scryfall.com/docs/syntax). Implemented fields are shown in full;
 * unimplemented syntax items appear grayed out.
 *
 * Usage: node scripts/generate-keyword-docs.mjs
 *
 * Adding a new field with `description` and `examples` properties to
 * src/fields/defaults.js is all that's needed for it to appear here.
 *
 * The section skeleton itself lives in src/fields/groups.js (KEYWORD_GROUPS),
 * not here, because it ships in the browser bundle for engine.describeFields().
 * This file renders it; it does not own it.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createDefaultFieldDefinitions } from "../src/fields/defaults.js";
import { assembleGroups, KEYWORD_GROUPS } from "../src/fields/groups.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../website");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "index.html");

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(text, cls = "badge-name") {
  return `<code class="badge ${cls}">${escapeHtml(text)}</code>`;
}

function operatorBadge(op) {
  return `<code class="badge badge-op">${escapeHtml(op)}</code>`;
}

// ---------------------------------------------------------------------------
// Card renderers
// ---------------------------------------------------------------------------

function renderField(name, def) {
  const allNames = [name, ...(def.aliases || []).filter((a) => a !== name)];
  const nameBadges = allNames.map((n) => badge(n, "badge-name")).join(" ");
  const opBadges = (def.operators || []).map(operatorBadge).join(" ");
  const description = def.description
    ? `<p class="field-desc">${escapeHtml(def.description)}</p>`
    : "";
  const examples =
    def.examples && def.examples.length
      ? `<div class="field-examples"><span class="examples-label">Examples</span><ul>${def.examples.map((e) => `<li><code>${escapeHtml(e)}</code></li>`).join("")}</ul></div>`
      : "";

  return `
    <div class="field-card card border-secondary-subtle bg-body-tertiary text-body-emphasis shadow-sm" id="field-${escapeHtml(name)}">
      <div class="field-header d-flex align-items-center flex-wrap gap-2">
        <span class="field-names">${nameBadges}</span>
        <span class="field-ops ms-auto d-flex gap-1 flex-wrap">${opBadges}</span>
      </div>
      ${description}
      ${examples}
    </div>`;
}

function renderNote(group) {
  return `
    <div class="field-card field-card--note card border-success-subtle bg-body-tertiary text-body-emphasis shadow-sm">
      <span class="supported-badge"><i class="fa-solid fa-circle-check me-1" aria-hidden="true"></i>Supported</span>
      <p class="field-desc">${escapeHtml(group.note)}</p>
    </div>`;
}

function renderUnsupported(item) {
  return `
    <div class="field-card field-card--unsupported card border-secondary-subtle bg-body-tertiary text-body-emphasis shadow-sm">
      <div class="field-header d-flex align-items-center flex-wrap gap-2">
        <span class="field-names">${badge(item.label, "badge-name badge-unsupported")}</span>
        <span class="unsupported-tag ms-auto"><i class="fa-solid fa-triangle-exclamation me-1" aria-hidden="true"></i>Not implemented</span>
      </div>
      <p class="field-desc">${escapeHtml(item.description)}</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function renderGroup(group, fieldDefs) {
  const noteCard = group.note ? renderNote(group) : "";

  // No filter on unknown names: assembleGroups() has already thrown on any name
  // that resolves to neither a field nor a synthetic. Filtering here again would
  // restore the silent short-render that made group typos invisible.
  const fieldCards = (group.fields || [])
    .map((name) => renderField(name, fieldDefs[name]))
    .join("");

  const unsupportedCards = (group.unsupported || [])
    .map(renderUnsupported)
    .join("");

  const body = noteCard + fieldCards + unsupportedCards;

  return `
  <section class="group" id="${escapeHtml(group.id)}">
    <h2>${escapeHtml(group.label)}</h2>
    ${body ? `<div class="field-list">${body}</div>` : ""}
  </section>`;
}

function buildDocFieldDefinitions(baseFieldDefs, groups) {
  const docFieldDefs = { ...baseFieldDefs };

  for (const group of groups) {
    for (const supported of group.supported || []) {
      if (!supported || typeof supported.name !== "string" || !supported.name.trim()) {
        continue;
      }

      const name = supported.name.trim();
      docFieldDefs[name] = {
        aliases: Array.isArray(supported.aliases) ? supported.aliases : [],
        operators: Array.isArray(supported.operators) ? supported.operators : [":", "="],
        description: typeof supported.description === "string" ? supported.description : "",
        examples: Array.isArray(supported.examples) ? supported.examples : [],
      };
    }
  }

  return docFieldDefs;
}

/**
 * Render the keyword reference page.
 *
 * Group membership comes from `assembleGroups()`, the same helper
 * `engine.describeFields()` uses, so the page and the runtime reference cannot
 * drift apart — including the trailing `Other Fields` section, which is how a
 * field that was added without a group stays visible instead of being warned
 * about and dropped.
 *
 * The parameters exist for tests: they need to render a fixture with an
 * ungrouped field, and KEYWORD_GROUPS is frozen precisely so nobody can inject
 * one by mutation.
 *
 * @param {object} [options]
 * @param {Record<string, object>} [options.fieldDefinitions] - Field definitions to render.
 * @param {object[]} [options.groups] - Group skeleton to render.
 * @returns {string} The complete HTML document.
 */
export function buildKeywordDocsHtml(options = {}) {
  const baseFieldDefs = options.fieldDefinitions ?? createDefaultFieldDefinitions();
  const groups = options.groups ?? KEYWORD_GROUPS;
  const fieldDefs = buildDocFieldDefinitions(baseFieldDefs, groups);
  const assembledGroups = assembleGroups(Object.keys(baseFieldDefs), groups);

  const sections = assembledGroups.map((g) => renderGroup(g, fieldDefs)).join("");

  const nav = assembledGroups
    .map((g) => `<li><a href="#${escapeHtml(g.id)}">${escapeHtml(g.label)}</a></li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Keyword Reference — scryfall-query-dsl</title>
  <link
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"
    rel="stylesheet"
    integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB"
    crossorigin="anonymous"
  />
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
    integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  />
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --bg: #0f1218;
      --surface: #22262e;
      --border: #2e3340;
      --text: #d4d8e2;
      --text-muted: #8b92a5;
      --accent: #4e9af1;
      --badge-name-bg: #1e3a5f;
      --badge-name-text: #7ec4ff;
      --badge-op-bg: #2a2030;
      --badge-op-text: #c084fc;
      --code-bg: #161920;
      --nav-width: 240px;
    }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(180deg, #0f1218 0%, #141923 100%);
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }

    nav {
      position: fixed;
      top: 0;
      left: 0;
      width: var(--nav-width);
      height: 100vh;
      overflow-y: auto;
      background: rgba(26, 29, 36, 0.98);
      border-right: 1px solid rgba(148, 163, 184, 0.2);
      padding: 1.5rem 1rem;
    }

    nav h1 {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin: 0 0 1rem;
    }

    nav ul { list-style: none; margin: 0; padding: 0; }
    nav li { margin: 0.2rem 0; }
    nav a {
      display: block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.8rem;
      transition: color 0.15s, background 0.15s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    nav a:hover { color: var(--text); background: var(--border); }

    main {
      margin-left: var(--nav-width);
      padding: 2rem 3rem;
      max-width: 900px;
      width: 100%;
    }

    main > header { margin-bottom: 2.5rem; }
    main > header h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
    main > header p { color: var(--text-muted); margin: 0; line-height: 1.6; }
    main > header a { color: var(--accent); }

    section.group { margin-bottom: 2.5rem; }
    section.group h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .field-list { display: flex; flex-direction: column; gap: 0.6rem; }

    .field-card {
      border-radius: 8px;
      padding: 0.85rem 1.1rem;
    }

    /* Grayed-out card for unimplemented syntax */
    .field-card--unsupported {
      opacity: 0.4;
    }

    /* Dashed border for "supported parser feature" notes */
    .field-card--note {
      border-style: dashed;
    }

    .field-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.4rem;
    }

    .badge {
      display: inline-block;
      padding: 0.2em 0.55em;
      border-radius: 999px;
      font-size: 0.82rem;
      font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
      border: 1px solid transparent;
    }

    .badge-name {
      background: var(--badge-name-bg);
      color: var(--badge-name-text);
      border-color: rgba(126, 196, 255, 0.35);
    }

    .badge-unsupported {
      background: #252830;
      color: #fff;
    }

    .badge-op {
      background: var(--badge-op-bg);
      color: var(--badge-op-text);
    }

    .field-ops { margin-left: auto; display: flex; gap: 0.25rem; flex-wrap: wrap; }

    .field-desc {
      margin: 0.4rem 0 0.6rem;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text);
    }

    .field-card--unsupported .field-desc {
      color: var(--text-muted);
    }

    .unsupported-tag {
      font-size: 0.72rem;
      color: #f8fafc;
      margin-left: auto;
      font-style: italic;
      white-space: nowrap;
    }

    .supported-badge {
      display: inline-block;
      padding: 0.2em 0.6em;
      border-radius: 4px;
      background: #1a3a1a;
      color: #6dbf6d;
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
    }

    .field-examples { margin-top: 0.4rem; }
    .examples-label {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .field-examples ul {
      list-style: none;
      margin: 0.3rem 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .field-examples li code {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.2em 0.5em;
      font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
      font-size: 0.8rem;
      color: var(--text);
    }

    @media (max-width: 700px) {
      nav { display: none; }
      main { margin-left: 0; padding: 1.5rem; }
      .field-ops { margin-left: 0; }
    }
  </style>
</head>
<body data-bs-theme="dark" class="bg-dark text-light">
  <nav>
    <h1><i class="fa-solid fa-layer-group me-2" aria-hidden="true"></i>Keyword Reference</h1>
    <ul>
      ${nav}
    </ul>
  </nav>
  <main>
    <header>
      <h1><i class="fa-solid fa-magnifying-glass me-2" aria-hidden="true"></i>Keyword Reference</h1>
      <p>
        Supported query fields for <strong>scryfall-query-dsl</strong>, ordered to match the
        <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener">Scryfall syntax page</a>.
        Grayed-out entries are recognized by Scryfall but not yet implemented in this library.
        See <a href="index.html"><i class="fa-solid fa-book-open-reader me-1" aria-hidden="true"></i>API documentation</a> for integrating the engine.
      </p>
    </header>
    ${sections}
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function generateKeywordDocs() {
  const html = buildKeywordDocsHtml();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, html, "utf8");
  console.log(`keyword reference written to ${OUTPUT_FILE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateKeywordDocs();
}
