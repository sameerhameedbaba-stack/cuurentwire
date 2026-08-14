import type { Country } from "@/lib/news/types";

/**
 * Deterministic US/Canada relevance classifier.
 * Content signals (entities, places, institutions) dominate; the source's home
 * country is only a weak tiebreaker — a Reuters story about the Canadian
 * government must classify as Canada.
 */

const US_TERMS = [
  "united states", "u.s.", "america", "american", "washington",
  "white house", "congress", "senate", "house of representatives", "pentagon",
  "federal reserve", "supreme court", "fbi", "cia", "epa", "fda", "cdc",
  "medicare", "medicaid", "wall street", "california", "texas", "florida",
  "new york", "pennsylvania", "ohio", "georgia", "michigan", "arizona",
  "illinois", "virginia", "colorado", "seattle", "chicago", "los angeles",
  "boston", "houston", "atlanta", "detroit", "san francisco", "philadelphia",
  "biden", "trump", "governor", "state department", "irs", "nasa", "capitol hill",
  "democrats", "republicans", "gop", "midterm", "district of columbia",
  "national guard", "veterans affairs", "homeland security",
  // Real-headline benchmark round: the remaining states (Mississippi ICE
  // coverage classified GLOBAL). "washington" above covers the state.
  "alabama", "alaska", "arkansas", "connecticut", "delaware", "hawaii",
  "idaho", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "minnesota", "mississippi", "missouri",
  "montana", "nebraska", "nevada", "new hampshire", "new jersey",
  "new mexico", "north carolina", "north dakota", "oklahoma", "oregon",
  "rhode island", "south carolina", "south dakota", "tennessee", "utah",
  "vermont", "west virginia", "wisconsin", "wyoming",
  "justice department", "air force one",
] as const;

/**
 * No "prime minister" / "house of commons": both are just as common in UK
 * (and other Commonwealth) coverage and made every foreign-PM story claim
 * Canada. No bare "indigenous" (generic worldwide) and no "gta" (collides
 * with the video game); Canadian stories carry stronger terms anyway.
 */
const CA_TERMS = [
  "canada", "canadian", "canadians", "ottawa", "toronto", "vancouver",
  "montreal", "montréal", "calgary", "edmonton", "winnipeg", "quebec",
  "québec", "ontario", "alberta", "british columbia", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "newfoundland",
  "prince edward island", "yukon", "nunavut", "northwest territories",
  "parliament hill", "premier", "governor general",
  "bank of canada", "cbc", "rcmp", "trudeau", "carney", "bloc québécois", "ndp",
  "first nations", "métis", "inuit", "grey cup", "tsx",
  "health canada", "statistics canada", "bay street", "oil sands",
  "loonie", "hydro-québec", "via rail", "canada post",
  // Canadian sports institutions — a Leafs or Jays story is Canadian news.
  "maple leafs", "blue jays", "raptors", "canucks", "canadiens",
  // Real-headline benchmark round: GTA/prairie cities and flag-carrier
  // companies that anchor domestic Canadian coverage. No "hamilton" (the
  // musical), no "windsor" (the castle), no bare "peel" (the verb).
  "brampton", "mississauga", "laval", "regina", "red deer",
  "westjet", "air canada", "unifor",
] as const;

const GLOBAL_NA_TERMS = [
  "nato", "g7", "g20", "north america", "usmca", "nafta", "trade war",
  "tariff", "border", "arctic", "norad", "oil prices", "global markets",
  "supply chain", "world trade", "opec",
] as const;

const regexCache = new Map<string, RegExp>();

/**
 * Context guards for terms that also appear in unrelated coverage:
 * - "premier" is a Canadian provincial leader, never "Premier League"
 *   soccer coverage (which put European transfer stories in CA).
 * - "america(n)" refers to the US except in continental phrases.
 * - "governor" is a US state governor, not Canada's governor general.
 */
const TERM_REGEX_OVERRIDES: Record<string, RegExp> = {
  premier:
    /(?<!chinese )(?<!china's )(?<![a-z0-9])premier(?![a-z0-9])(?!\s+league)/i,
  america: /(?<!south )(?<!latin )(?<!central )(?<!north )(?<![a-z0-9])america(?![a-z0-9])/i,
  american: /(?<!south )(?<!latin )(?<!central )(?<!north )(?<![a-z0-9])american(?![a-z0-9])/i,
  governor: /(?<![a-z0-9])governor(?![a-z0-9])(?!\s+general)/i,
};

/**
 * Word-boundary term matcher with an optional plural "s" — "us" must never
 * match inside "cautious", while "tariff" still matches "tariffs".
 */
function termRegex(term: string): RegExp {
  let regex = regexCache.get(term);
  if (!regex) {
    regex =
      TERM_REGEX_OVERRIDES[term] ??
      new RegExp(
        `(?<![a-z0-9])${term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?(?![a-z0-9])`,
        "i",
      );
    regexCache.set(term, regex);
  }
  return regex;
}

function countMatches(text: string, terms: readonly string[]): number {
  let count = 0;
  for (const term of terms) {
    if (termRegex(term).test(text)) count++;
  }
  return count;
}

export interface GeographyInput {
  title: string;
  description?: string;
  sourceCountry?: "US" | "CA" | "INTL";
  providerCountry?: string;
}

export interface GeographyResult {
  country: Country;
  /**
   * 0..1, deterministic. For US/CA: normalized margin between the two
   * country scores. For US_CA: how balanced the two sides are. For
   * GLOBAL_NA/GLOBAL: fixed evidence-based levels (matched North-America
   * terms vs. nothing matched at all).
   */
  confidence: number;
  /** Raw term-match scores per bucket, for diagnostics. */
  scores: { us: number; ca: number; northAmerica: number };
}

export function classifyGeography(input: GeographyInput): Country {
  return classifyGeographyDetailed(input).country;
}

export function classifyGeographyDetailed(input: GeographyInput): GeographyResult {
  const text = ` ${input.title} ${input.description ?? ""} `.toLowerCase();

  let usScore = countMatches(text, US_TERMS);
  let caScore = countMatches(text, CA_TERMS);
  const naScore = countMatches(text, GLOBAL_NA_TERMS);

  // Case-sensitive check for the bare abbreviation: "US and Canada resume
  // talks" — the lowercase pronoun "us" must never count.
  const originalText = `${input.title} ${input.description ?? ""}`;
  if (/(?<![A-Za-z0-9])(US|USA|U\.S\.A?\.?)(?![A-Za-z0-9])/.test(originalText)) {
    usScore += 1;
  }

  // Provider-declared country is a weak signal: GNews serves the same
  // international story in its us and ca feeds (an ESPN soccer transfer
  // story fetched with country=ca is not Canadian news), so it can support
  // content signals but must never assign a country on its own.
  const providerCountry = input.providerCountry?.toLowerCase();
  if (providerCountry === "us") usScore += 0.5;
  if (providerCountry === "ca") caScore += 0.5;

  // Source home country is only a weak tiebreaker.
  if (usScore === caScore) {
    if (input.sourceCountry === "US") usScore += 0.5;
    if (input.sourceCountry === "CA") caScore += 0.5;
  }

  const scores = { us: usScore, ca: caScore, northAmerica: naScore };
  const top = Math.max(usScore, caScore);
  const margin = top > 0 ? Math.abs(usScore - caScore) / top : 0;

  if (usScore >= 1 && caScore >= 1 && Math.abs(usScore - caScore) <= 1) {
    // Both sides matched with near-balance — the balance IS the confidence.
    return { country: "US_CA", confidence: 1 - margin, scores };
  }
  if (caScore > usScore && caScore >= 1) {
    return { country: "CA", confidence: Math.min(1, margin), scores };
  }
  if (usScore > caScore && usScore >= 1) {
    return { country: "US", confidence: Math.min(1, margin), scores };
  }
  if (naScore >= 1) {
    return { country: "GLOBAL_NA", confidence: Math.min(1, naScore / 2), scores };
  }
  // Nothing matched anywhere: confidently NOT US/Canada coverage.
  return { country: "GLOBAL", confidence: usScore + caScore === 0 ? 1 : 0.5, scores };
}

/** Whether a story is relevant to a country page filter. */
export function matchesCountryFilter(
  country: Country,
  filter: "all" | "us" | "canada" | "us-canada" | "global",
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "us":
      return country === "US" || country === "US_CA";
    case "canada":
      return country === "CA" || country === "US_CA";
    case "us-canada":
      return country === "US_CA";
    case "global":
      return country === "GLOBAL" || country === "GLOBAL_NA";
  }
}
