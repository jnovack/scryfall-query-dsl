import {
  compileBooleanField,
  compileCollectorNumberField,
  compileColorField,
  compileIsShortcutField,
  compileNotShortcutField,
  compileSearchDirectionField,
  compileSearchLangField,
  compileSearchOrderField,
  compileSearchPreferField,
  compileSearchUniqueField,
  compileOrderedKeywordField,
  compileKeywordField,
  compileNumericField,
  parseColorExpression,
  compileTextField,
} from "../compiler/helpers.js";
import { createIsNotTokenFieldMap, IS_DEFAULT_ATOMS } from "./is-not-token-index.js";

function parseBooleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "no") {
    return false;
  }

  throw new Error(`Cannot coerce "${value}" into a boolean value.`);
}

function parseNumberValue(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    throw new Error(`Cannot coerce "${value}" into a numeric value.`);
  }

  return numericValue;
}

function normalizeKeywordValue(value) {
  return String(value).trim().toLowerCase();
}

const RARITY_ORDER = ["common", "uncommon", "rare", "mythic", "special", "bonus"];
const RARITY_ALIASES = {
  c: "common",
  common: "common",
  u: "uncommon",
  uncommon: "uncommon",
  r: "rare",
  rare: "rare",
  m: "mythic",
  mythic: "mythic",
  s: "special",
  special: "special",
  b: "bonus",
  bonus: "bonus",
};

function parseRarityValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (Object.prototype.hasOwnProperty.call(RARITY_ALIASES, normalized)) {
    return RARITY_ALIASES[normalized];
  }

  throw new Error(`Unknown rarity expression "${value}".`);
}

const ORDER_VALUES = new Set([
  "cmc",
  "power",
  "toughness",
  "set",
  "name",
  "usd",
  "tix",
  "eur",
  "rarity",
  "color",
  "released",
  "edhrec",
  "oldest",
  "newest",
]);

const UNIQUE_ALIASES = {
  cards: "cards",
  card: "cards",
  prints: "prints",
  print: "prints",
  art: "art",
};

const PREFER_ALIASES = {
  oldest: "oldest",
  newest: "newest",
  "usd-low": "usd-low",
  "usd-high": "usd-high",
  promo: "promo",
  default: "default",
  atypical: "atypical",
  ub: "ub",
  universesbeyond: "ub",
  notub: "notub",
  notuniversesbeyond: "notub",
};

const DIRECTION_ALIASES = {
  asc: "asc",
  desc: "desc",
};

function parseOrderValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (!ORDER_VALUES.has(normalized)) {
    throw new Error(`Unknown order expression "${value}".`);
  }

  return normalized;
}

function parseUniqueValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (Object.prototype.hasOwnProperty.call(UNIQUE_ALIASES, normalized)) {
    return UNIQUE_ALIASES[normalized];
  }

  throw new Error(`Unknown unique expression "${value}".`);
}

function parsePreferValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (Object.prototype.hasOwnProperty.call(PREFER_ALIASES, normalized)) {
    return PREFER_ALIASES[normalized];
  }

  throw new Error(`Unknown prefer expression "${value}".`);
}

function parseDirectionValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (Object.prototype.hasOwnProperty.call(DIRECTION_ALIASES, normalized)) {
    return DIRECTION_ALIASES[normalized];
  }

  throw new Error(`Unknown direction expression "${value}".`);
}

function parseShortcutValue(value) {
  return normalizeKeywordValue(value);
}

export function createDefaultFieldDefinitions() {
  const isNotTokenFieldMap = createIsNotTokenFieldMap();

  return {
    colors: {
      aliases: ["c", "color"],
      esPath: "colors",
      esPaths: ["colors", "card_faces.colors"],
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    color_identity: {
      aliases: ["id", "identity"],
      esPath: "color_identity",
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    mana_value: {
      aliases: ["mv", "cmc"],
      esPath: "cmc",
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      type: "keyword",
      parseValue: parseShortcutValue,
      compile: compileIsShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
      tokenExpansions: {
        default: IS_DEFAULT_ATOMS,
      },
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      type: "keyword",
      parseValue: parseShortcutValue,
      compile: compileNotShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
    },
    unique: {
      aliases: ["unique"],
      searchControl: true,
      type: "control",
      parseValue: parseUniqueValue,
      compile: compileSearchUniqueField,
    },
    order: {
      aliases: ["order"],
      searchControl: true,
      type: "control",
      parseValue: parseOrderValue,
      compile: compileSearchOrderField,
    },
    prefer: {
      aliases: ["prefer"],
      searchControl: true,
      type: "control",
      parseValue: parsePreferValue,
      compile: compileSearchPreferField,
    },
    direction: {
      aliases: ["direction"],
      searchControl: true,
      type: "control",
      parseValue: parseDirectionValue,
      compile: compileSearchDirectionField,
    },
    lang: {
      aliases: ["language"],
      searchControl: true,
      type: "control",
      parseValue: normalizeKeywordValue,
      compile: compileSearchLangField,
    },
    rarity: {
      aliases: ["r"],
      esPath: "rarity",
      type: "keyword",
      parseValue: parseRarityValue,
      compile: compileOrderedKeywordField,
      order: RARITY_ORDER,
    },
    set: {
      esPath: "set",
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    set_type: {
      aliases: ["st"],
      esPath: "set_type",
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    border_color: {
      aliases: ["border"],
      esPath: "border_color",
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    frame: {
      aliases: [],
      esPath: "frame",
      esPaths: ["frame", "frame_effects"],
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    collector_number: {
      aliases: ["cn"],
      esPath: "collector_number",
      type: "keyword",
      parseValue: (value) => String(value).trim(),
      compile: compileCollectorNumberField,
    },
    usd: {
      esPath: "prices.usd",
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    eur: {
      esPath: "prices.eur",
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    tix: {
      esPath: "prices.tix",
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    oracle_text: {
      aliases: ["o", "oracle", "text"],
      esPath: "oracle_text",
      esPaths: ["oracle_text", "card_faces.oracle_text"],
      type: "text",
      compile: compileTextField,
    },
    type_line: {
      aliases: ["t", "type"],
      esPath: "type_line",
      esPaths: ["type_line", "card_faces.type_line"],
      type: "text",
      compile: compileTextField,
    },
    keywords: {
      aliases: ["kw", "keyword"],
      esPath: "keywords",
      type: "keyword",
      parseValue: (value) => String(value).trim(),
      compile: compileKeywordField,
    },
    name: {
      aliases: ["name", "n"],
      esPath: "name",
      type: "text",
      compile: compileTextField,
    },
    is_legendary: {
      aliases: ["legendary", "is:legendary"],
      esPath: "is_legendary",
      type: "boolean",
      parseValue: parseBooleanValue,
      compile: compileBooleanField,
    },
  };
}
