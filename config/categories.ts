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
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  path: string;
  description: string;
  /** Lower-cased keywords/phrases scored against title + description. */
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
      "regulation", "executive order", "byelection", "riding", "mp ", "mpp",
      "democrat", "republican", "liberal party", "conservative party", "ndp",
      "bloc québécois", "governor general",
    ],
    providerAliases: ["politics", "nation", "general"],
  },
  business: {
    id: "business",
    label: "Business",
    path: "/business",
    description:
      "Markets, companies, employment, trade and the North American economy.",
    keywords: [
      "market", "stocks", "shares", "earnings", "inflation", "interest rate",
      "federal reserve", "bank of canada", "economy", "economic", "gdp", "jobs report",
      "unemployment", "employment", "merger", "acquisition", "ipo", "startup funding",
      "revenue", "profit", "quarterly", "trade deal", "tariff", "exports", "imports",
      "housing market", "mortgage", "real estate", "banking", "bank", "investor",
      "wall street", "bay street", "tsx", "nasdaq", "dow jones", "s&p 500",
      "oil prices", "energy prices", "retail sales", "consumer spending", "layoffs",
      "labor", "labour", "union", "strike", "supply chain", "manufacturing",
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
      "artificial intelligence", "ai model", "ai ", "machine learning", "chatbot",
      "software", "hardware", "semiconductor", "chip", "cybersecurity", "hack",
      "data breach", "ransomware", "privacy", "social media", "app", "smartphone",
      "cloud computing", "data center", "datacentre", "robotics", "autonomous",
      "tech company", "silicon valley", "startup", "algorithm", "encryption",
      "quantum computing", "broadband", "5g", "streaming platform", "gaming",
      "electric vehicle", "self-driving", "tech regulation", "antitrust",
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
      "international", "global", "overseas", "foreign policy", "state visit",
      "world leaders", "geneva", "brussels", "beijing", "moscow", "london",
      "tokyo", "paris", "berlin", "kyiv", "middle east", "asia-pacific",
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
    ],
    providerAliases: ["health", "medical"],
  },
  science: {
    id: "science",
    label: "Science",
    path: "/science",
    description: "Research, space exploration and scientific discovery.",
    keywords: [
      "nasa", "space", "spacecraft", "satellite", "launch", "astronaut", "mars",
      "moon mission", "telescope", "research", "researchers", "study finds",
      "scientists", "scientific", "physics", "biology", "chemistry", "genome",
      "fossil", "archaeology", "asteroid", "canadian space agency", "csa",
      "discovery", "laboratory", "experiment", "peer-reviewed", "quantum",
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
      "music", "album", "concert tour", "book", "novel", "author", "publishing",
      "museum", "art exhibit", "festival", "award", "oscars", "grammys", "emmys",
      "documentary", "broadway", "theatre", "theater", "celebrity", "media industry",
      "journalism", "newspaper industry", "podcast", "culture",
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
    ],
    providerAliases: ["sports", "sport"],
  },
};

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES[id].label;
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}
