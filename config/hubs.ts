/**
 * Curated topic hubs — permanent, non-exclusive tag pages for the evergreen
 * searches the nine exclusive sections cannot answer ("AI news",
 * "immigration news", "housing market news", "midterm elections 2026").
 *
 * A story belongs to a hub when its headline/summary carries enough of the
 * hub's vocabulary (see lib/news/hubs.ts for the rule). Membership is a
 * TAG: a story can be Politics AND Immigration AND Courts. Sections stay
 * exclusive; hubs are additive — so adding a hub can never move a story out
 * of its section or destabilize the classifier benchmark.
 *
 * Keywords are matched on word boundaries with an optional plural "s",
 * lower-cased, against title + summary. Keep entries unambiguous: no bare
 * "ice" (hockey, weather), no bare "space" (office space), no bare "trial"
 * alone deciding anything (see scoring rule).
 */
import type { CategoryId } from "./categories";

export const HUB_IDS = [
  "ai",
  "elections",
  "immigration",
  "courts",
  "crime",
  "education",
  "housing",
  "jobs",
  "money",
  "weather",
  "energy",
  "space",
  "autos",
  "travel",
  "obituaries",
] as const;

export type HubId = (typeof HUB_IDS)[number];

export interface HubDefinition {
  id: HubId;
  /** Nav/chip label. */
  label: string;
  /** Search-phrased page title (becomes the h1 and <title>). */
  title: string;
  description: string;
  /** Sections this hub is most related to — drives cross-links both ways. */
  sections: CategoryId[];
  /**
   * Strong vocabulary: one hit in the HEADLINE qualifies the story on its
   * own (a hit in the summary counts half).
   */
  keywords: string[];
  /** Vocabulary that cancels a match (idiom/other-sense collisions). */
  negatives?: string[];
}

export const HUBS: Record<HubId, HubDefinition> = {
  ai: {
    id: "ai",
    label: "AI",
    title: "AI News — Today's Top Artificial Intelligence Stories",
    description:
      "The latest artificial intelligence news: OpenAI, Anthropic, Google, Nvidia, AI regulation, chatbots and the businesses and jobs AI is changing.",
    sections: ["technology", "business"],
    keywords: [
      "artificial intelligence", "ai", "a.i.", "ai model", "ai models", "generative ai",
      "openai", "chatgpt", "anthropic", "claude", "gemini", "copilot", "deepmind",
      "large language model", "llm", "machine learning", "chatbot", "ai agent",
      "ai agents", "ai chip", "ai chips", "nvidia", "ai startup", "ai regulation",
      "deepfake", "deepfakes", "ai-generated", "ai generated", "superintelligence",
      "ai safety", "ai race", "ai boom", "data center", "data centers",
    ],
    negatives: ["ai weiwei"],
  },
  elections: {
    id: "elections",
    label: "Elections 2026",
    title: "Election News 2026 — Midterms, Races and Polls",
    description:
      "The 2026 midterm elections and every race that matters: Senate, House and governor contests, primaries, polls, candidates, ballots and voting rules in the US.",
    sections: ["politics"],
    keywords: [
      "midterm", "midterms", "election", "elections", "primary election", "primaries",
      "ballot", "ballots", "voters", "voter", "polling", "poll", "polls", "candidate",
      "candidates", "campaign trail", "senate race", "house race", "governor's race",
      "gubernatorial", "special election", "byelection", "by-election", "early voting",
      "redistricting", "gerrymander", "gerrymandering", "super pac", "endorsement",
      "endorses", "runoff", "incumbent", "reelection", "re-election", "electoral",
      "swing state", "swing states", "battleground", "voting rights", "mail-in",
      "turnout", "nomination", "nominee", "caucus",
    ],
    negatives: ["poll position", "opinion poll finds", "hall of fame ballot", "mvp ballot", "all-star ballot"],
  },
  immigration: {
    id: "immigration",
    label: "Immigration",
    title: "Immigration News — Border, Deportations, Visas and Asylum",
    description:
      "Immigration news across the US and Canada: border enforcement, deportations, asylum, visas, citizenship, refugees and the politics and courts around them.",
    sections: ["politics", "world"],
    keywords: [
      "immigration", "immigrant", "immigrants", "migrant", "migrants", "deportation",
      "deportations", "deported", "deport", "asylum", "asylum seeker", "asylum seekers",
      "refugee", "refugees", "border patrol", "border crossing", "border crossings",
      "southern border", "border wall", "ice agents", "ice raid", "ice raids",
      "immigration and customs enforcement", "customs and border protection", "cbp",
      "visa", "visas", "h-1b", "green card", "green cards", "daca", "dreamers",
      "naturalization", "citizenship", "undocumented", "detention center",
      "immigration court", "immigration judge", "temporary protected status",
      "irregular migration", "migration",
    ],
  },
  courts: {
    id: "courts",
    label: "Courts & Law",
    title: "Courts & Law News — Rulings, Trials and Lawsuits",
    description:
      "Court and legal news: Supreme Court decisions, federal and state rulings, major trials, indictments, lawsuits and the judges and prosecutors shaping them.",
    sections: ["politics"],
    keywords: [
      "supreme court", "scotus", "appeals court", "court of appeals", "federal judge",
      "judge rules", "judge blocks", "judge orders", "court rules", "court blocks",
      "ruling", "rules that", "lawsuit", "lawsuits", "sues", "sued", "indictment",
      "indicted", "verdict", "sentenced", "sentencing", "jury", "injunction",
      "plea deal", "pleads guilty", "pleaded guilty", "convicted", "conviction",
      "acquitted", "district court", "trial begins", "on trial", "prosecutors",
      "prosecutor", "attorney general", "subpoena", "class action", "settlement",
      "legal challenge", "appeal", "appeals", "overturns", "overturned", "upholds",
      "justices", "chief justice", "arraigned", "arraignment", "grand jury",
    ],
    negatives: ["food court", "basketball court", "tennis court", "court side", "courtside", "on court"],
  },
  crime: {
    id: "crime",
    label: "Crime",
    title: "Crime News — Shootings, Arrests and Investigations",
    description:
      "Crime and public-safety news: shootings, homicides, arrests, manhunts, police investigations and court charges across the United States and Canada.",
    sections: ["politics"],
    keywords: [
      "shooting", "shootings", "shot dead", "shot and killed", "gunman", "gunfire",
      "mass shooting", "homicide", "homicides", "murder", "murdered", "murders",
      "stabbing", "stabbed", "arrested", "arrest", "arrests", "manhunt", "robbery",
      "robbed", "armed robbery", "assault", "assaulted", "kidnapping", "kidnapped",
      "abducted", "abduction", "suspect", "suspects", "charged with", "charges",
      "carjacking", "sexual assault", "missing woman", "missing man", "missing girl",
      "missing boy", "body found", "bodies found", "police said", "police say",
      "officer-involved", "fatal shooting", "fatally shot", "hit-and-run", "hit and run",
      "burglary", "fraud scheme", "ponzi", "smuggling", "trafficking", "drug bust",
      "cartel", "gang", "serial killer", "cold case", "wanted", "manslaughter",
      "attempted murder", "bomb threat", "hostage",
    ],
    negatives: ["crime drama", "crime thriller", "true crime podcast", "crime novel"],
  },
  education: {
    id: "education",
    label: "Education",
    title: "Education News — Schools, Colleges and Students",
    description:
      "Education news: K-12 schools, school boards, teachers, universities, tuition, student loans, campus policy and the department of education in the US and Canada.",
    sections: ["politics"],
    keywords: [
      "school", "schools", "school district", "school board", "students", "student",
      "teachers", "teacher", "university", "universities", "college", "colleges",
      "campus", "tuition", "student loan", "student loans", "curriculum",
      "superintendent", "k-12", "classroom", "classrooms", "enrollment", "enrolment",
      "department of education", "higher education", "school year", "back to school",
      "school shooting", "principal", "kindergarten", "preschool", "charter school",
      "charter schools", "school choice", "vouchers", "graduation", "graduates",
      "scholarship", "scholarships", "financial aid", "pell grant", "professor",
      "faculty", "school funding", "literacy",
    ],
    negatives: ["school of thought", "old school", "film school reunion", "schooled"],
  },
  housing: {
    id: "housing",
    label: "Housing",
    title: "Housing Market News — Home Prices, Rent and Mortgages",
    description:
      "Housing news: home prices, mortgage rates, rent, the housing shortage, affordable housing, real estate markets and homelessness policy in the US and Canada.",
    sections: ["business"],
    keywords: [
      "housing", "housing market", "home prices", "house prices", "home sales",
      "mortgage", "mortgages", "mortgage rates", "rent", "rents", "rental", "rentals",
      "renters", "landlord", "landlords", "real estate", "homebuyers", "homebuyer",
      "homeowners", "homeownership", "affordable housing", "housing shortage",
      "housing crisis", "homelessness", "homeless", "zoning", "eviction", "evictions",
      "condo", "condos", "realtor", "realtors", "home builders", "homebuilders",
      "housing starts", "first-time buyers", "property taxes", "foreclosure",
      "foreclosures", "apartment", "apartments", "housing costs",
    ],
    negatives: ["rent the runway", "for rent sign", "low rent", "rent-a-", "housing the", "pay rent to"],
  },
  jobs: {
    id: "jobs",
    label: "Jobs & Labor",
    title: "Jobs & Labor News — Employment, Layoffs and Unions",
    description:
      "Jobs and labor news: the monthly jobs report, unemployment, layoffs, hiring, wages, strikes, unions and the changing workplace across the US and Canada.",
    sections: ["business"],
    keywords: [
      "jobs report", "jobs", "job cuts", "job losses", "job market", "unemployment",
      "jobless", "jobless claims", "layoffs", "layoff", "laid off", "hiring",
      "hiring freeze", "labor market", "labour market", "union", "unions", "unionize",
      "unionized", "strike", "strikes", "walkout", "picket", "picket line", "workers",
      "employees", "wages", "wage", "minimum wage", "employment", "payrolls",
      "collective bargaining", "labor department", "labour", "labor", "workforce",
      "remote work", "return to office", "furlough", "furloughs", "severance",
      "gig workers", "overtime", "worker shortage", "labor shortage",
    ],
    negatives: ["steve jobs", "strike out", "strikeout", "strikeouts", "strike zone", "lightning strike", "airstrike", "air strike", "strike on", "strikes on", "missile strike", "drone strike", "strike force", "three strikes", "hunger strike", "union station", "european union", "union address", "soviet union", "credit union", "rugby union", "union jack"],
  },
  money: {
    id: "money",
    label: "Money",
    title: "Money & Personal Finance News — Prices, Rates and Taxes",
    description:
      "Personal finance news that hits your wallet: inflation, interest rates, mortgage and credit-card rates, gas and grocery prices, taxes and retirement savings.",
    sections: ["business"],
    keywords: [
      "inflation", "interest rate", "interest rates", "rate cut", "rate hike",
      "credit card", "credit cards", "savings", "retirement", "401(k)", "401k", "ira",
      "social security", "taxes", "tax refund", "tax refunds", "tax bill", "irs",
      "consumer prices", "cost of living", "gas prices", "grocery prices",
      "food prices", "prices rose", "prices fell", "price hike", "price hikes",
      "tariffs", "tariff", "student loans", "mortgage rates", "insurance premiums",
      "premiums", "cpi", "consumer price index", "paycheck", "paychecks", "pensions",
      "pension", "debt", "credit score", "bank fees", "overdraft", "stimulus",
      "child tax credit", "tax credit", "tax credits", "budget", "household budgets",
      "affordability", "rent prices", "utility bills", "energy bills", "fed rate",
      "bank of canada", "federal reserve",
    ],
    negatives: ["budget airline", "budget cuts to", "defense budget", "pentagon budget", "box-office", "box office", "national debt ceiling"],
  },
  weather: {
    id: "weather",
    label: "Weather",
    title: "Weather News — Storms, Heat, Floods and Wildfires",
    description:
      "Severe weather news: hurricanes, tropical storms, tornadoes, floods, heat waves, wildfires, blizzards and the forecasts and warnings across the US and Canada.",
    sections: ["climate"],
    keywords: [
      "hurricane", "hurricanes", "tropical storm", "tropical storms", "tornado",
      "tornadoes", "flood", "floods", "flooding", "flash flood", "flash flooding",
      "heat wave", "heatwave", "heat dome", "extreme heat", "heat advisory",
      "wildfire", "wildfires", "blizzard", "winter storm", "snowstorm", "snow",
      "ice storm", "severe weather", "severe storms", "thunderstorm", "thunderstorms",
      "storm", "storms", "storm surge", "evacuation order", "evacuation orders",
      "national weather service", "weather service", "environment canada",
      "drought", "typhoon", "cyclone", "landslide", "mudslide", "hail", "hailstorm",
      "power outages", "forecast", "forecasters", "cold snap", "polar vortex",
      "frost", "windstorm", "high winds", "rainfall", "record heat", "record cold",
      "monsoon", "atmospheric river", "dust storm", "smoke advisory", "air quality alert",
    ],
    negatives: ["storm the", "stormed", "brainstorm", "political storm", "firestorm", "storm of criticism", "perfect storm", "weather the", "weathered", "snow white", "jon snow", "desert storm", "under the weather", "storm chasers film", "storming"],
  },
  energy: {
    id: "energy",
    label: "Energy",
    title: "Energy News — Oil, Gas, Power Grid and Renewables",
    description:
      "Energy news: oil and gas prices, OPEC, pipelines, electricity and the grid, nuclear, solar and wind power, utilities and energy policy in the US and Canada.",
    sections: ["business", "climate"],
    keywords: [
      "oil prices", "oil price", "crude oil", "crude", "opec", "natural gas", "lng",
      "pipeline", "pipelines", "electricity", "power grid", "the grid", "grid",
      "nuclear plant", "nuclear power", "nuclear reactor", "reactors", "solar",
      "solar power", "solar panels", "wind power", "wind farm", "wind farms", "wind turbines",
      "offshore wind", "renewable", "renewables", "renewable energy", "clean energy",
      "battery storage", "utility", "utilities", "power plant", "power plants",
      "coal plant", "coal", "gasoline", "gas prices", "oil sands", "refinery",
      "refineries", "blackout", "blackouts", "power outage", "energy prices",
      "energy bills", "hydro", "hydroelectric", "fracking", "drilling", "oil and gas",
      "energy department", "department of energy", "energy secretary", "electric bills",
      "transmission lines", "geothermal", "energy crisis", "fuel prices",
    ],
    negatives: ["energy drink", "energy drinks", "low energy", "high energy", "nervous energy", "energy and enthusiasm", "positive energy", "grid iron", "gridiron", "starting grid", "coal miners' strike"],
  },
  space: {
    id: "space",
    label: "Space",
    title: "Space News — NASA, SpaceX, Launches and Discoveries",
    description:
      "Space news: NASA and Canadian Space Agency missions, SpaceX and Blue Origin launches, astronauts, the Moon and Mars, satellites, telescopes and new discoveries.",
    sections: ["science"],
    keywords: [
      "nasa", "spacex", "blue origin", "rocket", "rockets", "rocket launch",
      "launch pad", "liftoff", "lift-off", "astronaut", "astronauts", "orbit",
      "orbital", "satellite", "satellites", "the moon", "moon landing", "moon mission",
      "lunar", "mars", "martian", "space station", "iss", "telescope", "james webb",
      "hubble", "asteroid", "asteroids", "comet", "starship", "artemis", "starlink",
      "spacecraft", "spaceflight", "spacewalk", "space agency", "canadian space agency",
      "space force", "exoplanet", "exoplanets", "black hole", "black holes", "galaxy",
      "galaxies", "solar system", "jupiter", "saturn", "venus", "mercury", "pluto",
      "meteor", "meteor shower", "eclipse", "cosmic", "cosmos", "space tourism",
      "space debris", "space junk", "rocket lab", "ula", "atlas v", "falcon 9",
    ],
    negatives: ["office space", "parking space", "green space", "storage space", "space heater", "breathing space", "space bar", "spaced out", "space in the", "space for", "mercury rising", "freddie mercury", "venus williams", "mars bars", "bruno mars", "mercury levels", "mercury poisoning", "orbit gum"],
  },
  autos: {
    id: "autos",
    label: "Autos & EVs",
    title: "Auto Industry & EV News — Carmakers, Recalls and Electric Vehicles",
    description:
      "Auto news: electric vehicles, Tesla, Ford, GM, Stellantis, Toyota and Honda, recalls, car prices and tariffs, self-driving cars and the factories behind them.",
    sections: ["business", "technology"],
    keywords: [
      "electric vehicle", "electric vehicles", "ev", "evs", "ev sales", "ev maker",
      "ev charging", "tesla", "ford", "general motors", "gm", "stellantis", "toyota",
      "honda", "hyundai", "kia", "nissan", "volkswagen", "bmw", "mercedes", "rivian",
      "lucid", "automaker", "automakers", "carmaker", "carmakers", "auto industry",
      "auto recall", "recall", "recalls", "recalled", "car sales", "auto sales",
      "self-driving", "self driving", "robotaxi", "robotaxis", "waymo", "autopilot",
      "nhtsa", "pickup truck", "pickup trucks", "suv", "suvs", "auto tariffs",
      "auto workers", "uaw", "assembly plant", "auto plant", "car prices", "dealership",
      "dealerships", "hybrid", "hybrids", "cybertruck", "auto loans", "car loan",
    ],
    negatives: ["recall election", "recall vote", "recalls the", "recall how", "recalled how", "recalls that", "ford foundation", "harrison ford", "gm crops", "gm food", "ev wurl"],
  },
  travel: {
    id: "travel",
    label: "Travel",
    title: "Travel News — Airlines, Airports, Flights and Tourism",
    description:
      "Travel news: airlines and flight disruptions, airports and the TSA, air traffic control, cruises, passports, travel advisories and the cost of getting away.",
    sections: ["business"],
    keywords: [
      "airline", "airlines", "flight", "flights", "airport", "airports", "tsa",
      "faa", "air traffic", "air traffic control", "air traffic controllers", "cruise",
      "cruises", "cruise ship", "passport", "passports", "travel advisory",
      "travel ban", "tourism", "tourists", "tourist", "hotel", "hotels", "air canada",
      "westjet", "delta air lines", "united airlines", "american airlines", "southwest",
      "jetblue", "spirit airlines", "alaska airlines", "porter airlines", "boeing",
      "airbus", "pilots", "flight attendants", "baggage", "checked bags", "real id",
      "summer travel", "holiday travel", "travel season", "airfare", "airfares",
      "flight delays", "flight cancellations", "cancellations", "travelers",
      "travellers", "vacation", "vacations", "theme park", "disney world", "amtrak",
      "via rail", "high-speed rail", "border wait times",
    ],
    negatives: ["flight of", "in flight from", "flight risk", "took flight", "white flight", "capital flight", "flight path of", "southwest border", "southwest ohio", "southwest virginia", "southwest florida", "southwest texas", "hotel california", "cruise control", "tom cruise"],
  },
  obituaries: {
    id: "obituaries",
    label: "Obituaries",
    title: "Obituaries & Notable Deaths — Who Died Today",
    description:
      "Notable deaths and obituaries: the actors, musicians, athletes, politicians, scientists and public figures who have died, covered across the US and Canada.",
    sections: ["culture"],
    keywords: [
      "dies at", "dies aged", "dead at", "has died", "passes away", "passed away",
      "obituary", "obituaries", "dies after", "died at the age", "died at age",
      "dies at age", "dies peacefully", "remembered as", "tributes pour", "tributes paid",
      "rip", "mourns", "mourned", "in memoriam", "laid to rest", "funeral",
    ],
    negatives: ["dies after crash", "dies in crash", "dies in shooting", "dies after shooting", "dies in fire", "dies after being", "dies in custody", "dies at hospital after", "dies after police", "funeral home fire", "rip current", "rip currents", "rip tide", "rip off", "rip-off", "ripped", "funeral costs"],
  },
};

export function isHubId(value: string): value is HubId {
  return (HUB_IDS as readonly string[]).includes(value);
}

/** Hubs that list `category` among their related sections. */
export function hubsForCategory(category: CategoryId): HubDefinition[] {
  return HUB_IDS.map((id) => HUBS[id]).filter((hub) =>
    hub.sections.includes(category),
  );
}
