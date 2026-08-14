/**
 * Category taxonomy and keyword dictionaries used by the deterministic
 * category classifier. Order in CATEGORY_IDS is the display order.
 */

export const CATEGORY_IDS = [
  "politics",
  "business",
  "technology",
  "world",
  "climate",
  "health",
  "science",
  "culture",
  "sports",
  "general",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/**
 * Categories exposed in navigation, filter chips and sitemaps. "general" is
 * the internal low-confidence bucket — its stories surface in /latest,
 * search and source pages, and /general renders if visited directly, but it
 * is never promoted as a main section. This keeps "World" meaning WORLD
 * (genuine international affairs) instead of "classifier wasn't sure".
 */
export const PUBLIC_CATEGORY_IDS = CATEGORY_IDS.filter(
  (id) => id !== "general",
);

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  path: string;
  description: string;
  /**
   * Lower-cased keywords/phrases scored against title + description.
   * Matched on word boundaries with an optional plural "s" — "app" never
   * fires inside "kidnapped", while "market" still matches "markets".
   */
  keywords: string[];
  /** Provider category strings that map straight to this category. */
  providerAliases: string[];
}

export const CATEGORIES: Record<CategoryId, CategoryDefinition> = {
  politics: {
    id: "politics",
    label: "Politics",
    path: "/politics",
    description:
      "Government, elections, courts and public policy across the United States and Canada.",
    keywords: [
      "election", "congress", "senate", "house of representatives", "white house",
      "president", "prime minister", "parliament", "legislation", "bill",
      "governor", "premier", "supreme court", "campaign", "vote", "ballot",
      "policy", "lawmakers", "cabinet", "minister", "senator", "impeachment",
      "federal government", "state legislature", "house speaker", "attorney general",
      "regulation", "executive order", "byelection", "riding", "mp", "mpp",
      "democrat", "republican", "liberal party", "conservative party", "ndp",
      "bloc québécois", "governor general",
      // Real-headline benchmark round: political-discourse and justice-
      // system vocabulary that dominates real US political coverage.
      "appeals court", "federal judge", "special election", "midterms",
      "socialist", "socialism", "progressives", "maga", "press secretary",
      "deportation",
    ],
    // "general" (the GNews catch-all topic) must never imply politics.
    providerAliases: ["politics", "nation"],
  },
  business: {
    id: "business",
    label: "Business",
    path: "/business",
    description:
      "Markets, companies, employment, trade and the North American economy.",
    keywords: [
      // No "shares": as a verb ("shares details", "shares photos") it fires
      // on celebrity/lifestyle coverage far more often than on markets.
      "market", "stocks", "earnings", "inflation", "interest rate",
      "federal reserve", "bank of canada", "economy", "economic", "gdp", "jobs report",
      "unemployment", "employment", "merger", "acquisition", "ipo", "startup funding",
      "revenue", "profit", "quarterly", "trade deal", "tariff", "exports", "imports",
      "housing market", "mortgage", "real estate", "banking", "bank", "investor",
      "wall street", "bay street", "tsx", "nasdaq", "dow jones", "s&p 500",
      "oil prices", "energy prices", "retail sales", "consumer spending", "layoffs",
      "labor", "labour", "union", "strike", "supply chain", "manufacturing",
      // Real-headline benchmark round.
      "treasury yield", "funding round", "valuation", "minority stake",
      "plant closure", "assembly plant", "automaker", "chairman", "rent",
    ],
    providerAliases: ["business", "economy", "finance", "money", "markets"],
  },
  technology: {
    id: "technology",
    label: "Technology",
    path: "/technology",
    description:
      "Artificial intelligence, Big Tech, cybersecurity, and technology policy.",
    keywords: [
      "artificial intelligence", "ai model", "ai", "machine learning", "chatbot",
      "software", "hardware", "semiconductor", "chip", "cybersecurity", "hack",
      "data breach", "ransomware", "privacy", "social media", "app", "smartphone",
      "cloud computing", "data center", "datacentre", "robotics", "autonomous",
      "tech company", "silicon valley", "startup", "algorithm", "encryption",
      "quantum computing", "broadband", "5g", "streaming platform", "gaming",
      "electric vehicle", "self-driving", "tech regulation", "antitrust",
      // Real-headline benchmark round: consumer-device and security terms.
      "vulnerability", "exploit", "malware", "earbuds", "headphones", "laptop",
      "smartwatch", "foldable", "handheld", "robotaxi", "surveillance",
      "app store", "cloud storage",
    ],
    providerAliases: ["technology", "tech", "sci-tech"],
  },
  world: {
    id: "world",
    label: "World",
    path: "/world",
    description:
      "Global stories with significant consequences for the United States and Canada.",
    keywords: [
      "united nations", "nato", "european union", "g7", "g20", "summit",
      "foreign minister", "diplomacy", "diplomatic", "embassy", "sanctions",
      "ceasefire", "peace talks", "treaty", "border dispute", "refugee",
      "international", "international observers", "global", "overseas",
      "foreign policy", "state visit",
      "world leaders", "geneva", "brussels", "beijing", "moscow", "london",
      "tokyo", "paris", "berlin", "kyiv", "middle east", "asia-pacific",
      "kidnapped", "kidnapping", "kidnap", "hostage", "coup", "airstrike",
      "militant", "humanitarian", "war crimes", "insurgent",
      // Compact foreign-place gazetteer: a story ABOUT one of these is
      // international affairs by definition, so crime vocabulary alone never
      // has to carry the world label (and domestic "kidnapped in Toronto"
      // coverage without any of these gets demoted, see normalize.ts).
      // Deliberately excluded for collisions: georgia (US state), jordan &
      // chad (person names), turkey (the bird).
      "niger", "nigeria", "mexico", "china", "india", "iran", "iraq",
      "israel", "gaza", "ukraine", "russia", "syria", "afghanistan",
      "pakistan", "brazil", "venezuela", "cuba", "haiti", "france",
      "germany", "italy", "spain", "japan", "taiwan", "north korea",
      "south korea", "egypt", "saudi arabia", "yemen", "lebanon", "sudan",
      "somalia", "ethiopia", "kenya", "south africa", "colombia",
      "argentina", "philippines", "indonesia", "vietnam", "thailand",
      "myanmar", "bangladesh", "sri lanka", "poland", "hungary", "belarus",
    ],
    providerAliases: ["world", "international", "global"],
  },
  climate: {
    id: "climate",
    label: "Climate",
    path: "/climate",
    description:
      "Climate, energy, extreme weather, wildfires and environmental policy.",
    keywords: [
      "climate change", "climate", "emissions", "carbon", "wildfire", "hurricane",
      "tornado", "flood", "flooding", "drought", "heat wave", "heatwave",
      "extreme weather", "storm", "blizzard", "environment", "environmental",
      "renewable energy", "solar power", "wind power", "pipeline", "oil sands",
      "fossil fuel", "net zero", "conservation", "pollution", "epa",
      "clean energy", "electric grid", "sea level", "glacier", "biodiversity",
    ],
    providerAliases: ["climate", "environment", "weather"],
  },
  health: {
    id: "health",
    label: "Health",
    path: "/health",
    description:
      "Public health, medicine, health systems and health regulation.",
    keywords: [
      "health", "hospital", "public health", "vaccine", "vaccination", "outbreak",
      "virus", "disease", "cancer", "medicare", "medicaid", "health canada",
      "fda", "cdc", "drug approval", "prescription", "mental health", "opioid",
      "physician", "nurses", "patients", "clinical trial", "treatment",
      "medical", "medicine", "surgery", "epidemic", "pandemic preparedness",
      "health care", "healthcare", "insurance coverage",
      // Real-headline benchmark round: pathogen and drug-class names carry
      // most real outbreak/recall coverage.
      "salmonella", "listeria", "covid", "covid-19", "overdose",
      "weight-loss drug", "cyclosporiasis",
    ],
    providerAliases: ["health", "medical"],
  },
  science: {
    id: "science",
    label: "Science",
    path: "/science",
    description: "Research, space exploration and scientific discovery.",
    keywords: [
      // No bare "launch": product/album/campaign launches are not science.
      "nasa", "space", "spacecraft", "satellite", "rocket launch", "space launch",
      "space station", "astronaut", "mars",
      "moon mission", "telescope", "research", "researchers", "study finds",
      "scientists", "scientific", "physics", "biology", "chemistry", "genome",
      "fossil", "archaeology", "asteroid", "canadian space agency", "csa",
      "discovery", "laboratory", "experiment", "peer-reviewed", "quantum",
      "eclipse", "exoplanet", "comet", "spaceship",
    ],
    providerAliases: ["science", "space"],
  },
  culture: {
    id: "culture",
    label: "Culture",
    path: "/culture",
    description: "Film, television, music, books, media and society.",
    keywords: [
      "film", "movie", "box office", "television", "tv series", "streaming series",
      "music", "album", "concert", "concert tour", "book", "novel", "author",
      "publishing", "museum", "art exhibit", "festival", "award", "oscars",
      "grammys", "emmys", "documentary", "broadway", "theatre", "theater",
      "celebrity", "media industry", "journalism", "newspaper industry",
      "podcast", "culture", "singer", "songwriter", "pop star", "rapper",
      "actor", "actress", "red carpet", "wedding",
    ],
    providerAliases: ["entertainment", "culture", "arts", "lifestyle"],
  },
  sports: {
    id: "sports",
    label: "Sports",
    path: "/sports",
    description: "Major US and Canadian sports coverage.",
    keywords: [
      "nfl", "nba", "nhl", "mlb", "mls", "cfl", "super bowl", "stanley cup",
      "world series", "playoffs", "playoff", "championship", "olympics", "olympic",
      "tennis", "golf", "pga", "soccer", "world cup", "hockey", "basketball",
      "baseball", "football", "quarterback", "coach", "roster", "trade deadline",
      "grey cup", "raptors", "blue jays", "maple leafs", "canucks", "oilers",
      "premier league", "champions league", "transfer window", "tight end",
      // Real-headline benchmark round: sports coverage speaks in season/
      // roster vocabulary at least as often as in league names.
      "preseason", "offseason", "training camp", "free agent", "free agency",
      "power rankings", "fantasy football", "rookie", "draft pick", "matchday",
      "striker", "goalkeeper", "midfielder", "hat trick", "medley", "sprint",
      "grandmaster", "marathon", "national title",
    ],
    providerAliases: ["sports", "sport"],
  },
  general: {
    id: "general",
    label: "General",
    path: "/general",
    description:
      "Stories that do not clearly belong to a single section yet.",
    // Deliberately empty: general is assigned only as the classifier's
    // low-confidence fallback, never by keyword evidence. The GNews
    // "general" topic is a catch-all and must not nudge anything either.
    keywords: [],
    providerAliases: [],
  },
};

/**
 * Entity → category signals for the classifier. A hit weighs like a title
 * keyword hit. Matched on word boundaries — "NFL" never fires inside
 * "inflation". Keep entries unambiguous (no "Amazon", no "Meta", no "WHO").
 */
export const ENTITY_CATEGORY_SIGNALS: Record<string, CategoryId> = {
  // Sports leagues and governing bodies
  "nfl": "sports", "nba": "sports", "mlb": "sports", "nhl": "sports",
  "mls": "sports", "cfl": "sports", "fifa": "sports", "uefa": "sports",
  "wnba": "sports", "ncaa": "sports", "pga tour": "sports", "ufc": "sports",
  "laliga": "sports", "la liga": "sports", "bundesliga": "sports",
  "serie a": "sports", "big ten": "sports", "fbs": "sports",
  "little league": "sports", "pan pacs": "sports", "wrestlemania": "sports",
  // Team names carry most real sports headlines. Only unambiguous ones —
  // no Warriors (generic), no Jets/Giants (multi-league + common noun).
  "argonauts": "sports", "elks": "sports", "roughriders": "sports",
  "alouettes": "sports", "stampeders": "sports", "redblacks": "sports",
  "tiger-cats": "sports", "blue bombers": "sports",
  "lakers": "sports", "grizzlies": "sports", "pelicans": "sports",
  "celtics": "sports", "knicks": "sports", "mavericks": "sports",
  "steelers": "sports", "raiders": "sports", "patriots": "sports",
  "cowboys": "sports", "packers": "sports", "49ers": "sports",
  "yankees": "sports", "dodgers": "sports", "red sox": "sports",
  "harbaugh": "sports", "westbrook": "sports",
  // Markets and economic institutions. "earnings"/"ipo" are keywords, not
  // entities — keeping them here double-counted the same signal.
  "federal reserve": "business", "s&p 500": "business", "dow jones": "business",
  "nasdaq": "business", "bank of canada": "business", "wall street": "business",
  "opec": "business", "imf": "business",
  // Space and research
  "spacex": "science", "nasa": "science", "james webb": "science",
  "canadian space agency": "science", "virgin galactic": "science",
  "blue origin": "science", "rocket lab": "science",
  // Big Tech. No "intel": it collides with the intelligence shorthand
  // ("US intel officials") that is common in politics/world coverage.
  "openai": "technology", "microsoft": "technology", "google": "technology",
  "nvidia": "technology", "samsung": "technology", "zuckerberg": "technology",
  "nintendo": "technology", "xbox": "technology", "playstation": "technology",
  "iphone": "technology", "android": "technology",
  // Health agencies and pharma
  "cdc": "health", "fda": "health", "health canada": "health",
  "pfizer": "health", "moderna": "health",
  // Government institutions and agencies
  "white house": "politics", "congress": "politics", "supreme court": "politics",
  "doj": "politics", "dhs": "politics", "dnc": "politics", "rnc": "politics",
  "eeoc": "politics", "fincen": "politics", "gao": "politics",
  "justice department": "politics", "homeland security": "politics",
  // International bodies
  "united nations": "world", "nato": "world", "european union": "world",
  // Environment
  "epa": "climate", "ipcc": "climate",
  // Screen and streaming
  "netflix": "culture", "hollywood": "culture",
};

/**
 * Negative keywords per category — conservative kill list for obvious false
 * positives (e.g. player-trade sports headlines matching business "trade").
 * A hit subtracts the weight of a title keyword hit.
 */
export const NEGATIVE_KEYWORDS: Partial<Record<CategoryId, string[]>> = {
  sports: ["tariff", "trade deal", "trade war", "interest rate"],
  business: [
    "box office", "trade deadline", "touchdown", "home run",
    // "bank"/"union"/"labour" keyword collisions outside finance.
    "west bank", "food bank", "labour party", "labor party", "european union",
  ],
  politics: ["quarterback", "playoff"],
  // "outbreak" is a health keyword; a tornado outbreak is weather.
  health: ["tornado outbreak"],
};

/**
 * Feed-section priors: domains whose feeds are dedicated to one section.
 * Applied to RSS articles as providerCategory with the PRIOR flag — a weak
 * nudge (weight 2 in the classifier), never absolute.
 */
export const FEED_CATEGORY_PRIORS: Record<string, CategoryId> = {
  "espn.com": "sports",
  "tsn.ca": "sports",
  "theathletic.com": "sports",
  "cnbc.com": "business",
  "financialpost.com": "business",
  "marketwatch.com": "business",
  "theverge.com": "technology",
  "arstechnica.com": "technology",
  "techcrunch.com": "technology",
  "wired.com": "technology",
  "politico.com": "politics",
  "thehill.com": "politics",
};

/** Prior for a domain, matching exact domains and their subdomains. */
export function feedCategoryPrior(domain: string | undefined): CategoryId | undefined {
  if (!domain) return undefined;
  const clean = domain.toLowerCase().replace(/^www\./, "");
  if (FEED_CATEGORY_PRIORS[clean]) return FEED_CATEGORY_PRIORS[clean];
  for (const [key, value] of Object.entries(FEED_CATEGORY_PRIORS)) {
    if (clean.endsWith(`.${key}`)) return value;
  }
  return undefined;
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES[id].label;
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}
