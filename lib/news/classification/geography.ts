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
  "biden", "governor", "state department", "irs", "nasa", "capitol hill",
  "democrats", "republicans", "gop", "midterm", "district of columbia",
  "national guard", "veterans affairs", "homeland security",
] as const;

const CA_TERMS = [
  "canada", "canadian", "canadians", "ottawa", "toronto", "vancouver",
  "montreal", "montréal", "calgary", "edmonton", "winnipeg", "quebec",
  "québec", "ontario", "alberta", "british columbia", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "newfoundland",
  "prince edward island", "yukon", "nunavut", "northwest territories",
  "parliament hill", "house of commons", "prime minister", "premier",
  "bank of canada", "cbc", "rcmp", "trudeau", "bloc québécois", "ndp",
  "first nations", "indigenous", "métis", "inuit", "grey cup", "tsx",
  "health canada", "statistics canada", "bay street", "oil sands",
  "loonie", "gta ", "hydro-québec", "via rail", "canada post",
] as const;

const GLOBAL_NA_TERMS = [
  "nato", "g7", "g20", "north america", "usmca", "nafta", "trade war",
  "tariff", "border", "arctic", "norad", "oil prices", "global markets",
  "supply chain", "world trade", "opec",
] as const;

const regexCache = new Map<string, RegExp>();

/** Word-boundary term matcher — "us" must never match inside "cautious". */
function termRegex(term: string): RegExp {
  let regex = regexCache.get(term);
  if (!regex) {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
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

export function classifyGeography(input: GeographyInput): Country {
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

  // Provider-declared country is a moderate signal.
  const providerCountry = input.providerCountry?.toLowerCase();
  if (providerCountry === "us") usScore += 1;
  if (providerCountry === "ca") caScore += 1;

  // Source home country is only a weak tiebreaker.
  if (usScore === caScore) {
    if (input.sourceCountry === "US") usScore += 0.5;
    if (input.sourceCountry === "CA") caScore += 0.5;
  }

  if (usScore >= 1 && caScore >= 1 && Math.abs(usScore - caScore) <= 1) {
    return "US_CA";
  }
  if (caScore > usScore && caScore >= 1) return "CA";
  if (usScore > caScore && usScore >= 1) return "US";
  if (naScore >= 1) return "GLOBAL_NA";
  return "GLOBAL";
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
