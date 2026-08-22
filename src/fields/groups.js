/**
 * groups.js — the keyword reference's section skeleton.
 *
 * This data lives in `src/` rather than in `scripts/generate-keyword-docs.mjs`,
 * its only in-repo renderer, because it ships in the browser bundle: consumers
 * render the same reference the generated page shows by calling
 * `engine.describeFields()`, and a copy inside a build script is unreachable
 * from a browser. Moving it back next to the renderer would force every
 * consumer to hand-copy it again, which is the drift this module exists to end.
 *
 * Browser-safe by contract: data and pure functions only — no `node:` imports,
 * no `fs`, no HTML. The HTML templating stays in `scripts/`.
 */

// ---------------------------------------------------------------------------
// Group definitions — 27 sections matching Scryfall's syntax page order.
//
// Each group may contain:
//   fields      — implemented field names (from createDefaultFieldDefinitions())
//   supported   — docs-only synthetic supported entries rendered with the same card template
//   note        — short "Supported" note for parser-level features (-, or, grouping)
//   unsupported — grayed-out items for unimplemented Scryfall syntax
// ---------------------------------------------------------------------------

/**
 * Recursively freeze arrays and plain objects.
 *
 * `KEYWORD_GROUPS` is a public export, and ES module bindings are immutable
 * while the objects they name are not. Without this, one consumer calling
 * `KEYWORD_GROUPS.sort()` or pushing into a nested `fields` array would change
 * what every engine instance in that realm reports thereafter, and could turn
 * the deliberate missing-name throw in group assembly into a crash nobody can
 * trace back. Freezing here rather than at the engine layer means the guarantee
 * also covers the docs generator and any assembly path added later.
 */
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }

  return Object.freeze(value);
}

export const KEYWORD_GROUPS = deepFreeze([
  {
    id: "colors",
    label: "Colors and Color Identity",
    fields: ["colors", "color_identity"],
    unsupported: [
      { label: "has:indicator", description: "Cards that have a color indicator on the card face" },
    ],
  },
  {
    id: "card-types",
    label: "Card Types",
    fields: ["type_line"],
    unsupported: [],
  },
  {
    id: "card-text",
    label: "Card Text",
    fields: ["oracle_text", "keywords"],
    unsupported: [
      { label: "fo:", description: "Full oracle text search with reminder text excluded" },
      { label: "o:/regex/", description: "Regular expression search on oracle text" },
      { label: "~ substitution", description: "Use ~ in oracle text queries to stand for the card's own name" },
    ],
  },
  {
    id: "mana-costs",
    label: "Mana Costs",
    fields: ["mana_value"],
    unsupported: [
      { label: "m:", description: "Mana cost expression using mana symbols (e.g. m:{G}{U}, m>3WU)" },
      { label: "produces:", description: "Mana produced by a land or ability (e.g. produces=wu)" },
      { label: "devotion:", description: "Devotion to a color (e.g. devotion:{u/b}{u/b})" },
      { label: "manavalue:odd / manavalue:even", description: "Cards with odd or even mana value" },
    ],
  },
  {
    id: "power-toughness-loyalty",
    label: "Power, Toughness, and Loyalty",
    fields: ["power", "toughness"],
    unsupported: [
      { label: "loyalty / loy:", description: "Planeswalker loyalty (e.g. loy=3, loy>=4)" },
      { label: "pt: / powtou:", description: "Combined power+toughness comparison (e.g. pt=10)" },
      { label: "pow>tou", description: "Cross-field power vs. toughness math comparisons" },
    ],
  },
  {
    id: "multi-faced",
    label: "Multi-faced Cards",
    fields: [],
    unsupported: [
      { label: "is:split", description: "Split cards (Fire // Ice)" },
      { label: "is:flip", description: "Flip cards (Budoka Gardener)" },
      { label: "is:transform", description: "Transform (DFC) cards" },
      { label: "is:meld", description: "Meld cards" },
      { label: "is:mdfc", description: "Modal double-faced cards" },
      { label: "is:adventure", description: "Adventure cards" },
      { label: "is:reversible", description: "Reversible cards" },
    ],
  },
  {
    id: "effects",
    label: "Spells, Permanents, and Effects",
    fields: ["is:spell", "not:spell"],
    supported: [
      {
        name: "is:spell",
        operators: [":", "="],
        description: "Cards with major spell/permanent/battle type lines: creature, artifact, instant, sorcery, enchantment, planeswalker, or battle.",
        examples: ["is:spell"],
      },
      {
        name: "not:spell",
        operators: [":", "="],
        description: "Exclude cards matching the is:spell type-line disjunction.",
        examples: ["not:spell"],
      },
    ],
    unsupported: [
      { label: "is:permanent", description: "Permanent card types (creature, artifact, enchantment, planeswalker, land)" },
      { label: "is:historic", description: "Legendary, artifact, or Saga cards" },
      { label: "is:vanilla", description: "Creatures with no abilities" },
      { label: "is:modal", description: "Cards with modal effects (choose one, choose two, etc.)" },
    ],
  },
  {
    id: "extra-funny",
    label: "Extra Cards and Funny Cards",
    fields: [],
    unsupported: [
      { label: "is:funny", description: "Un-set and acorn-stamped cards" },
      { label: "include:extras", description: "Include extra cards (tokens, emblems, art cards) in results" },
      { label: "is:oversized", description: "Oversized card products" },
    ],
  },
  {
    id: "rarity",
    label: "Rarity",
    fields: ["rarity"],
    unsupported: [
      { label: "new:rarity", description: "Cards whose rarity changed from their previous printing" },
    ],
  },
  {
    id: "sets",
    label: "Sets and Blocks",
    fields: ["set", "set_type", "collector_number"],
    unsupported: [
      { label: "e: / edition:", description: "Alias for set: (not yet a built-in alias)" },
      { label: "b: / block:", description: "Filter by block code or name (e.g. b:wwk)" },
    ],
  },
  {
    id: "cubes",
    label: "Cubes",
    fields: [],
    unsupported: [
      { label: "cube:", description: "Cards in a specific Scryfall cube (e.g. cube:vintage, cube:legacy)" },
    ],
  },
  {
    id: "legality",
    label: "Format Legality",
    fields: ["legal", "banned", "restricted"],
    unsupported: [],
  },
  {
    id: "prices",
    label: "USD/EUR/TIX Prices",
    fields: ["usd", "eur", "tix"],
    unsupported: [
      { label: "cheapest:", description: "Cheapest printing in a given currency (e.g. cheapest:usd)" },
    ],
  },
  {
    id: "artist-flavor",
    label: "Artist, Flavor Text and Watermark",
    fields: ["flavor_text"],
    unsupported: [
      { label: "a: / artist:", description: "Search by artist name (e.g. a:\"proce\")" },
      { label: "wm: / watermark:", description: "Filter by watermark guild or symbol (e.g. wm:orzhov)" },
      { label: "artists>1", description: "Cards illustrated by more than one artist" },
      { label: "illustrations>1", description: "Cards with more than one illustration" },
      { label: "new:art / new:artist / new:flavor", description: "Cards with new art, new artist, or new flavor text vs. previous printing" },
    ],
  },
  {
    id: "border-frame",
    label: "Border, Frame, Foil and Resolution",
    fields: ["border_color", "frame", "is:foil", "is:nonfoil"],
    supported: [
      {
        name: "is:foil",
        operators: [":", "="],
        description: "Cards available in foil.",
        examples: ["is:foil"],
      },
      {
        name: "is:nonfoil",
        operators: [":", "="],
        description: "Cards available in non-foil.",
        examples: ["is:nonfoil"],
      },
    ],
    unsupported: [
      { label: "is:hires", description: "Cards with high-resolution scan imagery" },
      { label: "stamp:", description: "Filter by security stamp (acorn, arena, oval, triangle, etc.)" },
    ],
  },
  {
    id: "games-promos",
    label: "Games, Promos and Spotlights",
    // is:promo, is:spotlight and is:digital compile as semantic shortcuts under
    // is:, but a reader looking for promos looks here, not under Shortcuts.
    fields: ["game", "is:promo", "is:spotlight", "is:digital"],
    supported: [
      {
        name: "is:promo",
        operators: [":", "="],
        description: "Promotional printing.",
        examples: ["is:promo"],
      },
      {
        name: "is:spotlight",
        operators: [":", "="],
        description: "Story spotlight card.",
        examples: ["is:spotlight"],
      },
      {
        name: "is:digital",
        operators: [":", "="],
        description: "Card exists only in digital form (MTGO or Arena). Equivalent to in:mtgo or in:arena.",
        examples: ["is:digital"],
      },
    ],
    unsupported: [],
  },
  {
    id: "year",
    label: "Year",
    fields: ["year", "date"],
    unsupported: [],
  },
  {
    id: "tagger-tags",
    label: "Tagger Tags",
    fields: ["otag"],
    unsupported: [
      { label: "art:", description: "Tagger art tag (e.g. art:squirrel)" },
      { label: "atag:", description: "Art tagger annotation tag" },
    ],
  },
  {
    id: "reprints",
    label: "Reprints",
    fields: [],
    unsupported: [
      { label: "is:reprint", description: "Cards that have been printed in a previous set" },
      { label: "not:reprint", description: "Cards making their first printing appearance" },
      { label: "sets>=N", description: "Cards printed in at least N sets (e.g. sets>=10)" },
      { label: "papersets=N", description: "Cards in exactly N paper sets" },
    ],
  },
  {
    id: "languages",
    label: "Languages",
    fields: ["lang"],
    unsupported: [
      { label: "lang:any", description: "Cards printed in any non-English language" },
      { label: "new:language", description: "Cards with a new-language printing vs. previous set" },
      { label: "in:ru (language filter)", description: "Filter results to a specific language print only (lang: here is a sort preference, not an inclusion filter)" },
    ],
  },
  {
    id: "shortcuts",
    label: "Shortcuts and Nicknames",
    fields: ["is", "not", "is:commander", "is:default"],
    supported: [
      {
        name: "is:commander",
        operators: [":", "="],
        description: "Cards that are legal commanders.",
        examples: ["is:commander"],
      },
      {
        name: "is:default",
        operators: [":", "="],
        description: "Standard printing: no special frame, promo, or alternate treatment.",
        examples: ["is:default"],
      },
    ],
    unsupported: [
      { label: "is:dual", description: "Original dual lands (Tundra, Bayou, etc.)" },
      { label: "is:fetchland", description: "Fetch lands" },
      { label: "is:shockland", description: "Shock lands" },
      { label: "is:checkland", description: "Check lands" },
      { label: "is:companion", description: "Cards with the companion ability" },
      { label: "is:reserved", description: "Cards on the reserved list" },
      { label: "is:reprint", description: "Reprint shortcut (see Reprints section)" },
    ],
  },
  {
    id: "negation",
    label: "Negating Conditions",
    fields: [],
    note: "Supported. Prefix any term or parenthesized group with - to negate it: -t:creature, -(c:red or c:white), -o:draw.",
    unsupported: [],
  },
  {
    id: "regex",
    label: "Regular Expressions",
    fields: [],
    unsupported: [
      { label: "o:/regex/", description: "Regular expression search on oracle text" },
      { label: "name:/regex/", description: "Regular expression name search" },
      { label: "t:/regex/", description: "Regular expression type line search" },
    ],
  },
  {
    id: "exact-names",
    label: "Exact Names",
    fields: ["name"],
    unsupported: [
      { label: "!name: / !o:", description: "Fielded bang exact-match forms are not yet supported" },
    ],
  },
  {
    id: "or",
    label: "Using OR",
    fields: [],
    note: "Supported. Use the or keyword (case-insensitive) between terms: c:red or c:white, (t:angel or t:demon) c:white.",
    unsupported: [],
  },
  {
    id: "nesting",
    label: "Nesting Conditions",
    fields: [],
    note: "Supported. Use parentheses to group sub-expressions: (c:red or c:white) t:angel.",
    unsupported: [],
  },
  {
    id: "display",
    label: "Display Keywords",
    fields: ["unique", "order", "prefer", "direction"],
    unsupported: [],
  },
]);

/** The trailing group that catches fields belonging to no declared section. */
export const OTHER_GROUP_ID = "other";

/**
 * Index every `supported` synthetic across all groups by its name.
 *
 * Synthetics (`is:foil`, `is:spell`, …) are docs-only entries: they appear in a
 * group's `fields` list but are not registry fields, because the engine compiles
 * them as token values of `is:` / `not:` rather than as fields of their own.
 *
 * @param {object[]} [groups=KEYWORD_GROUPS]
 * @returns {Map<string, object>} Synthetic name to its raw group entry.
 */
export function collectSyntheticFields(groups = KEYWORD_GROUPS) {
  const synthetics = new Map();

  for (const group of groups) {
    for (const entry of group.supported || []) {
      if (!entry || typeof entry.name !== "string" || !entry.name.trim()) {
        continue;
      }

      synthetics.set(entry.name.trim(), entry);
    }
  }

  return synthetics;
}

/**
 * Resolve group membership for a set of field names.
 *
 * Shared by `engine.describeFields()` and the docs generator so the runtime
 * reference and the generated page cannot disagree about what appears where.
 * They used to disagree structurally: the generator warned about ungrouped
 * fields and then rendered without them, so a newly registered field showed up
 * in a consumer's reference and stayed missing from this library's own page —
 * the same drift, one layer down.
 *
 * Fields in no declared group land in a trailing `other` group, which is what
 * makes a consumer's `registerField()` visible without editing KEYWORD_GROUPS.
 * The group is omitted entirely when empty, so the built-ins render no stray
 * trailing section.
 *
 * A group name that is neither a known field nor a synthetic throws: a typo in
 * KEYWORD_GROUPS should fail a test, not quietly render a shorter page. This is
 * stricter than the generator's old behavior, which filtered unknown names out.
 *
 * @param {Iterable<string>} fieldNames - Canonical names the caller can resolve.
 * @param {object[]} [groups=KEYWORD_GROUPS]
 * @returns {object[]} `{ id, label, note, fields, supported, unsupported }` in
 *   declaration order, plus the `other` group when it has members.
 * @throws {Error} If a group lists a name that is neither a field nor a synthetic.
 */
export function assembleGroups(fieldNames, groups = KEYWORD_GROUPS) {
  const available = new Set(fieldNames);
  const synthetics = collectSyntheticFields(groups);
  const assigned = new Set();

  const assembled = groups.map((group) => {
    const names = (group.fields || []).map((name) => {
      if (available.has(name)) {
        assigned.add(name);
        return name;
      }

      if (synthetics.has(name)) {
        return name;
      }

      throw new Error(
        `Group "${group.id}" lists "${name}", which is neither a registered field nor a supported synthetic.`
      );
    });

    return {
      id: group.id,
      label: group.label,
      note: group.note || "",
      fields: names,
      supported: [...(group.supported || [])],
      unsupported: [...(group.unsupported || [])],
    };
  });

  const orphans = [...available].filter((name) => !assigned.has(name));

  if (orphans.length) {
    assembled.push({
      id: OTHER_GROUP_ID,
      label: "Other Fields",
      note: "",
      fields: orphans,
      supported: [],
      unsupported: [],
    });
  }

  return assembled;
}
