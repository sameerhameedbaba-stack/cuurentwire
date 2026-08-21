import { describe, expect, it } from "vitest";
import { HUB_IDS, HUBS, hubsForCategory } from "@/config/hubs";
import { hubScore, hubsForStory, matchesHub } from "@/lib/news/hubs";

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
