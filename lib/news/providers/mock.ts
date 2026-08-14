import type { NewsProvider, RawArticle } from "@/lib/news/types";

/**
 * Mock provider for development and demos.
 *
 * Every article is flagged isMock and attributed to clearly fictional demo
 * outlets (Continental Wire, True North Broadcasting, …) — never to real
 * publishers. Headlines describe generic institutional processes and contain
 * no invented facts, figures, or named individuals. The UI shows a DEMO DATA
 * banner and per-story DEMO badges whenever this data is active.
 *
 * Multi-source seeds exercise the clustering, coverage and ranking systems.
 */

interface MockCoverage {
  /** Demo outlet name (must exist in config/sources.ts demo list). */
  outlet: string;
  /** Minutes before "now" this variant was published. */
  minutesAgo: number;
  /** Optional headline variant; defaults to the seed title. */
  title?: string;
}

interface MockSeed {
  key: string;
  title: string;
  description: string;
  category: string;
  /** Hint only — the classifier still runs on the text. */
  country: "us" | "ca" | "global";
  image?: string;
  coverage: MockCoverage[];
}

const OUTLET_DOMAINS: Record<string, string> = {
  "Continental Wire": "continentalwire.demo",
  "North American Press": "napress.demo",
  "True North Broadcasting": "truenorth.demo",
  "Capitol Journal": "capitoljournal.demo",
  "Maple Leaf Times": "mapleleaftimes.demo",
  "Atlantic Business Review": "atlanticbusiness.demo",
  "Pacific Standard News": "pacificstandard.demo",
  "Prairie Post": "prairiepost.demo",
  "Great Lakes Gazette": "greatlakesgazette.demo",
  "Northern Tech Desk": "northerntechdesk.demo",
};

const SEEDS: MockSeed[] = [
  // ── Business / breaking ────────────────────────────────────────────────
  {
    key: "fed-rate-decision",
    title: "Federal Reserve holds benchmark interest rate steady after policy meeting",
    description:
      "The central bank kept its benchmark rate unchanged following its scheduled policy meeting, with officials pointing to incoming inflation data ahead of the next decision.",
    category: "business",
    country: "us",
    image: "/placeholders/business-1.svg",
    coverage: [
      { outlet: "Continental Wire", minutesAgo: 28 },
      { outlet: "North American Press", minutesAgo: 24, title: "US Federal Reserve keeps benchmark interest rate unchanged at policy meeting" },
      { outlet: "Atlantic Business Review", minutesAgo: 21, title: "Federal Reserve leaves benchmark rate steady, cites inflation data" },
      { outlet: "Capitol Journal", minutesAgo: 18, title: "Federal Reserve holds interest rate steady as officials weigh inflation" },
      { outlet: "Pacific Standard News", minutesAgo: 12, title: "Fed holds benchmark interest rate steady after latest policy meeting" },
      { outlet: "Great Lakes Gazette", minutesAgo: 9, title: "Federal Reserve holds rate steady following policy meeting" },
    ],
  },
  {
    key: "us-jobs-report",
    title: "Monthly jobs report shows hiring pace moderating across major sectors",
    description:
      "The latest employment figures point to a gradual cooling in hiring across services and manufacturing, with analysts watching wage growth trends.",
    category: "business",
    country: "us",
    image: "/placeholders/business-2.svg",
    coverage: [
      { outlet: "North American Press", minutesAgo: 190 },
      { outlet: "Atlantic Business Review", minutesAgo: 165, title: "Jobs report shows hiring pace moderating in major sectors" },
      { outlet: "Continental Wire", minutesAgo: 150, title: "Hiring pace moderates across major sectors, monthly jobs report shows" },
    ],
  },
  {
    key: "boc-rate-path",
    title: "Bank of Canada signals cautious approach ahead of next rate decision",
    description:
      "Senior officials at the Bank of Canada emphasized a data-dependent approach to monetary policy in remarks ahead of the next scheduled rate announcement.",
    category: "business",
    country: "ca",
    image: "/placeholders/business-3.svg",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 95 },
      { outlet: "Maple Leaf Times", minutesAgo: 80, title: "Bank of Canada signals caution ahead of next interest rate decision" },
      { outlet: "Continental Wire", minutesAgo: 60, title: "Bank of Canada takes cautious tone ahead of coming rate decision" },
    ],
  },
  {
    key: "ca-housing-report",
    title: "National housing agency report highlights affordability pressures in major Canadian cities",
    description:
      "A new report from the national housing agency outlines continued affordability pressures in Toronto, Vancouver and other major markets, alongside regional construction trends.",
    category: "business",
    country: "ca",
    image: "/placeholders/business-4.svg",
    coverage: [
      { outlet: "Maple Leaf Times", minutesAgo: 240 },
      { outlet: "True North Broadcasting", minutesAgo: 210, title: "Housing agency report points to affordability pressures in major Canadian cities" },
    ],
  },
  {
    key: "softwood-trade",
    title: "US and Canada resume talks on long-running softwood lumber trade dispute",
    description:
      "Trade officials from both countries met to discuss the decades-old softwood lumber dispute, with industry groups on both sides of the border watching closely.",
    category: "business",
    country: "us",
    image: "/placeholders/world-1.svg",
    coverage: [
      { outlet: "Continental Wire", minutesAgo: 320 },
      { outlet: "True North Broadcasting", minutesAgo: 300, title: "Canada and US resume softwood lumber trade dispute talks" },
      { outlet: "Capitol Journal", minutesAgo: 280, title: "US, Canada officials resume talks on softwood lumber trade dispute" },
      { outlet: "Prairie Post", minutesAgo: 250, title: "Softwood lumber dispute talks resume between US and Canada" },
    ],
  },
  {
    key: "energy-investment",
    title: "Energy sector investment plans expand in Alberta as export capacity grows",
    description:
      "Several energy companies outlined expanded capital plans in Alberta, tied to growing export capacity and evolving provincial policy.",
    category: "business",
    country: "ca",
    coverage: [{ outlet: "Prairie Post", minutesAgo: 400 }],
  },
  {
    key: "retail-sales",
    title: "Retail sales data suggests steady consumer spending despite price pressures",
    description:
      "New retail figures indicate consumers continued spending at a steady pace, even as households manage elevated prices in key categories.",
    category: "business",
    country: "us",
    coverage: [{ outlet: "Atlantic Business Review", minutesAgo: 350 }],
  },
  {
    key: "grocery-review",
    title: "Federal review of grocery sector competition enters public comment phase",
    description:
      "The competition review of Canada's grocery sector moved into a public comment period, inviting submissions from consumers and industry.",
    category: "business",
    country: "ca",
    coverage: [{ outlet: "Maple Leaf Times", minutesAgo: 520 }],
  },

  // ── Press release (clearly fictional; exercises content-type detection,
  //    the press-release authority downgrade and Top-100 suppression) ─────
  {
    key: "demo-widget-earnings-pr",
    title:
      "Demo Widget Corp (TSX: DEMO) Announces Q2 2026 Financial Results and Normal Course Issuer Bid",
    description:
      "TORONTO — Demo Widget Corp, a fictional demonstration company, today reported its financial results for the second quarter of 2026 and announced a normal course issuer bid.",
    category: "business",
    country: "ca",
    coverage: [{ outlet: "Atlantic Business Review", minutesAgo: 45 }],
  },

  // ── Politics ───────────────────────────────────────────────────────────
  {
    key: "us-budget-talks",
    title: "Congressional negotiators continue talks on federal budget framework",
    description:
      "Lawmakers from both chambers continued negotiations over a federal budget framework, with committee leaders describing progress on spending priorities.",
    category: "politics",
    country: "us",
    image: "/placeholders/politics-1.svg",
    coverage: [
      { outlet: "Capitol Journal", minutesAgo: 55 },
      { outlet: "North American Press", minutesAgo: 45, title: "Federal budget framework talks continue among congressional negotiators" },
      { outlet: "Continental Wire", minutesAgo: 35, title: "Congressional talks continue on federal budget framework" },
      { outlet: "Great Lakes Gazette", minutesAgo: 25, title: "Negotiators in Congress continue federal budget framework talks" },
    ],
  },
  {
    key: "scotus-regulatory",
    title: "Supreme Court hears arguments in case on federal regulatory authority",
    description:
      "The court heard oral arguments in a closely watched case examining the scope of federal agencies' regulatory authority.",
    category: "politics",
    country: "us",
    image: "/placeholders/politics-2.svg",
    coverage: [
      { outlet: "Capitol Journal", minutesAgo: 130 },
      { outlet: "Continental Wire", minutesAgo: 110, title: "US Supreme Court hears arguments on federal regulatory authority" },
    ],
  },
  {
    key: "election-administration",
    title: "State officials outline election administration plans ahead of fall voting",
    description:
      "Election officials in several states presented administration and security plans ahead of scheduled fall elections.",
    category: "politics",
    country: "us",
    coverage: [{ outlet: "North American Press", minutesAgo: 300 }],
  },
  {
    key: "healthcare-committee",
    title: "Senate committee advances healthcare coverage bill to floor debate",
    description:
      "A Senate committee voted to advance a healthcare coverage bill, setting up floor debate in the coming weeks.",
    category: "politics",
    country: "us",
    coverage: [
      { outlet: "Capitol Journal", minutesAgo: 380 },
      { outlet: "Pacific Standard News", minutesAgo: 340, title: "Healthcare coverage bill advances from Senate committee to floor debate" },
    ],
  },
  {
    key: "ca-housing-bill",
    title: "Parliament debates housing supply legislation as fall session continues",
    description:
      "Members of Parliament debated proposed housing supply legislation, with provincial governments watching the federal framework closely.",
    category: "politics",
    country: "ca",
    image: "/placeholders/politics-3.svg",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 75 },
      { outlet: "Maple Leaf Times", minutesAgo: 65, title: "Housing supply legislation debated in Parliament during fall session" },
      { outlet: "Prairie Post", minutesAgo: 50, title: "Parliament continues debate on housing supply legislation" },
    ],
  },
  {
    key: "health-transfer-talks",
    title: "Federal and provincial ministers meet on healthcare funding transfers",
    description:
      "Health ministers from Ottawa and the provinces met to discuss the structure of federal healthcare funding transfers.",
    category: "politics",
    country: "ca",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 260 },
      { outlet: "Maple Leaf Times", minutesAgo: 230, title: "Healthcare funding transfers on agenda as federal, provincial ministers meet" },
    ],
  },
  {
    key: "immigration-targets",
    title: "Government opens consultation on annual immigration targets",
    description:
      "The federal government opened a consultation period on annual immigration targets, seeking input from provinces, employers and settlement organizations.",
    category: "politics",
    country: "ca",
    coverage: [{ outlet: "Maple Leaf Times", minutesAgo: 430 }],
  },
  {
    key: "defence-procurement",
    title: "Defence procurement review examines shipbuilding and aircraft programs",
    description:
      "A federal review of defence procurement is examining timelines and costs across major shipbuilding and aircraft programs.",
    category: "politics",
    country: "ca",
    coverage: [{ outlet: "True North Broadcasting", minutesAgo: 600 }],
  },

  // ── Technology ─────────────────────────────────────────────────────────
  {
    key: "ai-framework",
    title: "Lawmakers weigh artificial intelligence safety framework in committee hearings",
    description:
      "Committee hearings continued on a proposed artificial intelligence safety framework, with testimony from researchers, industry and civil society groups.",
    category: "technology",
    country: "us",
    image: "/placeholders/technology-1.svg",
    coverage: [
      { outlet: "Northern Tech Desk", minutesAgo: 85 },
      { outlet: "Capitol Journal", minutesAgo: 70, title: "Artificial intelligence safety framework weighed in committee hearings" },
      { outlet: "Continental Wire", minutesAgo: 55, title: "Committee hearings continue on artificial intelligence safety framework" },
      { outlet: "Pacific Standard News", minutesAgo: 40, title: "Lawmakers continue hearings on artificial intelligence safety framework" },
    ],
  },
  {
    key: "telecom-breach",
    title: "Telecommunications provider investigates data breach affecting customer records",
    description:
      "A major telecommunications provider said it is investigating a data breach involving customer account records, working with cybersecurity investigators.",
    category: "technology",
    country: "ca",
    image: "/placeholders/technology-2.svg",
    coverage: [
      { outlet: "Northern Tech Desk", minutesAgo: 38 },
      { outlet: "True North Broadcasting", minutesAgo: 26, title: "Data breach at telecommunications provider under investigation, customer records affected" },
      { outlet: "Maple Leaf Times", minutesAgo: 14, title: "Telecommunications provider investigating data breach of customer records" },
    ],
  },
  {
    key: "chip-plant",
    title: "Semiconductor plant expansion moves forward with state incentive package",
    description:
      "A planned semiconductor manufacturing expansion cleared a key milestone after state officials finalized an incentive package.",
    category: "technology",
    country: "us",
    image: "/placeholders/technology-3.svg",
    coverage: [
      { outlet: "Pacific Standard News", minutesAgo: 200 },
      { outlet: "Atlantic Business Review", minutesAgo: 170, title: "Semiconductor manufacturing expansion advances with state incentives" },
    ],
  },
  {
    key: "social-media-rules",
    title: "Regulators publish draft rules on social media platform transparency",
    description:
      "Draft transparency rules for large social media platforms were published for comment, covering recommendation systems and advertising disclosures.",
    category: "technology",
    country: "us",
    coverage: [{ outlet: "Northern Tech Desk", minutesAgo: 330 }],
  },
  {
    key: "quantum-funding",
    title: "Research agencies announce quantum computing funding for university labs",
    description:
      "Federal research agencies announced new funding for university quantum computing laboratories across several provinces.",
    category: "technology",
    country: "ca",
    coverage: [{ outlet: "Northern Tech Desk", minutesAgo: 470 }],
  },

  // ── World ──────────────────────────────────────────────────────────────
  {
    key: "g7-finance",
    title: "G7 finance ministers discuss coordinated approach to global economic risks",
    description:
      "Finance ministers from G7 nations met to discuss coordination on global economic risks, including supply chains and financial stability.",
    category: "world",
    country: "global",
    image: "/placeholders/world-2.svg",
    coverage: [
      { outlet: "Continental Wire", minutesAgo: 140 },
      { outlet: "North American Press", minutesAgo: 120, title: "Finance ministers from G7 discuss global economic risk coordination" },
      { outlet: "True North Broadcasting", minutesAgo: 100, title: "G7 finance ministers meet on coordinated response to global economic risks" },
    ],
  },
  {
    key: "eu-trade-talks",
    title: "Trade negotiations with European Union enter new round on digital commerce",
    description:
      "Negotiators opened a new round of trade talks with the European Union focused on digital commerce and services.",
    category: "world",
    country: "global",
    coverage: [
      { outlet: "Continental Wire", minutesAgo: 290 },
      { outlet: "Atlantic Business Review", minutesAgo: 260, title: "New round of European Union trade negotiations focuses on digital commerce" },
    ],
  },
  {
    key: "un-climate-session",
    title: "United Nations climate session focuses on adaptation financing commitments",
    description:
      "Delegates at a United Nations climate session worked through proposals on adaptation financing ahead of the next major conference.",
    category: "world",
    country: "global",
    coverage: [{ outlet: "Continental Wire", minutesAgo: 420 }],
  },
  {
    key: "norad-exercise",
    title: "NORAD concludes joint continental defence exercise with US and Canadian forces",
    description:
      "The joint US-Canada air defence command concluded a scheduled continental defence exercise involving forces from both countries.",
    category: "world",
    country: "global",
    coverage: [
      { outlet: "North American Press", minutesAgo: 500 },
      { outlet: "True North Broadcasting", minutesAgo: 470, title: "US and Canadian forces conclude joint NORAD continental defence exercise" },
    ],
  },

  // ── Climate ────────────────────────────────────────────────────────────
  {
    key: "bc-wildfires",
    title: "Wildfire crews respond to active fires across British Columbia interior",
    description:
      "Provincial wildfire crews are responding to active fires in the British Columbia interior, with evacuation alerts issued for several communities.",
    category: "climate",
    country: "ca",
    image: "/placeholders/climate-1.svg",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 42 },
      { outlet: "Prairie Post", minutesAgo: 30, title: "Active wildfires across British Columbia interior draw provincial crews" },
      { outlet: "Continental Wire", minutesAgo: 18, title: "British Columbia wildfire crews respond to active interior fires" },
    ],
  },
  {
    key: "gulf-hurricane-prep",
    title: "Gulf Coast states review hurricane preparedness as season peaks",
    description:
      "Emergency management agencies across Gulf Coast states reviewed hurricane preparedness plans as the season reaches its historical peak.",
    category: "climate",
    country: "us",
    image: "/placeholders/climate-2.svg",
    coverage: [
      { outlet: "North American Press", minutesAgo: 220 },
      { outlet: "Great Lakes Gazette", minutesAgo: 190, title: "Hurricane preparedness under review in Gulf Coast states as season peaks" },
    ],
  },
  {
    key: "grid-modernization",
    title: "Utility regulators advance electric grid modernization proposals",
    description:
      "State utility regulators advanced a set of grid modernization proposals covering transmission upgrades and extreme weather resilience.",
    category: "climate",
    country: "us",
    coverage: [{ outlet: "Pacific Standard News", minutesAgo: 390 }],
  },
  {
    key: "emissions-consultation",
    title: "Federal emissions policy consultation draws submissions from industry and provinces",
    description:
      "A consultation on proposed federal emissions policy updates drew submissions from industry groups, provinces and environmental organizations.",
    category: "climate",
    country: "ca",
    coverage: [{ outlet: "Maple Leaf Times", minutesAgo: 550 }],
  },

  // ── Health ─────────────────────────────────────────────────────────────
  {
    key: "drug-pricing",
    title: "Health regulators outline next phase of prescription drug pricing rules",
    description:
      "Federal health regulators outlined the next phase of prescription drug pricing rules, with implementation details expected later this year.",
    category: "health",
    country: "us",
    image: "/placeholders/health-1.svg",
    coverage: [
      { outlet: "North American Press", minutesAgo: 160 },
      { outlet: "Capitol Journal", minutesAgo: 135, title: "Next phase of prescription drug pricing rules outlined by health regulators" },
    ],
  },
  {
    key: "hospital-staffing",
    title: "Provincial health systems report progress on hospital staffing plans",
    description:
      "Several provincial health systems reported progress on staffing initiatives aimed at reducing emergency department wait times.",
    category: "health",
    country: "ca",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 310 },
      { outlet: "Prairie Post", minutesAgo: 280, title: "Hospital staffing plans show progress across provincial health systems" },
    ],
  },
  {
    key: "fall-vaccination",
    title: "Public health agencies prepare fall vaccination campaign guidance",
    description:
      "Public health agencies in both countries are preparing guidance for fall vaccination campaigns, with schedules expected in the coming weeks.",
    category: "health",
    country: "us",
    coverage: [{ outlet: "Continental Wire", minutesAgo: 440 }],
  },
  {
    key: "mental-health-funding",
    title: "Mental health services funding expansion announced for rural communities",
    description:
      "An expansion of mental health services funding was announced for rural and remote communities, focused on virtual care access.",
    category: "health",
    country: "ca",
    coverage: [{ outlet: "Prairie Post", minutesAgo: 580 }],
  },

  // ── Science ────────────────────────────────────────────────────────────
  {
    key: "space-telescope",
    title: "Space telescope observations give researchers new view of distant galaxies",
    description:
      "Newly released space telescope observations are giving researchers a sharper view of distant galaxy formation, according to the mission team.",
    category: "science",
    country: "us",
    image: "/placeholders/science-1.svg",
    coverage: [
      { outlet: "Continental Wire", minutesAgo: 250 },
      { outlet: "Northern Tech Desk", minutesAgo: 220, title: "Researchers get new view of distant galaxies from space telescope observations" },
    ],
  },
  {
    key: "arctic-research",
    title: "Arctic research expedition returns with new climate and ocean data",
    description:
      "A research expedition to the Canadian Arctic returned with new ocean and climate measurements to be shared with international partners.",
    category: "science",
    country: "ca",
    coverage: [{ outlet: "True North Broadcasting", minutesAgo: 480 }],
  },
  {
    key: "fusion-milestone",
    title: "National laboratory reports progress in fusion energy experiment series",
    description:
      "A national laboratory reported progress in its latest series of fusion energy experiments, with peer-reviewed results to follow.",
    category: "science",
    country: "us",
    coverage: [{ outlet: "Pacific Standard News", minutesAgo: 610 }],
  },

  // ── Culture ────────────────────────────────────────────────────────────
  {
    key: "film-festival",
    title: "Toronto film festival lineup highlights North American premieres",
    description:
      "Organizers of the Toronto film festival announced a lineup featuring a slate of North American premieres and international co-productions.",
    category: "culture",
    country: "ca",
    image: "/placeholders/culture-1.svg",
    coverage: [
      { outlet: "Maple Leaf Times", minutesAgo: 270 },
      { outlet: "Great Lakes Gazette", minutesAgo: 240, title: "North American premieres highlight Toronto film festival lineup" },
    ],
  },
  {
    key: "museum-exhibit",
    title: "Major museum exhibition explores history of transcontinental railways",
    description:
      "A new museum exhibition traces the history of transcontinental railways and their role in shaping North American cities.",
    category: "culture",
    country: "us",
    coverage: [{ outlet: "North American Press", minutesAgo: 520 }],
  },
  {
    key: "streaming-report",
    title: "Industry report examines streaming market consolidation trends",
    description:
      "A new industry report examines consolidation trends across streaming platforms and what they mean for producers and audiences.",
    category: "culture",
    country: "us",
    coverage: [{ outlet: "Pacific Standard News", minutesAgo: 640 }],
  },

  // ── Sports ─────────────────────────────────────────────────────────────
  {
    key: "nhl-trade",
    title: "NHL clubs complete multi-player trade ahead of training camps",
    description:
      "Two NHL clubs completed a multi-player trade as rosters take shape ahead of training camps opening next month.",
    category: "sports",
    country: "ca",
    image: "/placeholders/sports-1.svg",
    coverage: [
      { outlet: "True North Broadcasting", minutesAgo: 110 },
      { outlet: "Great Lakes Gazette", minutesAgo: 90, title: "Multi-player trade completed between NHL clubs ahead of training camps" },
    ],
  },
  {
    key: "nfl-preseason",
    title: "NFL preseason continues with roster battles across the league",
    description:
      "Preseason games continued across the NFL as coaching staffs evaluate roster battles ahead of final cuts.",
    category: "sports",
    country: "us",
    coverage: [{ outlet: "North American Press", minutesAgo: 180 }],
  },
  {
    key: "mlb-pennant",
    title: "MLB pennant races tighten as division leaders meet in key series",
    description:
      "Division races tightened across MLB as contending clubs opened key head-to-head series in the season's final stretch.",
    category: "sports",
    country: "us",
    coverage: [
      { outlet: "Great Lakes Gazette", minutesAgo: 230 },
      { outlet: "Pacific Standard News", minutesAgo: 205, title: "Key series between division leaders tightens MLB pennant races" },
    ],
  },
  {
    key: "cfl-standings",
    title: "CFL playoff picture takes shape as western clubs trade wins",
    description:
      "The CFL playoff picture began to take shape as western division clubs traded wins in a busy week of league play.",
    category: "sports",
    country: "ca",
    coverage: [{ outlet: "Prairie Post", minutesAgo: 360 }],
  },
];

/** Build the mock RawArticle list with timestamps relative to `now`. */
export function generateMockArticles(now: Date = new Date()): RawArticle[] {
  const articles: RawArticle[] = [];
  for (const seed of SEEDS) {
    for (const coverage of seed.coverage) {
      const outletDomain = OUTLET_DOMAINS[coverage.outlet];
      const publishedAt = new Date(
        now.getTime() - coverage.minutesAgo * 60_000,
      ).toISOString();
      articles.push({
        title: coverage.title ?? seed.title,
        description: seed.description,
        url: `https://${outletDomain}/story/${seed.key}-${slugOutlet(coverage.outlet)}`,
        source: coverage.outlet,
        sourceDomain: outletDomain,
        publishedAt,
        imageUrl: seed.image,
        providerCategory: seed.category,
        providerCountry: seed.country === "global" ? undefined : seed.country,
        provider: "mock",
        isMock: true,
      });
    }
  }
  return articles;
}

function slugOutlet(outlet: string): string {
  return outlet.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export const mockProvider: NewsProvider = {
  name: "mock",
  isConfigured() {
    return true;
  },
  async fetchLatest(): Promise<RawArticle[]> {
    return generateMockArticles();
  },
};
