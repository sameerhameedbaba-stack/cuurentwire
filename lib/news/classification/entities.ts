import { slugify } from "@/lib/utils/text";

/**
 * Deterministic named-entity extraction.
 * Combines a curated dictionary of institutions/places/topics with a
 * capitalized-phrase heuristic over the headline. No LLM required.
 */

const KNOWN_ENTITIES = [
  // Institutions
  "Federal Reserve", "Bank of Canada", "White House", "Congress", "Senate",
  "House of Representatives", "Supreme Court", "Parliament", "House of Commons",
  "Pentagon", "State Department", "United Nations", "NATO", "European Union",
  "World Health Organization", "NASA", "Canadian Space Agency", "FBI", "RCMP",
  "Health Canada", "Statistics Canada", "FDA", "CDC", "EPA", "IMF",
  "World Bank", "G7", "G20", "OPEC", "NORAD",
  // Places
  "United States", "Canada", "Washington", "Ottawa", "Toronto", "Vancouver",
  "Montreal", "Calgary", "Quebec", "Ontario", "Alberta", "British Columbia",
  "California", "Texas", "New York", "Florida", "Wall Street", "Bay Street",
  "Silicon Valley", "Capitol Hill", "Parliament Hill",
  // Topics
  "Artificial Intelligence", "Climate Change", "Interest Rates", "Inflation",
  "Housing", "Immigration", "Cybersecurity", "Elections", "Trade",
  "Energy", "Wildfires", "Semiconductors", "Public Health",
  // Sports institutions
  "NFL", "NBA", "NHL", "MLB", "MLS", "CFL", "Stanley Cup", "Super Bowl",
  "Grey Cup", "World Series", "Olympics",
] as const;

const knownLower = new Map<string, string>(
  KNOWN_ENTITIES.map((e) => [e.toLowerCase(), e]),
);

/** Words that start sentences but are never entities on their own. */
const NOISE_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "as", "after", "before", "why", "how",
  "what", "when", "who", "new", "breaking", "live", "updated", "exclusive",
  "analysis", "opinion", "watch", "demo", "sample",
]);

/**
 * Extract entities from a headline + description.
 * Returns display-cased entity names, deduplicated, most confident first.
 */
const entityRegexCache = new Map<string, RegExp>();

/** Word-boundary matcher — "NFL" must never match inside "inflation". */
function entityRegex(needle: string): RegExp {
  let regex = entityRegexCache.get(needle);
  if (!regex) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
    entityRegexCache.set(needle, regex);
  }
  return regex;
}

export function extractEntities(title: string, description?: string): string[] {
  const found = new Map<string, string>();
  const text = `${title}. ${description ?? ""}`;
  const lower = text.toLowerCase();

  // Pass 1 — dictionary matches on word boundaries.
  for (const [needle, display] of knownLower) {
    if (entityRegex(needle).test(lower)) found.set(needle, display);
  }

  // Pass 2 — capitalized phrases in the title (skip the leading word).
  const words = title.split(/\s+/);
  let phrase: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^A-Za-z0-9''-]/g, "");
    const isCapitalized = /^[A-Z][a-zA-Z''-]+$/.test(word);
    const isNoise = NOISE_WORDS.has(word.toLowerCase());
    if (isCapitalized && !isNoise && i > 0) {
      phrase.push(word);
    } else {
      if (phrase.length >= 2) {
        const joined = phrase.join(" ");
        const key = joined.toLowerCase();
        if (!found.has(key)) found.set(key, joined);
      }
      phrase = [];
    }
  }
  if (phrase.length >= 2) {
    const joined = phrase.join(" ");
    found.set(joined.toLowerCase(), found.get(joined.toLowerCase()) ?? joined);
  }

  return [...found.values()].slice(0, 8);
}

export function entitySlug(entity: string): string {
  return slugify(entity, 60);
}
