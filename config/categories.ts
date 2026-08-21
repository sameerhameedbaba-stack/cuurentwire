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
   * Search-phrased <title> for the section page when "<Label> News" is not
   * how people search it (culture → "Entertainment & Culture News").
   */
  seoTitle?: string;
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
      // Live misfile round (Fauci/Sen. Johnson filed under health):
      // congressional-oversight vocabulary must outweigh a single medical
      // name. No bare "hearing" — it collides with hearing loss/aids.
      "subpoena", "senate committee", "house committee", "committee hearing",
      "congressional hearing", "oversight hearing", "testify", "testimony",
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
      // Live misfile round ("Nvidia discloses $21B stake in SpaceX" filed
      // under science): a disclosed stake is a markets story. The idiom
      // senses ("at stake", "high-stakes") are cancelled by negatives below.
      "stake",
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
      // Deep-history vocabulary. Live misfile 2026-08-19: "Theban tomb
      // reveals how Egyptian burial trends evolved in time" published to
      // /technology. Traced: the headline scored ZERO on every category, so
      // the arstechnica.com feed prior — weight 2, exactly MIN_PRIMARY_SCORE
      // — was the only signal and decided the story alone at confidence 1.0.
      // Archaeology, palaeontology and human-origins coverage had only
      // "archaeology" and "fossil" to stand on. Deliberately NO bare
      // "ancient" (metaphor magnet: "ancient codebase") and NO bare "burial"
      // (mass-burial war coverage is world) — only the precise phrases below.
      // Both spellings are listed; US outlets drop the "a".
      "archaeological", "archaeologist", "archeology", "archeological",
      "archeologist", "paleontology", "palaeontology", "paleontologist",
      "palaeontologist", "archaeological dig", "dig site",
      "tomb", "burial site", "burial chamber", "burial mound", "grave goods",
      "necropolis", "sarcophagus", "mummy", "mummies", "mummified",
      "hieroglyph", "hieroglyphic", "cave painting", "petroglyph",
      "radiocarbon", "carbon dating", "bronze age", "stone age",
      "prehistoric", "dinosaur fossil", "fossilized", "fossilised", "megafauna",
      "hominin", "hominid", "neanderthal", "denisovan", "homo sapiens",
      "ancient dna", "ancient tomb", "ancient settlement", "ancient burial",
      "ancient remains", "ancient ruins", "ancient temple",
      // Five entries were tried and REMOVED after measuring them against real
      // headline shapes — each turned a harmless `general` abstention into a
      // confident wrong /science placement:
      //   "excavation"/"excavated" — construction and utility copy:
      //     "Excavation crews hit gas line, forcing evacuation downtown"
      //     -> science 3. Replaced by "archaeological dig"; "dig site" stays.
      //   "ancient city" — the standard dateline of siege coverage:
      //     "Ancient city of Aleppo faces new shelling" -> science 4.
      //   "ancient egypt"/"ancient rome"/"ancient greece" — tourism and
      //     museum copy: "Ancient Egypt tour operator files for bankruptcy"
      //     -> science 4, beating world 3.
      //   "iron age" — label and band names: "Iron Age Records signs three
      //     new bands" -> science 4. "bronze age"/"stone age" are safe.
      //   bare "dinosaur" — franchise and metaphor: "Jurassic World sequel
      //     roars past rivals with dinosaur spectacle" -> science 3, and
      //     "Dinosaur exhibit opens at the natural history museum" fell from
      //     culture to a general tie. "dinosaur fossil" keeps the real sense;
      //     "fossil" and "paleontologist" already cover the rest.
    ],
    providerAliases: ["science", "space"],
  },
  culture: {
    id: "culture",
    label: "Culture",
    path: "/culture",
    seoTitle: "Entertainment & Culture News",
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
  // Space and research. SpaceX/Blue Origin/Virgin Galactic are NOT here:
  // they are investor-news regulars, so they moved to
  // CONDITIONAL_ENTITY_SIGNALS and only imply science alongside actual
  // space-activity vocabulary. ("Rocket Lab" stays — its own name already
  // carries the activity word.)
  "nasa": "science", "james webb": "science",
  "canadian space agency": "science", "rocket lab": "science",
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
 * Entity signals that only fire alongside supporting context. Used for
 * companies whose coverage routinely spans sections — SpaceX headlines are
 * as often investor news ("Nvidia discloses $21B stake in SpaceX", a live
 * /science misfile) as space news. The entity is matched like a regular
 * entity signal, but scores only when at least one `requires` keyword
 * co-occurs anywhere in title + description.
 */
export interface ConditionalEntitySignal {
  entity: string;
  category: CategoryId;
  /** Keywords (word-boundary + optional plural) that unlock the signal. */
  requires: string[];
}

/** Vocabulary that marks a story as being about actual space activity. */
const SPACE_ACTIVITY_CONTEXT = [
  "launch", "launches", "launched", "liftoff", "orbit", "orbital", "rocket",
  "mission", "crew", "crewed", "astronaut", "satellite", "spacecraft",
  "space station", "starship", "starlink", "booster", "capsule",
  "spaceflight", "spaceport", "lunar", "moon", "mars", "space",
];

export const CONDITIONAL_ENTITY_SIGNALS: ConditionalEntitySignal[] = [
  { entity: "spacex", category: "science", requires: SPACE_ACTIVITY_CONTEXT },
  { entity: "blue origin", category: "science", requires: SPACE_ACTIVITY_CONTEXT },
  { entity: "virgin galactic", category: "science", requires: SPACE_ACTIVITY_CONTEXT },
];

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
    // Idiom senses of the "stake" keyword ("what's at stake in the
    // election", "high-stakes hearing") are not markets coverage.
    "at stake", "high-stakes", "the stakes",
  ],
  politics: ["quarterback", "playoff"],
  science: [
    // The adventure franchise, not a dig — cancels the "tomb" keyword.
    "tomb raider",
    // The Arlington memorial, not an excavation. Recurring US ceremony copy:
    // "Tomb of the Unknown Soldier wreath ceremony marks Veterans Day"
    // scored science 3 on the lone "tomb" hit.
    "unknown soldier",
    // Entertainment-commerce framing is never science.
    "box office",
  ],
  health: [
    // "outbreak" is a health keyword; a tornado outbreak is weather.
    "tornado outbreak",
    // Live misfile: the Centcom USS Lincoln story filed under health on a
    // lone "mental health" hit. A military frame means the story's subject
    // is defense, not medicine.
    "centcom", "uss", "warship", "aircraft carrier", "carrier strike group",
  ],
};

/**
 * Financial-frame tie-break. When the top score is an exact tie that
 * includes business and one of these terms appears in the text, the story
 * is about the money — business wins the tie instead of falling to the
 * general bucket. Live misfile: "Nvidia discloses $21B stake in SpaceX"
 * (business/technology entity tie; the $21B stake IS the story).
 * Deliberately excludes "shares" — as a verb it fires on celebrity copy.
 */
export const BUSINESS_TIEBREAK_KEYWORDS = [
  "stake", "investment", "valuation", "acquisition", "merger",
  "takeover", "buyout",
];

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
  // Single-section publishers from the 2026-08 curated feed expansion.
  "sportsnet.ca": "sports",
  "cbssports.com": "sports",
  "variety.com": "culture",
  "deadline.com": "culture",
  "billboard.com": "culture",
  "hollywoodreporter.com": "culture",
  "engadget.com": "technology",
  "technologyreview.com": "technology",
  "venturebeat.com": "technology",
  "space.com": "science",
  "nasa.gov": "science",
  "phys.org": "science",
  "statnews.com": "health",
  "kffhealthnews.org": "health",
  "insideclimatenews.org": "climate",
  "grist.org": "climate",
  "housingwire.com": "business",
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
