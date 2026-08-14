import { beforeAll, describe, expect, it, vi } from "vitest";
import { runPipeline } from "@/lib/news/pipeline";
import { getCountryData, getHomepageData } from "@/lib/news/queries";
import type { Article, NewsDataset, RawArticle, StoryCluster } from "@/lib/news/types";

/**
 * Country-surface integrity: known-US and known-CA fixtures run through the
 * REAL pipeline (normalize → classify → cluster → rank), then the homepage
 * and country-page queries must never place a US story on a Canada surface
 * or vice versa. Regression for the audit's confirmed live leak: a
 * Congressional Black Caucus story classified CA (the "cbc" acronym hit)
 * and appeared at homepage Canada "More headlines" position 8.
 */

const state = vi.hoisted(() => ({
  raw: [] as unknown[],
  dataset: null as unknown,
}));

// Feed the pipeline our fixture articles instead of the configured providers.
vi.mock("@/lib/news/providers", () => ({
  activeProviders: () => [
    {
      name: "fixture",
      isConfigured: () => true,
      fetchLatest: async () => state.raw as RawArticle[],
    },
  ],
}));

// Queries read the dataset the pipeline built — no cache/DB layers.
vi.mock("@/lib/cache/store", () => ({
  getDataset: async () => state.dataset as NewsDataset,
}));

const CAUCUS_TITLE = "Congressional Black Caucus urges DOJ to review Nolan Wells case";
const CAUCUS_DESCRIPTION =
  "Supporters of Nolan Wells' family announced that the CBC sent a request on Wednesday to the DOJ to launch a federal review into the death of the 18-year-old.";

interface FixtureSeed {
  key: string;
  title: string;
  description: string;
  category: string;
  providerCountry?: "us" | "ca";
  /** Number of demo outlets covering the story (default 1). */
  outlets?: number;
}

const OUTLETS: [name: string, domain: string][] = [
  ["Fixture Wire", "fixturewire.demo"],
  ["Sample Sentinel", "samplesentinel.demo"],
  ["Demo Dispatch", "demodispatch.demo"],
];

const US_SEEDS: FixtureSeed[] = [
  // The audit's exact live leak, with multi-outlet coverage so it ranks
  // high enough to reach curated homepage slots.
  {
    key: "black-caucus-doj",
    title: CAUCUS_TITLE,
    description: CAUCUS_DESCRIPTION,
    category: "politics",
    outlets: 3,
  },
  { key: "senate-nominations", title: "Senate committee advances judicial nominations after marathon markup", description: "The committee vote sends a slate of judicial nominations to the full chamber.", category: "politics" },
  { key: "wh-drug-costs", title: "White House outlines plan to lower prescription drug costs", description: "Officials described a phased approach to lowering prescription drug prices.", category: "politics" },
  { key: "ca-wildfire-us", title: "California wildfire forces evacuations near mountain communities", description: "Crews worked overnight as evacuation orders expanded in California.", category: "climate" },
  { key: "tx-grid", title: "Texas power grid operator warns of summer stress test", description: "The grid operator in Texas asked customers to conserve during peak hours.", category: "climate" },
  { key: "fed-split", title: "Federal Reserve officials split on the path for interest rates", description: "Minutes showed Federal Reserve policymakers divided over the timing of cuts.", category: "business" },
  { key: "scotus-social", title: "Supreme Court agrees to hear social media moderation case", description: "The Supreme Court will weigh platform moderation rules next term.", category: "technology" },
  { key: "pentagon-audit", title: "Pentagon audit flags spare parts shortfall in aircraft fleet", description: "An internal Pentagon audit found persistent spare parts shortages.", category: "politics" },
  { key: "ny-subway", title: "New York subway expansion clears final funding hurdle", description: "Transit officials in New York approved the last funding tranche.", category: "general" },
  { key: "fbi-cargo", title: "FBI arrests suspect in multistate cargo theft ring", description: "The FBI said the arrest followed a year-long investigation.", category: "general" },
  { key: "ga-runoff", title: "Georgia runoff sets an early-voting record", description: "Election officials in Georgia reported record early-voting turnout.", category: "politics" },
  { key: "mi-battery", title: "Michigan plant retools for battery production push", description: "The Michigan facility will shift lines to battery assembly next year.", category: "business" },
  { key: "boston-triage", title: "Boston hospital pilots AI triage system in emergency rooms", description: "A Boston hospital began piloting software-assisted triage.", category: "health" },
  { key: "seattle-dockworkers", title: "Seattle dockworkers ratify a new four-year contract", description: "Union members in Seattle approved the agreement by a wide margin.", category: "business" },
];

const CA_SEEDS: FixtureSeed[] = [
  {
    key: "boc-rate-path",
    title: "Bank of Canada signals cautious approach ahead of rate decision",
    description: "Officials in Ottawa emphasized a data-dependent path.",
    category: "business",
    providerCountry: "ca",
    outlets: 3,
  },
  { key: "ottawa-dental", title: "Ottawa unveils dental care expansion for seniors", description: "The federal program adds coverage for seniors starting this fall.", category: "politics", providerCountry: "ca" },
  { key: "toronto-housing", title: "Toronto housing market shows further signs of cooling", description: "Sales in Toronto slowed for a third straight month.", category: "business", providerCountry: "ca" },
  { key: "vancouver-port", title: "Vancouver port strike disrupts container shipping", description: "Terminals in Vancouver reported growing backlogs as the strike continued.", category: "business", providerCountry: "ca" },
  { key: "quebec-language", title: "Quebec tables amendments to language law", description: "The Quebec government introduced amendments after months of hearings.", category: "politics", providerCountry: "ca" },
  { key: "alberta-oilsands", title: "Alberta oil sands output hits a monthly record", description: "Producers in Alberta reported record output for the month.", category: "business", providerCountry: "ca" },
  { key: "bc-wildfire", title: "British Columbia wildfire season starts early in the interior", description: "Crews in British Columbia responded to early-season fires.", category: "climate", providerCountry: "ca" },
  { key: "manitoba-floodway", title: "Manitoba floodway spares river communities again", description: "Officials in Manitoba credited the floodway with preventing damage.", category: "climate", providerCountry: "ca" },
  { key: "sask-potash", title: "Saskatchewan potash exports climb to new highs", description: "Saskatchewan producers shipped record volumes last quarter.", category: "business", providerCountry: "ca" },
  { key: "rcmp-laundering", title: "RCMP probes money laundering network in casinos", description: "The RCMP said the investigation spans several provinces.", category: "general", providerCountry: "ca" },
  { key: "trudeau-memoir", title: "Trudeau memoir tops the bestseller list", description: "The memoir led national nonfiction sales in its first week.", category: "culture", providerCountry: "ca" },
  { key: "winnipeg-lab", title: "Winnipeg lab earns an infectious disease upgrade", description: "The Winnipeg facility received a higher containment certification.", category: "science", providerCountry: "ca" },
  { key: "ns-fishery", title: "Nova Scotia fishery dispute escalates over quotas", description: "Harvesters in Nova Scotia protested the new quota allocations.", category: "general", providerCountry: "ca" },
  { key: "calgary-stampede", title: "Calgary Stampede sets an attendance record", description: "Organizers in Calgary reported the highest attendance on record.", category: "culture", providerCountry: "ca" },
];

const OTHER_SEEDS: FixtureSeed[] = [
  // Shared story — legitimately allowed on BOTH country surfaces.
  {
    key: "softwood-talks",
    title: "US and Canada resume softwood lumber trade talks",
    description: "Trade officials from both countries met to discuss the long-running dispute.",
    category: "business",
    outlets: 2,
  },
  // Weak-only acronym story served through a country=ca feed — the second
  // audit failure mode. Must reach NEITHER country hub.
  {
    key: "tsx-open",
    title: "TSX edges higher at the open as energy gains",
    description: "The composite index rose in early trading, led by energy shares.",
    category: "business",
    providerCountry: "ca",
  },
  { key: "ucl-final", title: "Champions League final heads to penalties after late equalizer", description: "The final was decided from the spot after a stoppage-time goal.", category: "sports" },
  { key: "eurozone-inflation", title: "Eurozone inflation eases to a two-year low", description: "The flash estimate showed price growth slowing across the bloc.", category: "business" },
];

function fixtureArticles(now: Date): RawArticle[] {
  const seeds = [...US_SEEDS, ...CA_SEEDS, ...OTHER_SEEDS];
  const articles: RawArticle[] = [];
  seeds.forEach((seed, seedIndex) => {
    const outletCount = seed.outlets ?? 1;
    for (let i = 0; i < outletCount; i++) {
      const [outlet, domain] = OUTLETS[i % OUTLETS.length];
      articles.push({
        title: seed.title,
        description: seed.description,
        url: `https://${domain}/story/${seed.key}`,
        source: outlet,
        sourceDomain: domain,
        // Staggered so sort orders are deterministic and everything is
        // well inside the 72h ingestion window.
        publishedAt: new Date(now.getTime() - (seedIndex * 7 + i) * 60_000).toISOString(),
        providerCategory: seed.category,
        providerCountry: seed.providerCountry,
        provider: "fixture",
        isMock: true,
      });
    }
  });
  return articles;
}

let dataset: NewsDataset;

beforeAll(async () => {
  process.env.NEWS_DATA_MODE = "mock";
  state.raw = fixtureArticles(new Date());
  dataset = await runPipeline();
  state.dataset = dataset;
});

function expectNoUS(clusters: StoryCluster[], surface: string): void {
  for (const [i, cluster] of clusters.entries()) {
    expect(
      cluster.country,
      `${surface}[${i}] "${cluster.title}" must not be US`,
    ).not.toBe("US");
  }
}

function expectNoCA(clusters: StoryCluster[], surface: string): void {
  for (const [i, cluster] of clusters.entries()) {
    expect(
      cluster.country,
      `${surface}[${i}] "${cluster.title}" must not be CA`,
    ).not.toBe("CA");
  }
}

function findCluster(titlePrefix: string): StoryCluster {
  const cluster = dataset.clusters.find((c) => c.title.startsWith(titlePrefix));
  expect(cluster, `cluster "${titlePrefix}"`).toBeDefined();
  return cluster!;
}

describe("country surfaces (fixture pipeline)", () => {
  it("classifies the live Congressional Black Caucus leak as US end to end", () => {
    const caucus = findCluster("Congressional Black Caucus");
    expect(caucus.country).toBe("US");
    for (const article of caucus.articles) {
      expect(article.country).toBe("US");
    }
  });

  it("keeps the weak-only TSX story out of both country buckets", () => {
    const tsx = findCluster("TSX edges higher");
    expect(["GLOBAL", "GLOBAL_NA"]).toContain(tsx.country);
  });

  it("homepage Canada section never contains a US story", async () => {
    const home = await getHomepageData();
    // The fixture set has 14 CA + 1 US_CA stories, so the rail fills all 9
    // slots even after hero/topSecondary consume top-ranked clusters.
    expect(home.canada.length).toBe(9);
    expectNoUS(home.canada, "homepage.canada");

    // CountrySection slices the 9: [0] lead, [1..4] supporting,
    // [5..8] "More headlines". The live leak sat at position 8.
    const moreHeadlines = home.canada.slice(5);
    expect(moreHeadlines.length).toBe(4);
    expectNoUS(moreHeadlines, "homepage.canada more-headlines");
    expect(home.canada[8].country).not.toBe("US");

    const caucus = findCluster("Congressional Black Caucus");
    expect(home.canada.some((c) => c.id === caucus.id)).toBe(false);
  });

  it("homepage US section never contains a Canadian story", async () => {
    const home = await getHomepageData();
    expect(home.us.length).toBe(9);
    expectNoCA(home.us, "homepage.us");
    const moreHeadlines = home.us.slice(5);
    expect(moreHeadlines.length).toBe(4);
    expectNoCA(moreHeadlines, "homepage.us more-headlines");
    expect(home.us[8].country).not.toBe("CA");
  });

  it("/canada country query returns no US story in any list", async () => {
    const canada = await getCountryData("canada");

    expect(canada.hero).not.toBeNull();
    expect(canada.hero!.country).not.toBe("US");
    expect(canada.secondary.length).toBe(4);
    expectNoUS(canada.secondary, "canada.secondary");
    for (const [category, clusters] of Object.entries(canada.byCategory)) {
      expectNoUS(clusters, `canada.byCategory.${category}`);
    }
    expect(canada.topList.length).toBe(10);
    expectNoUS(canada.topList, "canada.topList");

    expect(canada.latest.length).toBe(8);
    for (const [i, article] of canada.latest.entries()) {
      expect(
        article.country,
        `canada.latest[${i}] "${article.title}" must not be US`,
      ).not.toBe("US");
    }

    const caucus = findCluster("Congressional Black Caucus");
    expect(canada.topList.some((c) => c.id === caucus.id)).toBe(false);
    const caucusArticleIds = new Set(caucus.articles.map((a: Article) => a.id));
    expect(canada.latest.some((a) => caucusArticleIds.has(a.id))).toBe(false);
  });

  it("/us country query returns no Canadian story and carries the caucus story", async () => {
    const us = await getCountryData("us");

    expect(us.hero).not.toBeNull();
    expect(us.hero!.country).not.toBe("CA");
    expect(us.secondary.length).toBe(4);
    expectNoCA(us.secondary, "us.secondary");
    for (const [category, clusters] of Object.entries(us.byCategory)) {
      expectNoCA(clusters, `us.byCategory.${category}`);
    }
    expect(us.topList.length).toBe(10);
    expectNoCA(us.topList, "us.topList");
    for (const [i, article] of us.latest.entries()) {
      expect(
        article.country,
        `us.latest[${i}] "${article.title}" must not be CA`,
      ).not.toBe("CA");
    }

    // The story that leaked into Canada belongs on the US surface.
    const caucus = findCluster("Congressional Black Caucus");
    const usClusters = dataset.clusters.filter(
      (c) => c.country === "US" || c.country === "US_CA",
    );
    expect(usClusters.some((c) => c.id === caucus.id)).toBe(true);
    expect(
      [us.hero!, ...us.secondary, ...us.topList].some((c) => c.id === caucus.id),
    ).toBe(true);
  });

  it("the shared US_CA story may appear on both surfaces", async () => {
    const softwood = findCluster("US and Canada resume softwood");
    expect(softwood.country).toBe("US_CA");
    const canada = await getCountryData("canada");
    const us = await getCountryData("us");
    // US_CA is admitted by both filters — the exclusivity assertions above
    // only ban single-country stories from the opposite surface.
    expect(canada.topList.concat(us.topList).some((c) => c.id === softwood.id)).toBe(true);
  });
});
