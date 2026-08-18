import { beforeAll, describe, expect, it, vi } from "vitest";
import { matchesCountryFilter } from "@/lib/news/classification/geography";
import { runPipeline } from "@/lib/news/pipeline";
import {
  getCategoryData,
  getCountryData,
  getHomepageData,
  getLatest,
  getSourceStories,
  searchStories,
} from "@/lib/news/queries";
import { isCuratedEligible } from "@/lib/news/ranking/score";
import { deriveTrending } from "@/lib/news/trending";
import type { Article, NewsDataset, RawArticle, StoryCluster } from "@/lib/news/types";
import { slugify } from "@/lib/utils/text";

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
  /** Explicit publishers, overriding the default editorial rotation. */
  sources?: [name: string, domain: string][];
}

const OUTLETS: [name: string, domain: string][] = [
  ["Fixture Wire", "fixturewire.demo"],
  ["Sample Sentinel", "samplesentinel.demo"],
  ["Demo Dispatch", "demodispatch.demo"],
];

/** Distribution platforms — they carry issuer releases, not reporting. */
const WIRE_OUTLETS: [name: string, domain: string][] = [
  ["Fixture Newswire", "fixturenewswire.demo"],
  ["Demo Release Wire", "demoreleasewire.demo"],
  ["Sample Wire Service", "samplewireservice.demo"],
];

const PR_TITLE = "Fixture Mining Corp. Announces Q2 2026 Financial Results";
const PICKED_UP_PR_TITLE =
  "Harbour Ridge Copper Confirms Record Quarterly Output at Sudbury Smelter";

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
  // Single-source quarterly-results release, syndicated to three wire
  // domains — the live /canada defect (two such releases ranked 5 and 6 in
  // "Top Canada stories"). Three copies give it enough velocity and coverage
  // to outrank most real Canadian stories in this fixture set, which is
  // exactly how it reached the curated modules in production.
  {
    key: "fixture-mining-q2",
    title: PR_TITLE,
    description:
      "The company said second-quarter revenue rose at its Saskatchewan operations.",
    category: "business",
    providerCountry: "ca",
    sources: WIRE_OUTLETS,
  },
  // The exception: one release that real newsrooms picked up. The cluster is
  // still LED by the release (labeled "Press release"), but it carries
  // independent editorial coverage on a different domain, so it stays
  // curated-eligible.
  {
    key: "harbour-ridge-release",
    title: PICKED_UP_PR_TITLE,
    description:
      "FOR IMMEDIATE RELEASE — Harbour Ridge Copper today confirmed record smelter output at its Sudbury operations in Ontario.",
    category: "business",
    providerCountry: "ca",
    sources: [WIRE_OUTLETS[0]],
  },
  {
    key: "harbour-ridge-pickup",
    title:
      "Harbour Ridge Copper confirms record quarterly output at Sudbury smelter, shares climb",
    description:
      "Analysts said the Sudbury smelter run rate was the strongest since the plant reopened in Ontario.",
    category: "business",
    providerCountry: "ca",
    sources: [OUTLETS[0]],
  },
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
    const outlets = seed.sources ?? OUTLETS;
    const outletCount = seed.sources?.length ?? seed.outlets ?? 1;
    for (let i = 0; i < outletCount; i++) {
      const [outlet, domain] = outlets[i % outlets.length];
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

    // The rail excludes clusters already rendered as cards (see the
    // duplicate-story suite below), so with this small fixture set it holds
    // fewer than its 8-row capacity — but never runs empty.
    expect(canada.latest.length).toBeGreaterThan(0);
    expect(canada.latest.length).toBeLessThanOrEqual(8);
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

/**
 * Curated modules are a NEWS ranking, not a wire distribution channel: a
 * press release with no independent editorial coverage never occupies a
 * "Top" slot. Regression for the live /canada defect — two quarterly-results
 * releases sat at ranks 5 and 6 of "Top Canada stories" and were advertised
 * to search engines in that list's ItemList JSON-LD.
 */
describe("press releases in curated modules (fixture pipeline)", () => {
  const release = (): StoryCluster => findCluster("Fixture Mining Corp");

  it("classifies the wire release as a single-source press release", () => {
    const pr = release();
    expect(pr.contentType).toBe("press_release");
    for (const article of pr.articles) {
      expect(article.contentType).toBe("press_release");
    }
    // Three wire domains carrying ONE issuer release: distribution breadth,
    // never independent reporting.
    expect(pr.sourceCount).toBe(3);
    expect(pr.country).toBe("CA");
    expect(pr.category).toBe("business");
    expect(isCuratedEligible(pr)).toBe(false);
  });

  it("would reach the curated modules without the gate", () => {
    // Non-vacuity guard: pre-gate the release ranks inside the ten clusters
    // /canada lists, and multi-source clusters are what "Most covered" draws
    // from — the assertions below are removing something that was there.
    const pr = release();
    const canadaByRank = dataset.clusters.filter((c) =>
      matchesCountryFilter(c.country, "canada"),
    );
    expect(canadaByRank.slice(0, 10).some((c) => c.id === pr.id)).toBe(true);
    expect(
      dataset.clusters.filter((c) => c.sourceCount >= 2).some((c) => c.id === pr.id),
    ).toBe(true);
  });

  it("keeps it out of every /canada curated list", async () => {
    const pr = release();
    const canada = await getCountryData("canada");

    expect(canada.hero).not.toBeNull();
    expect(canada.hero!.id).not.toBe(pr.id);
    expect(canada.secondary.some((c) => c.id === pr.id)).toBe(false);
    for (const [category, clusters] of Object.entries(canada.byCategory)) {
      expect(
        (clusters ?? []).some((c) => c.id === pr.id),
        `canada.byCategory.${category} must not carry an uncovered release`,
      ).toBe(false);
    }
    // topList also feeds the page's ItemList JSON-LD.
    expect(canada.topList.some((c) => c.id === pr.id)).toBe(false);
    for (const cluster of canada.topList) {
      expect(
        isCuratedEligible(cluster),
        `canada.topList "${cluster.title}" must be curated-eligible`,
      ).toBe(true);
    }
  });

  it("keeps it out of every curated homepage module", async () => {
    const pr = release();
    const home = await getHomepageData();

    expect(home.hero!.id).not.toBe(pr.id);
    expect(home.topSecondary.some((c) => c.id === pr.id)).toBe(false);
    expect(home.canada.some((c) => c.id === pr.id)).toBe(false);
    expect(home.us.some((c) => c.id === pr.id)).toBe(false);
    expect(home.top100Preview.some((c) => c.id === pr.id)).toBe(false);
    // Most covered ranks by source count, which is exactly what syndication
    // inflates — it must still return real stories, just not this one.
    expect(home.mostCovered.length).toBeGreaterThan(0);
    expect(home.mostCovered.some((c) => c.id === pr.id)).toBe(false);
    for (const [id, clusters] of Object.entries(home.sections)) {
      expect(
        (clusters ?? []).some((c) => c.id === pr.id),
        `homepage section ${id} must not carry an uncovered release`,
      ).toBe(false);
    }
  });

  it("keeps it out of the /business curated lists", async () => {
    const pr = release();
    const business = await getCategoryData("business");

    expect(business.hero).not.toBeNull();
    expect(business.hero!.id).not.toBe(pr.id);
    expect(business.secondary.some((c) => c.id === pr.id)).toBe(false);
    expect(business.more.some((c) => c.id === pr.id)).toBe(false);
  });

  it("keeps its boilerplate out of trending topics", () => {
    const pr = release();
    const slugs = new Set(pr.entities.map((e) => slugify(e, 60)));
    expect(slugs.size).toBeGreaterThan(0);
    // Ungated, the release's entities clear the trending article-count floor
    // on three syndicated copies alone; the curated gate is what drops them.
    expect(
      deriveTrending(dataset.clusters, 100).some((t) => slugs.has(t.slug)),
    ).toBe(true);
    expect(dataset.trending.some((t) => slugs.has(t.slug))).toBe(false);
  });

  it("stays reachable and labeled on ungated surfaces", async () => {
    const pr = release();
    const articleIds = new Set(pr.articles.map((a: Article) => a.id));

    const latest = await getLatest("canada");
    expect(latest.articles.some((a) => articleIds.has(a.id))).toBe(true);

    const wire = await getSourceStories(slugify("Fixture Newswire", 60));
    expect(wire.articles.some((a) => articleIds.has(a.id))).toBe(true);

    const search = await searchStories("Fixture Mining");
    expect(search.results.some((c) => c.id === pr.id)).toBe(true);
  });

  it("gates every homepage band and the category more-list on curated eligibility", async () => {
    // R9 audit follow-up: the live leak entered through content-type
    // misclassification of syndicated copies, not a missing gate — this
    // pins the gate itself over every band-shaped module.
    const home = await getHomepageData();
    for (const [id, clusters] of Object.entries(home.sections)) {
      for (const cluster of clusters ?? []) {
        expect(
          isCuratedEligible(cluster),
          `homepage section ${id} "${cluster.title}" must be curated-eligible`,
        ).toBe(true);
      }
    }
    for (const cluster of [...home.us, ...home.canada]) {
      expect(
        isCuratedEligible(cluster),
        `homepage country band "${cluster.title}" must be curated-eligible`,
      ).toBe(true);
    }
    const business = await getCategoryData("business");
    for (const cluster of [
      ...(business.hero ? [business.hero] : []),
      ...business.secondary,
      ...business.more,
      ...business.related,
    ]) {
      expect(
        isCuratedEligible(cluster),
        `/business curated "${cluster.title}" must be curated-eligible`,
      ).toBe(true);
    }
  });

  it("keeps a release with independent pickup curated-eligible", async () => {
    const picked = findCluster("Harbour Ridge Copper");
    // One issuer release plus one newsroom's own report on a different
    // domain: the cluster is still LED (and labeled) by the release.
    expect(picked.articles.length).toBe(2);
    expect(picked.contentType).toBe("press_release");
    expect(
      picked.articles.some((a: Article) => a.contentType !== "press_release"),
    ).toBe(true);
    expect(isCuratedEligible(picked)).toBe(true);

    const canada = await getCountryData("canada");
    expect(
      [canada.hero!, ...canada.secondary, ...canada.topList].some(
        (c) => c.id === picked.id,
      ),
    ).toBe(true);
  });
});

/**
 * Duplicate-story regression (R9 audit): /canada rendered all six "Latest
 * developments" stories a SECOND time — the same clusters already shown as
 * cards — through bare-id /story/<clusterId> links that only 308-redirect.
 * Two invariants fix it end to end: the latest rail excludes clusters the
 * page already renders as cards, and every clustered article row carries the
 * canonical cluster slug so no listing link needs the redirect alias.
 */
describe("no story renders twice on one surface (fixture pipeline)", () => {
  it("country latest rail excludes card clusters and links canonically", async () => {
    for (const country of ["canada", "us"] as const) {
      const data = await getCountryData(country);
      const cardIds = new Set(
        [
          data.hero!,
          ...data.secondary,
          ...Object.values(data.byCategory).flatMap((c) => c ?? []),
          ...data.topList,
        ].map((c) => c.id),
      );
      expect(data.latest.length).toBeGreaterThan(0);
      for (const article of data.latest) {
        expect(
          article.clusterId === undefined || !cardIds.has(article.clusterId),
          `/${country} latest "${article.title}" duplicates a card cluster`,
        ).toBe(true);
        if (article.clusterId) {
          expect(
            article.clusterSlug,
            `/${country} latest "${article.title}" must link by cluster slug`,
          ).toBeDefined();
        }
      }
    }
  });

  it("category latest rail excludes card clusters and links canonically", async () => {
    const business = await getCategoryData("business");
    const cardIds = new Set(
      [
        ...(business.hero ? [business.hero] : []),
        ...business.secondary,
        ...business.more,
        ...business.related,
      ].map((c) => c.id),
    );
    expect(business.latest.length).toBeGreaterThan(0);
    for (const article of business.latest) {
      expect(
        article.clusterId === undefined || !cardIds.has(article.clusterId),
        `/business latest "${article.title}" duplicates a card cluster`,
      ).toBe(true);
      if (article.clusterId) {
        expect(
          article.clusterSlug,
          `/business latest "${article.title}" must link by cluster slug`,
        ).toBeDefined();
      }
    }
  });
});
