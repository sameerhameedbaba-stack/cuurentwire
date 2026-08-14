import type { Country } from "@/lib/news/types";

/**
 * Deterministic US/Canada relevance classifier.
 * Content signals (entities, places, institutions) dominate; the source's home
 * country is only a weak tiebreaker — a Reuters story about the Canadian
 * government must classify as Canada.
 *
 * Term lists are split into evidence tiers. STRONG terms are unambiguous on
 * their own (country names/adjectives, states/provinces, cities, national
 * institutions, named leaders). WEAK terms are collision-prone short forms
 * and acronyms — "CBC" is also the Congressional Black Caucus, "premier" a
 * foreign head of government. Weak hits add to a side's score but can never
 * establish a country without strong evidence on that same side: a live US
 * politics story landed in the Canada hub on a single unopposed "cbc" hit.
 */

const US_STRONG_TERMS = [
  "united states", "u.s.", "america", "american", "washington",
  "white house", "congress", "senate", "house of representatives", "pentagon",
  "federal reserve", "supreme court", "fbi", "cia", "epa", "fda", "cdc",
  "medicare", "medicaid", "wall street", "california", "texas", "florida",
  "new york", "pennsylvania", "ohio", "georgia", "michigan", "arizona",
  "illinois", "virginia", "colorado", "seattle", "chicago", "los angeles",
  "boston", "houston", "atlanta", "detroit", "san francisco", "philadelphia",
  "biden", "trump", "governor", "state department", "irs", "nasa", "capitol hill",
  "democrats", "republicans", "midterm", "district of columbia",
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

// Audit round: "DOJ" was missing entirely, so a Congressional Black Caucus
// story had zero US evidence to oppose the false "cbc" hit.
const US_WEAK_TERMS = ["gop", "doj"] as const;

/**
 * No "prime minister" / "house of commons": both are just as common in UK
 * (and other Commonwealth) coverage and made every foreign-PM story claim
 * Canada. No bare "indigenous" (generic worldwide) and no "gta" (collides
 * with the video game); Canadian stories carry stronger terms anyway.
 */
const CA_STRONG_TERMS = [
  "canada", "canadian", "canadians", "ottawa", "toronto", "vancouver",
  "montreal", "montréal", "calgary", "edmonton", "winnipeg", "quebec",
  "québec", "ontario", "alberta", "british columbia", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "newfoundland",
  "prince edward island", "yukon", "nunavut", "northwest territories",
  "parliament hill", "governor general",
  "bank of canada", "rcmp", "trudeau", "carney", "bloc québécois",
  "first nations", "métis", "inuit", "grey cup",
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

// "cbc" is the Congressional Black Caucus in US politics coverage, "tsx"
// appears in any cross-listed ticker line, "ndp" and "premier" show up in
// foreign-politics wire copy.
const CA_WEAK_TERMS = ["premier", "cbc", "ndp", "tsx"] as const;

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
 * - "congress" must cover "Congressional" (negotiators, Black Caucus).
 * - "cbc" is guarded across the WHOLE text: "the CBC sent a request" in a
 *   Congressional Black Caucus story is not the Canadian broadcaster, even
 *   when the acronym appears sentences away from its expansion (this put a
 *   live US politics story in the Canada hub).
 */
const TERM_REGEX_OVERRIDES: Record<string, RegExp> = {
  premier:
    /(?<!chinese )(?<!china's )(?<![a-z0-9])premier(?![a-z0-9])(?!\s+league)/i,
  america: /(?<!south )(?<!latin )(?<!central )(?<!north )(?<![a-z0-9])america(?![a-z0-9])/i,
  american: /(?<!south )(?<!latin )(?<!central )(?<!north )(?<![a-z0-9])american(?![a-z0-9])/i,
  governor: /(?<![a-z0-9])governor(?![a-z0-9])(?!\s+general)/i,
  congress: /(?<![a-z0-9])congress(?:ional|es)?(?![a-z0-9])/i,
  cbc: /^(?![\s\S]*black caucus)[\s\S]*(?<![a-z0-9])cbc(?![a-z0-9])/i,
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

  const usStrongHits = countMatches(text, US_STRONG_TERMS);
  const caStrongHits = countMatches(text, CA_STRONG_TERMS);
  let usScore = usStrongHits + countMatches(text, US_WEAK_TERMS);
  let caScore = caStrongHits + countMatches(text, CA_WEAK_TERMS);
  const naScore = countMatches(text, GLOBAL_NA_TERMS);

  // Case-sensitive check for the bare abbreviation: "US and Canada resume
  // talks" — the lowercase pronoun "us" must never count. An explicit
  // country abbreviation is strong evidence.
  const originalText = `${input.title} ${input.description ?? ""}`;
  let usHasStrong = usStrongHits > 0;
  if (/(?<![A-Za-z0-9])(US|USA|U\.S\.A?\.?)(?![A-Za-z0-9])/.test(originalText)) {
    usScore += 1;
    usHasStrong = true;
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

  // Evidence-tier gate: weak-term, provider and source signals may support
  // or tiebreak a side that already has strong evidence, but can never
  // establish a country alone — a side with zero strong hits is out of
  // contention entirely (its raw score stays in `scores` for diagnostics).
  const usEffective = usHasStrong ? usScore : 0;
  const caEffective = caStrongHits > 0 ? caScore : 0;

  const top = Math.max(usEffective, caEffective);
  const margin = top > 0 ? Math.abs(usEffective - caEffective) / top : 0;

  if (usEffective >= 1 && caEffective >= 1 && Math.abs(usEffective - caEffective) <= 1) {
    // Both sides matched with near-balance — the balance IS the confidence.
    return { country: "US_CA", confidence: 1 - margin, scores };
  }
  if (caEffective > usEffective && caEffective >= 1) {
    return { country: "CA", confidence: Math.min(1, margin), scores };
  }
  if (usEffective > caEffective && usEffective >= 1) {
    return { country: "US", confidence: Math.min(1, margin), scores };
  }
  if (naScore >= 1) {
    return { country: "GLOBAL_NA", confidence: Math.min(1, naScore / 2), scores };
  }
  // No strong national evidence anywhere: NOT US/Canada coverage. Weak-only
  // hits lower confidence but still keep the story out of both country hubs.
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
