/**
 * changelog-release.mjs
 *
 * Promotes the accumulated `## [Unreleased]` section to a released version
 * heading. Called by `.githooks/version write`, which `git release` invokes
 * before tagging.
 *
 * Work lands under Unreleased because the version number is not known until
 * release time — the tag decides it. Writing a version heading by hand during
 * development is how the manifest and the tag line drifted apart before.
 *
 * Usage: node scripts/changelog-release.mjs 0.3.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHANGELOG = resolve(__dirname, "../CHANGELOG.md");

const UNRELEASED_HEADING = "## [Unreleased]";
const PLACEHOLDER = "- No unreleased entries yet.";

function fail(message) {
  console.error(`changelog-release: ${message}`);
  process.exit(1);
}

export function promoteUnreleased(markdown, version, date) {
  const start = markdown.indexOf(`${UNRELEASED_HEADING}\n`);

  if (start === -1) {
    fail(`no "${UNRELEASED_HEADING}" section found in CHANGELOG.md`);
  }

  if (markdown.includes(`## [${version}]`)) {
    fail(`CHANGELOG.md already has a section for ${version}`);
  }

  const bodyStart = start + `${UNRELEASED_HEADING}\n`.length;
  const nextHeading = markdown.indexOf("\n## ", bodyStart);
  const bodyEnd = nextHeading === -1 ? markdown.length : nextHeading + 1;
  const body = markdown.slice(bodyStart, bodyEnd);

  if (!body.replace(PLACEHOLDER, "").trim()) {
    fail("nothing to release: the Unreleased section is empty");
  }

  const released = `## [${version}] - ${date}\n${body.replace(`${PLACEHOLDER}\n`, "")}`;

  return (
    markdown.slice(0, bodyStart) +
    `\n${PLACEHOLDER}\n\n` +
    released +
    markdown.slice(bodyEnd)
  );
}

const version = process.argv[2];

if (!version) {
  fail("usage: node scripts/changelog-release.mjs <x.y.z>");
}

// Local date, not UTC: an evening release would otherwise be stamped with
// tomorrow's date and disagree with the commit it ships in.
const now = new Date();
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");
const markdown = readFileSync(CHANGELOG, "utf8");

writeFileSync(CHANGELOG, promoteUnreleased(markdown, version, date));
console.log(`changelog-release: CHANGELOG.md now records ${version} (${date})`);
