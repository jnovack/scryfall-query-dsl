export const VERSION =
  typeof __SCRYFALL_QUERY_DSL_VERSION__ !== "undefined"
    ? __SCRYFALL_QUERY_DSL_VERSION__
    : "0.0.0-dev";

export const RELEASE =
  typeof __SCRYFALL_QUERY_DSL_RELEASE__ !== "undefined"
    ? __SCRYFALL_QUERY_DSL_RELEASE__
    : VERSION;

export const BUILD_DATE =
  typeof __SCRYFALL_QUERY_DSL_BUILD_DATE__ !== "undefined"
    ? __SCRYFALL_QUERY_DSL_BUILD_DATE__
    : "unbundled";

let announced = false;

export function announceBrowserBuild() {
  if (announced || typeof window === "undefined" || typeof console?.info !== "function") {
    return;
  }

  announced = true;
  console.info(`[ScryfallQueryDSL] loaded ${RELEASE}`);
}
