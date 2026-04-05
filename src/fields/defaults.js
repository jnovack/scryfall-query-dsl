import {
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
      nestedContainers: ["card_faces"],
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      description: "Filter by card color(s). Use color letters (W U B R G) or names (white blue black red green). Supports subset (:), exact (=), and comparison (> >= < <=) operators.",
      examples: ["c:red", "color=wu", "c>=boros", "c!=colorless", "-c:green"],
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    color_identity: {
      aliases: ["id", "identity"],
      esPath: "color_identity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "color-set",
      // Scryfall parity: id:esper means "fits within esper" (<=), not "contains esper" (>=).
      colonMeansSubset: true,
      description: "Filter by color identity (commander deck colors). Uses same color syntax as colors. id:esper finds cards that fit within an Esper deck (identity ⊆ {W,U,B}). Useful for finding cards that fit within a commander's color identity.",
      examples: ["id:grixis", "identity=esper", "id<=bant", "id:c"],
      parseValue: parseColorExpression,
      compile: compileColorField,
    },
    mana_value: {
      aliases: ["mv", "cmc"],
      esPath: "cmc",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by mana value (formerly converted mana cost). Supports all numeric comparison operators.",
      examples: ["mv=3", "cmc>=5", "mv<2", "mana_value!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    is: {
      aliases: ["is"],
      esPath: "is",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by card properties. Supports many token values from Scryfall (frame effects, promo types, layouts, rarities) plus semantic shortcuts: is:commander (legal commander), is:spell (cards with major spell/permanent/battle type lines), is:promo (promotional printing), is:spotlight (story spotlight), is:digital (MTGO or Arena only), is:default (standard printing).",
      examples: ["is:commander", "is:spell", "is:promo", "is:digital", "is:foil", "is:showcase"],
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
          nestedContainers: ["card_faces"],
        },
        spell: {
          kind: "type-line-disjunction",
          typePaths: ["type_line", "card_faces.type_line"],
          nestedContainers: ["card_faces"],
          values: ["creature", "artifact", "instant", "sorcery", "enchantment", "planeswalker", "battle"],
        },
        // is:promo — card is a promotional printing (promo: true boolean field).
        promo: {
          kind: "boolean",
          field: "promo",
        },
        // is:spotlight — card is a story spotlight (story_spotlight: true boolean field).
        spotlight: {
          kind: "boolean",
          field: "story_spotlight",
        },
        // is:digital — card exists only in digital form (MTGO or Arena game environment).
        // Equivalent to: in:mtgo or in:arena
        digital: {
          kind: "term-disjunction",
          field: "games",
          values: ["mtgo", "arena"],
        },
      },
    },
    not: {
      aliases: ["not"],
      esPath: "not",
      operators: [":", "="],
      type: "keyword",
      description: "Exclude cards matching a property token. Uses the same token vocabulary as is: but negates the match, including semantic shortcuts such as not:spell.",
      examples: ["not:showcase", "not:extendedart", "not:spell"],
      parseValue: parseShortcutValue,
      compile: compileNotShortcutField,
      tokenFieldMap: isNotTokenFieldMap,
      semanticShortcuts: {
        spell: {
          kind: "type-line-disjunction",
          typePaths: ["type_line", "card_faces.type_line"],
          nestedContainers: ["card_faces"],
          values: ["creature", "artifact", "instant", "sorcery", "enchantment", "planeswalker", "battle"],
        },
      },
    },
    unique: {
      aliases: ["unique"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Control result deduplication. cards: one result per unique oracle identity (default). prints: all individual printings. art: one result per unique artwork.",
      examples: ["unique:cards", "unique:prints", "unique:art"],
      parseValue: parseUniqueValue,
      compile: compileSearchUniqueField,
    },
    order: {
      aliases: ["order"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Sort results by a field. Valid values: name, cmc, power, toughness, set, rarity, color, usd, eur, tix, edhrec, released.",
      examples: ["order:name", "order:cmc", "order:usd", "order:released"],
      parseValue: parseOrderValue,
      compile: compileSearchOrderField,
    },
    prefer: {
      aliases: ["prefer"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Prefer a specific printing when deduplicating. Valid values: oldest, newest, usd-low, usd-high, promo, default, atypical, ub (Universes Beyond), notub.",
      examples: ["prefer:newest", "prefer:usd-low", "prefer:promo", "prefer:notub"],
      parseValue: parsePreferValue,
      compile: compileSearchPreferField,
    },
    direction: {
      aliases: ["direction"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Control sort direction. Valid values: asc (ascending, default) or desc (descending).",
      examples: ["order:usd direction:desc", "order:cmc direction:asc"],
      parseValue: parseDirectionValue,
      compile: compileSearchDirectionField,
    },
    lang: {
      aliases: ["language"],
      searchControl: true,
      operators: [":", "="],
      type: "control",
      description: "Prefer a language when selecting a printing. Uses ISO 639-1 language codes (en, de, fr, es, it, pt, ja, ko, ru, zhs, zht, he, la, grc, ar, sa, ph).",
      examples: ["lang:en", "language:ja", "lang:de"],
      parseValue: normalizeKeywordValue,
      compile: compileSearchLangField,
    },
    rarity: {
      aliases: ["r"],
      esPath: "rarity",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      description: "Filter by rarity. Ordered from lowest to highest: common < uncommon < rare < mythic < special < bonus. Supports comparison operators.",
      examples: ["rarity:rare", "r>=uncommon", "rarity<mythic", "r=common"],
      parseValue: parseRarityValue,
      compile: compileOrderedKeywordField,
      order: RARITY_ORDER,
    },
    set: {
      esPath: "set",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by set code (3–5 letter code, lowercased). Use Scryfall set codes such as dmu, mh3, lea, m21.",
      examples: ["set:dmu", "set:mh3", "set:lea", "-set:m21"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    // game / in — filter by game environment (paper, mtgo, arena, astral, sega).
    // Mirrors Scryfall's game: and in: syntax, both searching the games array field.
    game: {
      aliases: ["in"],
      esPath: "games",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by game environment. Valid values: paper, mtgo, arena, astral, sega. Use is:digital as a shorthand for in:mtgo or in:arena.",
      examples: ["game:paper", "in:mtgo", "game:arena", "-in:arena"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileKeywordField,
    },
    legal: {
      aliases: ["f", "format"],
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards legal in a format. Common formats: standard, pioneer, modern, legacy, vintage, commander, pauper, brawl, historic.",
      examples: ["legal:commander", "f:modern", "format:standard", "legal:pauper"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "legal",
    },
    banned: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards that are banned in a format (legality status is 'banned', not merely absent from the format).",
      examples: ["banned:legacy", "banned:modern", "banned:commander"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "banned",
    },
    restricted: {
      esPath: "legalities",
      operators: [":", "="],
      type: "keyword",
      description: "Filter to cards that are restricted in a format (limited to one copy). Currently only relevant to vintage.",
      examples: ["restricted:vintage"],
      parseValue: parseNonEmptyKeywordValue,
      compile: compileLegalityField,
      legalityStatus: "restricted",
    },
    date: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "date",
      description: "Filter by exact release date in YYYY-MM-DD format. Supports comparison operators. Note: != is not supported; use two comparisons instead.",
      examples: ["date=2024-02-09", "date>=2020-01-01", "date<2015-06-01"],
      parseValue: parseDateValue,
      compile: compileDateField,
    },
    year: {
      esPath: "released_at",
      operators: [":", "=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by release year. Supports all numeric comparison operators. Note: != is not supported for year.",
      examples: ["year=2024", "year>=2020", "year<2015", "year:2019"],
      parseValue: parseYearValue,
      compile: compileYearField,
    },
    set_type: {
      aliases: ["st"],
      esPath: "set_type",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by set type. Common values: expansion, masters, commander, core, draft_innovation, memorabilia, token, funny, duel_deck, masterpiece.",
      examples: ["set_type:expansion", "st:commander", "st:masters", "-st:memorabilia"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    border_color: {
      aliases: ["border"],
      esPath: "border_color",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by border color. Valid values: black, white, borderless, silver, gold, yellow.",
      examples: ["border_color:borderless", "border:black", "-border:silver"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    frame: {
      aliases: [],
      esPath: "frame",
      esPaths: ["frame", "frame_effects"],
      operators: [":", "="],
      type: "keyword",
      description: "Filter by frame style or frame effect. Frame styles: 1993, 1997, 2003, 2015, future. Frame effects: legendary, showcase, extendedart, inverted, colorshifted, etched, snow, and many more.",
      examples: ["frame:2015", "frame:showcase", "frame:legendary", "-frame:future"],
      parseValue: normalizeKeywordValue,
      compile: compileKeywordField,
    },
    collector_number: {
      aliases: ["cn"],
      esPath: "collector_number",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "keyword",
      description: "Filter by collector number within a set. Supports numeric comparisons and suffix variants (e.g. 123a, 123★). Combine with set: for precise lookup.",
      examples: ["cn:1", "set:dmu collector_number<=100", "cn=250a"],
      parseValue: (value) => String(value).trim(),
      compile: compileCollectorNumberField,
    },
    usd: {
      esPath: "prices.usd",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by USD price (non-foil). Prices sourced from TCGPlayer via Scryfall.",
      examples: ["usd<1", "usd>=10", "usd=0.25", "usd!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    eur: {
      esPath: "prices.eur",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by EUR price (non-foil). Prices sourced from Cardmarket via Scryfall.",
      examples: ["eur<2", "eur>=5", "eur=1.50"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    tix: {
      esPath: "prices.tix",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by MTGO ticket price. Prices sourced from Cardhoarder via Scryfall.",
      examples: ["tix<1", "tix>=5", "tix=0.01"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    power: {
      aliases: ["pow"],
      esPath: "power_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by power (numeric only; cards with */X/∞ power are excluded). Supports all numeric comparison operators.",
      examples: ["power>=5", "pow=2", "power<3", "pow!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    toughness: {
      aliases: ["tou"],
      esPath: "toughness_num",
      operators: [":", "=", "!=", ">", ">=", "<", "<="],
      type: "number",
      description: "Filter by toughness (numeric only; cards with */X/∞ toughness are excluded). Supports all numeric comparison operators.",
      examples: ["toughness>=4", "tou=1", "toughness<5", "tou!=0"],
      parseValue: parseNumberValue,
      compile: compileNumericField,
    },
    oracle_text: {
      aliases: ["o", "oracle", "text"],
      esPath: "oracle_text",
      esPaths: ["oracle_text", "card_faces.oracle_text"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      description: "Search oracle (rules) text. Unquoted values match word-by-word across subfields. Quoted values match the exact phrase. Searches both faces of double-faced cards.",
      examples: ['o:flying', 'o:"draw a card"', 'o:haste o:trample'],
      compile: compileTextField,
    },
    flavor_text: {
      aliases: ["ft", "flavor"],
      esPath: "flavor_text",
      esPaths: ["flavor_text", "card_faces.flavor_text"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      enablePartialSubfields: true,
      description: "Search flavor text. Unquoted values match word-by-word. Quoted values match the exact phrase. Searches both faces of double-faced cards.",
      examples: ['ft:urza', 'flavor:"Rath and Storm"', 'ft:"for the horde"'],
      compile: compileTextField,
    },
    type_line: {
      aliases: ["t", "type"],
      esPath: "type_line",
      esPaths: ["type_line", "card_faces.type_line"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      description: "Search the type line (supertypes, types, subtypes). Searches both faces of double-faced cards.",
      examples: ["t:creature", "type:legendary", "t:dragon", "t:planeswalker t:elf"],
      compile: compileTextField,
    },
    keywords: {
      aliases: ["kw", "keyword"],
      esPath: "keywords",
      operators: [":", "="],
      type: "keyword",
      description: "Filter by rules keyword (flying, trample, haste, etc.). Matches the keywords array field, not oracle text.",
      examples: ["keywords:flying", "kw:trample", "keyword:deathtouch", "kw:haste kw:flash"],
      parseValue: (value) => String(value).trim(),
      compile: compileKeywordField,
    },
    name: {
      aliases: ["name", "n"],
      esPath: "name",
      exactEsPaths: ["name.keyword", "card_faces.name.keyword"],
      nestedContainers: ["card_faces"],
      operators: [":", "="],
      type: "text",
      description: "Search card name. Bare terms (without a field prefix) default to name search. Use = for exact match. Prefix with ! for exact-name bang syntax.",
      examples: ["name:lightning", 'name:"Lightning Bolt"', "n=bolt", "!\"Sift Through Sands\""],
      compile: compileTextField,
    },
  };
}
