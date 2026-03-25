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
  compileLegalityField,
  compileNumericField,
  parseColorExpression,
  compileTextField,
  compileDateField,
  compileYearField,
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

function parseNonEmptyKeywordValue(value) {
  const normalized = normalizeKeywordValue(value);

  if (!normalized.length) {
    throw new Error("Value must be a non-empty string.");
  }

  return normalized;
}

function parseDateValue(value) {
  const normalized = String(value).trim();
  const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = normalized.match(datePattern);

  if (!match) {
    throw new Error(`Invalid date value "${value}". Expected YYYY-MM-DD.`);
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() + 1 !== Number(month) ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Invalid date value "${value}". Expected a real calendar date in YYYY-MM-DD format.`);
  }

  return normalized;
}

function parseYearValue(value) {
  const normalized = String(value).trim();

  if (!/^\d{4}$/.test(normalized)) {
    throw new Error(`Invalid year value "${value}". Expected a 4-digit year.`);
  }

  return Number(normalized);
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
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    color_identity: {
      aliases: ["id", "identity"],
      esPath: "color_identity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    mana_value: {
      aliases: ["mv", "cmc"],
      esPath: "cmc",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      operators: [":", "="],
      type: "keyword",
      parseValue: parseShortcutValue,
      compile: compileIsShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
      tokenExpansions: {
        default: IS_DEFAULT_ATOMS,
      },
      semanticShortcuts: {
        commander: {
          kind: "commander",
          legalityPath: "legalities.commander",
          typePaths: ["type_line", "card_faces.type_line"],
          oraclePaths: ["oracle_text", "card_faces.oracle_text"],
          powerPath: "power",
          toughnessPath: "toughness",
        },
      },
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      operators: [":", "="],
      type: "keyword",
      parseValue: parseShortcutValue,
      compile: compileNotShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
    },
    unique: {
      aliases: ["unique"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      parseValue: parseUniqueValue,
      compile: compileSearchUniqueField,
    },
    order: {
      aliases: ["order"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      parseValue: parseOrderValue,
      compile: compileSearchOrderField,
    },
    prefer: {
      aliases: ["prefer"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      parseValue: parsePreferValue,
      compile: compileSearchPreferField,
    },
    direction: {
      aliases: ["direction"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      parseValue: parseDirectionValue,
      compile: compileSearchDirectionField,
    },
    lang: {
      aliases: ["language"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      parseValue: normalizeKeywordValue,
      compile: compileSearchLangField,
    },
    rarity: {
      aliases: ["r"],
      esPath: "rarity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      parseValue: parseRarityValue,
      compile: compileOrderedKeywordField,
      order: RARITY_ORDER,
    },
    set: {
      esPath: "set",
      operators: [":", "="],
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    legal: {
      aliases: ["f", "format"],
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "legal",
    },
    banned: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "not_legal",
    },
    restricted: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "restricted",
    },
    date: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "date",
      parseValue: parseDateValue,
      compile: compileDateField,
    },
    year: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseYearValue,
      compile: compileYearField,
    },
    set_type: {
      aliases: ["st"],
      esPath: "set_type",
      operators: [":", "="],
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    border_color: {
      aliases: ["border"],
      esPath: "border_color",
      operators: [":", "="],
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    frame: {
      aliases: [],
      esPath: "frame",
      esPaths: ["frame", "frame_effects"],
      operators: [":", "="],
      type: "keyword",
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    collector_number: {
      aliases: ["cn"],
      esPath: "collector_number",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      parseValue: (value) => String(value).trim(),
      compile: compileCollectorNumberField,
    },
    usd: {
      esPath: "prices.usd",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    eur: {
      esPath: "prices.eur",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    tix: {
      esPath: "prices.tix",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    power: {
      aliases: ["pow"],
      esPath: "power_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    toughness: {
      aliases: ["tou"],
      esPath: "toughness_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    oracle_text: {
      aliases: ["o", "oracle", "text"],
      esPath: "oracle_text",
      esPaths: ["oracle_text", "card_faces.oracle_text"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      compile: compileTextField,
    },
    flavor_text: {
      aliases: ["ft", "flavor"],
      esPath: "flavor_text",
      esPaths: ["flavor_text", "card_faces.flavor_text"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      compile: compileTextField,
    },
    type_line: {
      aliases: ["t", "type"],
      esPath: "type_line",
      esPaths: ["type_line", "card_faces.type_line"],
      operators: [":", "="],
      type: "text",
      compile: compileTextField,
    },
    keywords: {
      aliases: ["kw", "keyword"],
      esPath: "keywords",
      operators: [":", "="],
      type: "keyword",
      parseValue: (value) => String(value).trim(),
      compile: compileKeywordField,
    },
    name: {
      aliases: ["name", "n"],
      esPath: "name",
      exactEsPaths: ["name.keyword", "card_faces.name.keyword"],
      operators: [":", "="],
      type: "text",
      compile: compileTextField,
    },
    is_legendary: {
      aliases: ["legendary", "is:legendary"],
      esPath: "is_legendary",
      operators: [":", "="],
      type: "boolean",
      parseValue: parseBooleanValue,
      compile: compileBooleanField,
    },
  };
}
