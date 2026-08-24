import { describe, expect, it } from "vitest";
import { HUB_IDS, HUBS, hubsForCategory } from "@/config/hubs";
import { hubScore, hubStats, hubsForStory, matchesHub } from "@/lib/news/hubs";
import type { NewsDataset, StoryCluster } from "@/lib/news/types";

describe("topic hub matching", () => {
  it("one headline keyword is enough; one summary keyword is not", () => {
    expect(matchesHub("ai", { title: "OpenAI releases new model for businesses" })).toBe(true);
    expect(
      matchesHub("ai", {
        title: "Tech stocks rally on earnings",
        summary: "Chipmakers rose after an upbeat AI forecast.",
      }),
    ).toBe(false);
    // Two distinct summary keywords do qualify.
    expect(
      matchesHub("ai", {
        title: "Tech stocks rally on earnings",
        summary: "Nvidia rose after an upbeat AI forecast.",
      }),
    ).toBe(true);
  });

  it("matches on word boundaries, never inside other words", () => {
    // "ai" must not fire inside "said"/"Taiwan"; "gm" not inside "gmail".
    expect(matchesHub("ai", { title: "Taiwan said talks will continue" })).toBe(false);
    expect(matchesHub("autos", { title: "Gmail outage hits users" })).toBe(false);
    // Plural and possessive forms still match.
    expect(matchesHub("courts", { title: "Judge's ruling halts plan" })).toBe(true);
    expect(matchesHub("weather", { title: "Tornadoes tear through Oklahoma towns" })).toBe(true);
  });

  it("negatives cancel idiom and other-sense collisions", () => {
    expect(matchesHub("jobs", { title: "Pitcher records 12 strikeouts in win" })).toBe(false);
    expect(matchesHub("jobs", { title: "Drone strike hits depot near Kyiv" })).toBe(false);
    expect(matchesHub("jobs", { title: "Auto workers strike enters second week" })).toBe(true);
    expect(matchesHub("space", { title: "Office space demand slumps downtown" })).toBe(false);
    expect(matchesHub("space", { title: "SpaceX launches 23 Starlink satellites" })).toBe(true);
    expect(matchesHub("energy", { title: "Energy drink recall expands" })).toBe(false);
    expect(matchesHub("weather", { title: "Protesters storm the capitol steps" })).toBe(false);
  });

  it("obituaries hub targets notable deaths, not accidents or crime", () => {
    expect(matchesHub("obituaries", { title: "Legendary guitarist dies at 84" })).toBe(true);
    expect(matchesHub("obituaries", { title: "Former senator has died, family says" })).toBe(true);
    expect(matchesHub("obituaries", { title: "Man dies in crash on I-95" })).toBe(false);
    expect(matchesHub("obituaries", { title: "Swimmer caught in rip current rescued" })).toBe(false);
  });

  it("immigration never fires on hockey or weather ice", () => {
    expect(matchesHub("immigration", { title: "Ice storm knocks out power to thousands" })).toBe(false);
    expect(matchesHub("immigration", { title: "Oilers ice a lineup shuffle for Game 3" })).toBe(false);
    expect(matchesHub("immigration", { title: "ICE raids at meatpacking plant spark protests" })).toBe(true);
  });

  it("a story can belong to several hubs at once (tags, not sections)", () => {
    const hubs = hubsForStory({
      title: "Judge blocks deportation of student protesters",
    });
    expect(hubs).toContain("courts");
    expect(hubs).toContain("immigration");
    expect(hubs).toContain("education");
  });

  it("scores are non-negative and zero when nothing matches", () => {
    expect(hubScore("travel", { title: "Quarterly earnings beat estimates" })).toBe(0);
  });

  it("every hub has a title, description, keywords and at least one section", () => {
    for (const id of HUB_IDS) {
      const hub = HUBS[id];
      expect(hub.title.length).toBeGreaterThan(10);
      expect(hub.description.length).toBeGreaterThan(40);
      expect(hub.keywords.length).toBeGreaterThan(5);
      expect(hub.sections.length).toBeGreaterThan(0);
    }
    expect(hubsForCategory("technology").map((h) => h.id)).toContain("ai");
    expect(hubsForCategory("business").map((h) => h.id)).toContain("housing");
  });
});

describe("hubStats", () => {
  function cluster(
    id: string,
    title: string,
    sourceNames: string[],
    overrides: Partial<StoryCluster> = {},
  ): StoryCluster {
    return {
      id,
      slug: `story-${id}`,
      title,
      summary: null,
      category: "technology",
      country: "US",
      articles: [],
      lead: { source: sourceNames[0] },
      sourceCount: sourceNames.length,
      sourceNames,
      entities: [],
      firstPublishedAt: "2026-08-24T10:00:00.000Z",
      lastPublishedAt: "2026-08-24T11:00:00.000Z",
      rankingScore: 50,
      isMock: false,
      ...overrides,
    } as unknown as StoryCluster;
  }

  function dataset(clusters: StoryCluster[]): NewsDataset {
    return {
      articles: [],
      clusters,
      trending: [],
      generatedAt: "2026-08-24T12:00:00.000Z",
      // Distinct version per call: indexFor() memoizes on datasetVersion.
      datasetVersion: `v-${clusters.map((c) => c.id).join("-") || "empty"}`,
      dataMode: "live",
    } as unknown as NewsDataset;
  }

  it("counts stories, distinct publishers and multi-source stories", () => {
    const stats = hubStats(
      dataset([
        cluster("a", "OpenAI releases a new model", ["Reuters", "AP"]),
        cluster("b", "Nvidia chip demand climbs on AI orders", ["AP"]),
        cluster("c", "Machine learning tool rolls out to hospitals", ["NPR", "CBS News", "AP"]),
      ]),
      "ai",
    );
    expect(stats.total).toBe(3);
    // Reuters, AP, NPR, CBS News — AP appears in all three and counts once.
    expect(stats.publishers).toBe(4);
    expect(stats.multiSource).toBe(2);
    expect(stats.broadest).toEqual({
      title: "Machine learning tool rolls out to hospitals",
      slug: "story-c",
      sourceCount: 3,
    });
  });

  it("returns a null broadest when nothing carries two publications", () => {
    const stats = hubStats(
      dataset([
        cluster("d", "AI startup raises a funding round", ["The Verge"]),
        cluster("e", "Chatbot rollout reaches more users", ["Axios"]),
      ]),
      "ai",
    );
    expect(stats.total).toBe(2);
    expect(stats.publishers).toBe(2);
    expect(stats.multiSource).toBe(0);
    expect(stats.broadest).toBeNull();
  });

  it("is empty for a hub no story matches", () => {
    const stats = hubStats(
      dataset([cluster("f", "Hurricane warning issued for the coast", ["NPR"])]),
      "ai",
    );
    expect(stats).toEqual({ total: 0, publishers: 0, trackedPublishers: 0, multiSource: 0, broadest: null });
  });

  it("splits tracked publishers from publishers the pipeline admitted untracked", () => {
    const stats = hubStats(
      dataset([
        // NPR is in config/sources.ts; "Smalltown Gazette" is not.
        cluster("t1", "AI lab announces new research center", ["NPR", "Smalltown Gazette"]),
      ]),
      "ai",
    );
    expect(stats.publishers).toBe(2);
    expect(stats.trackedPublishers).toBe(1);
  });

  it("counts the full hub, not the page-capped slice", () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      cluster(`m${i}`, `AI model update number ${i}`, [`Outlet ${i}`]),
    );
    const stats = hubStats(dataset(many), "ai");
    expect(stats.total).toBe(45);
    expect(stats.publishers).toBe(45);
  });
});
