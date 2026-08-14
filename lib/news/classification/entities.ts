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

/**
 * Entity alias canonicalization: every extracted entity is mapped through
 * this table (lowercased key → canonical display) BEFORE dedupe, so topics,
 * clustering fingerprints and trending all see one canonical entity instead
 * of "USS Lincoln" and "USS Abraham Lincoln" as separate topics.
 *
 * Only SAFE pairs belong here: the short form must be unambiguous in a
 * North-American news context. Deliberately excluded: "Abraham Lincoln"
 * (the president), "Meta" (common noun), "Washington" variants (city vs
 * state), "B.C." (British Columbia vs dates).
 */
const ENTITY_ALIASES: Record<string, string> = {
  // Military / institutions
  "uss lincoln": "USS Abraham Lincoln",
  // Identity alias, but SCANNED: the phrase pass skips the leading title
  // word, so "USS Abraham Lincoln returns…" would otherwise yield only
  // "Abraham Lincoln" (a different topic — the president).
  "uss abraham lincoln": "USS Abraham Lincoln",
  "the fed": "Federal Reserve",
  fed: "Federal Reserve",
  scotus: "Supreme Court",
  "us supreme court": "Supreme Court",
  gop: "Republican Party",
  mounties: "RCMP",
  boc: "Bank of Canada",
  "wall st": "Wall Street",
  "world health organization (who)": "World Health Organization",
  // People (short forms only canonicalize what extraction already found)
  "president trump": "Donald Trump",
  trump: "Donald Trump",
  "president biden": "Joe Biden",
  biden: "Joe Biden",
  putin: "Vladimir Putin",
  zelensky: "Volodymyr Zelenskyy",
  zelenskyy: "Volodymyr Zelenskyy",
  "elon musk": "Elon Musk",
  // Places
  nyc: "New York City",
  "new york city": "New York City",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "u.s.": "United States",
  usa: "United States",
  // Topics
  ai: "Artificial Intelligence",
  "artificial intelligence (ai)": "Artificial Intelligence",
  covid: "COVID-19",
  "covid-19": "COVID-19",
  crypto: "Cryptocurrency",
  evs: "Electric Vehicles",
  "electric vehicle": "Electric Vehicles",
};

/**
 * Alias keys that are ALSO scanned in the text like dictionary entries, so
 * "The Fed hikes rates" yields Federal Reserve even though "Fed" alone is
 * never captured by the capitalized-phrase pass. Restricted to multi-word
 * keys and acronyms that cannot collide with ordinary lowercase words
 * (bare "fed", "trump", "musk" are canonicalize-only for that reason).
 */
const SCANNED_ALIAS_KEYS = [
  "uss lincoln",
  "uss abraham lincoln",
  "the fed",
  "scotus",
  "nyc",
  "uk",
  "u.s.",
  "u.k.",
  "ai",
  "covid",
  "covid-19",
  "wall st",
  "mounties",
  "putin",
  "zelensky",
  "zelenskyy",
] as const;

/** Canonical display form of an extracted entity (identity when unaliased). */
export function canonicalizeEntity(entity: string): string {
  return ENTITY_ALIASES[entity.trim().toLowerCase()] ?? entity.trim();
}

/**
 * Every entity the dictionary/alias scan can produce, lowercased: countries,
 * provinces, cities, institutions, agencies, leagues, broad topics and
 * national leaders. Derived from the actual tables above so it cannot drift
 * from them. These are GENERIC — they say what a story merely touches, not
 * what it is about, so sharing one is never evidence that two stories cover
 * the same event. Only pass-2 phrase discoveries are specific.
 */
export const GENERIC_ENTITIES: ReadonlySet<string> = new Set([
  ...KNOWN_ENTITIES.map((e) => e.toLowerCase()),
  ...Object.values(ENTITY_ALIASES).map((e) => e.toLowerCase()),
  // Corporate-filing phrases the title-case phrase pass picks up. Two
  // unrelated issuers both saying "Private Placement" is a shared template,
  // not a shared story — they must never be relatedness evidence.
  "private placement", "first tranche", "second tranche", "final tranche",
  "financial results", "quarterly results", "annual results", "fiscal year",
  "first quarter", "second quarter", "third quarter", "fourth quarter",
  "board of directors", "chief executive officer", "chief financial officer",
  "annual general meeting", "conference call", "earnings call",
  "shelf prospectus", "management discussion", "letter of intent",
  "definitive agreement", "special meeting", "record date",
]);

/** True for entities the dictionary/alias scan can produce (see GENERIC_ENTITIES). */
export function isGenericEntity(entity: string): boolean {
  return GENERIC_ENTITIES.has(entity.trim().toLowerCase());
}

/** Words that start sentences but are never entities on their own. */
const NOISE_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "as", "after", "before", "why", "how",
  "what", "when", "who", "new", "breaking", "live", "updated", "exclusive",
  "analysis", "opinion", "watch", "demo", "sample",
]);

/**
 * Headline verbs and connectives. Capitalized — in a press-release headline
 * or a Title Case one — they read like part of a name, so the phrase pass
 * must break on them rather than fuse an issuer, its verb and its object
 * into one invented entity ("Brixton Metals Announces Closing").
 */
const PHRASE_BREAK_WORDS = new Set([
  "announces", "announced", "reports", "reported", "says", "said", "plans",
  "wins", "won", "files", "filed", "closes", "closed", "closing", "unveils",
  "unveiled", "launches", "launched", "names", "sets", "adds", "cuts",
  "raises", "raised", "backs", "urges", "urged", "faces", "seeks", "opens",
  "opened", "ends", "ended", "hits", "tops", "joins", "joined", "leads",
  "holds", "held", "calls", "called", "warns", "warned", "expects",
  "completes", "completed", "provides", "receives", "appoints", "appointed",
  "releases", "released", "posts", "confirms", "confirmed", "denies",
  "approves", "approved", "rejects", "rejected", "signs", "signed", "begins",
  "returns", "returned", "is", "are", "was", "were", "to", "of", "for", "and",
  "with", "from", "by", "over", "into", "amid", "following",
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
  // Keyed by CANONICAL lowercase name so aliases dedupe with their targets.
  const found = new Map<string, string>();
  const add = (display: string) => {
    const canonical = canonicalizeEntity(display);
    const key = canonical.toLowerCase();
    if (!found.has(key)) found.set(key, canonical);
  };
  // Phrase-pass variant: a capitalized phrase that is a sub-phrase of an
  // entity the dictionary/alias scan already found ("Abraham Lincoln"
  // inside "USS Abraham Lincoln") is the same mention, not a new topic.
  const addPhrase = (display: string) => {
    const canonical = canonicalizeEntity(display);
    const key = canonical.toLowerCase();
    for (const existing of found.keys()) {
      if (existing.includes(key)) return;
    }
    if (!found.has(key)) found.set(key, canonical);
  };
  const text = `${title}. ${description ?? ""}`;
  const lower = text.toLowerCase();

  // Pass 1 — dictionary matches on word boundaries.
  for (const [needle, display] of knownLower) {
    if (entityRegex(needle).test(lower)) add(display);
  }
  // Pass 1b — scanned alias keys ("the fed", "uss lincoln") emit their
  // canonical entity the same way.
  for (const needle of SCANNED_ALIAS_KEYS) {
    if (entityRegex(needle).test(lower)) add(ENTITY_ALIASES[needle]);
  }

  // Pass 2 — capitalized phrases in the title (skip the leading word).
  const words = title.split(/\s+/);
  let phrase: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^A-Za-z0-9''-]/g, "");
    const isCapitalized = /^[A-Z][a-zA-Z''-]+$/.test(word);
    const isNoise =
      NOISE_WORDS.has(word.toLowerCase()) || PHRASE_BREAK_WORDS.has(word.toLowerCase());
    // Sentence punctuation on the RAW token ("Niger,") ends the phrase
    // AFTER this word — "…Niger, Christian group…" must not fuse into a
    // fake entity "Niger Christian". Tested before stripping, which erases
    // the punctuation.
    const breaksAfter = /[,.:;!?]$/.test(words[i]);
    if (isCapitalized && !isNoise && i > 0) {
      phrase.push(word);
      if (breaksAfter) {
        if (phrase.length >= 2) addPhrase(phrase.join(" "));
        phrase = [];
      }
    } else {
      if (phrase.length >= 2) addPhrase(phrase.join(" "));
      phrase = [];
    }
  }
  if (phrase.length >= 2) addPhrase(phrase.join(" "));

  return [...found.values()].slice(0, 8);
}

export function entitySlug(entity: string): string {
  return slugify(entity, 60);
}
