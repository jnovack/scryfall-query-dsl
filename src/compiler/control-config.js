function assertPrefix(prefix) {
  if (typeof prefix !== "string" || !prefix.trim()) {
    throw new Error("Control-config prefix must be a non-empty string.");
  }
}

function prefixPath(path, prefix) {
  return `${prefix}.${path}`;
}

export const DEFAULT_CONTROL_CONFIG = {
  collapseFields: {
    cards: "oracle_id",
    art: "illustration_id",
  },
  orderFields: {
    cmc: "cmc",
    power: "power_num",
    toughness: "toughness_num",
    set: "set",
    name: "name.keyword",
    usd: "prices.usd",
    eur: "prices.eur",
    tix: "prices.tix",
    edhrec: "edhrec_rank",
    released: "released_at",
  },
  orderScriptFields: {
    rarity: "rarity",
    colors: "colors",
  },
  langField: "lang",
  prefer: {
    defaultPrintingSortFields: {
      fullArt: "full_art",
      promoTypes: "promo_types",
      frameEffects: "frame_effects",
      setType: "set_type",
      frame: "frame",
      finishes: "finishes",
      borderColor: "border_color",
      releasedAt: "released_at",
      collectorNumber: "collector_number",
    },
    oldestFields: {
      releasedAt: "released_at",
      collectorNumber: "collector_number",
    },
    newestFields: {
      releasedAt: "released_at",
      collectorNumber: "collector_number",
    },
    usdField: "prices.usd",
    promoField: "promo",
    universesBeyondField: "universes_beyond",
    atypicalFields: {
      promo: "promo",
      frameEffect: "frame_effect",
      fullArt: "full_art",
      oversized: "oversized",
    },
  },
};

// Build a control configuration that targets a nested object path.
// Example: prefix "card" turns "prices.usd" into "card.prices.usd".
export function createPrefixedControlConfig(prefix, baseConfig = DEFAULT_CONTROL_CONFIG) {
  assertPrefix(prefix);

  return {
    collapseFields: {
      cards: prefixPath(baseConfig.collapseFields.cards, prefix),
      art: prefixPath(baseConfig.collapseFields.art, prefix),
    },
    orderFields: {
      cmc: prefixPath(baseConfig.orderFields.cmc, prefix),
      power: prefixPath(baseConfig.orderFields.power, prefix),
      toughness: prefixPath(baseConfig.orderFields.toughness, prefix),
      set: prefixPath(baseConfig.orderFields.set, prefix),
      name: prefixPath(baseConfig.orderFields.name, prefix),
      usd: prefixPath(baseConfig.orderFields.usd, prefix),
      eur: prefixPath(baseConfig.orderFields.eur, prefix),
      tix: prefixPath(baseConfig.orderFields.tix, prefix),
      edhrec: prefixPath(baseConfig.orderFields.edhrec, prefix),
      released: prefixPath(baseConfig.orderFields.released, prefix),
    },
    orderScriptFields: {
      rarity: prefixPath(baseConfig.orderScriptFields.rarity, prefix),
      colors: prefixPath(baseConfig.orderScriptFields.colors, prefix),
    },
    langField: prefixPath(baseConfig.langField, prefix),
    prefer: {
      defaultPrintingSortFields: {
        fullArt: prefixPath(baseConfig.prefer.defaultPrintingSortFields.fullArt, prefix),
        promoTypes: prefixPath(baseConfig.prefer.defaultPrintingSortFields.promoTypes, prefix),
        frameEffects: prefixPath(baseConfig.prefer.defaultPrintingSortFields.frameEffects, prefix),
        setType: prefixPath(baseConfig.prefer.defaultPrintingSortFields.setType, prefix),
        frame: prefixPath(baseConfig.prefer.defaultPrintingSortFields.frame, prefix),
        finishes: prefixPath(baseConfig.prefer.defaultPrintingSortFields.finishes, prefix),
        borderColor: prefixPath(baseConfig.prefer.defaultPrintingSortFields.borderColor, prefix),
        releasedAt: prefixPath(baseConfig.prefer.defaultPrintingSortFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.defaultPrintingSortFields.collectorNumber, prefix),
      },
      oldestFields: {
        releasedAt: prefixPath(baseConfig.prefer.oldestFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.oldestFields.collectorNumber, prefix),
      },
      newestFields: {
        releasedAt: prefixPath(baseConfig.prefer.newestFields.releasedAt, prefix),
        collectorNumber: prefixPath(baseConfig.prefer.newestFields.collectorNumber, prefix),
      },
      usdField: prefixPath(baseConfig.prefer.usdField, prefix),
      promoField: prefixPath(baseConfig.prefer.promoField, prefix),
      universesBeyondField: prefixPath(baseConfig.prefer.universesBeyondField, prefix),
      atypicalFields: {
        promo: prefixPath(baseConfig.prefer.atypicalFields.promo, prefix),
        frameEffect: prefixPath(baseConfig.prefer.atypicalFields.frameEffect, prefix),
        fullArt: prefixPath(baseConfig.prefer.atypicalFields.fullArt, prefix),
        oversized: prefixPath(baseConfig.prefer.atypicalFields.oversized, prefix),
      },
    },
  };
}
