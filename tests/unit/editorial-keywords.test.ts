import { describe, expect, it } from "vitest";
import {
  keywordTargets,
  primaryTarget,
  STRIKING_MAX_POSITION,
  type GscQueryRow,
} from "@/lib/editorial/keywords";

const story = {
  title: "Chipmaker ships new AI accelerator to data centres",
  summary: "The accelerator targets inference workloads.",
  entities: ["Nvidia", "Blackwell"],
};

describe("keywordTargets", () => {
  it("ranks a striking-distance query above a buried one", () => {
    const striking: GscQueryRow[] = [
      { query: "ai accelerator data centres", impressions: 12, clicks: 0, position: 11 },
    ];
    const web: GscQueryRow[] = [
      { query: "chipmaker ai accelerator", impressions: 40, clicks: 0, position: 88 },
    ];
    const targets = keywordTargets(story, web, { strikingDistance: striking });
    expect(targets[0].phrase).toBe("ai accelerator data centres");
    expect(targets[0].origin).toBe("gsc-striking-distance");
    // The buried query has MORE impressions and still loses — position 88 is
    // not closable with one article.
    expect(targets[1].origin).toBe("gsc-impressed");
  });

  it("ignores queries about a different story", () => {
    const web: GscQueryRow[] = [
      { query: "tommy john surgery recovery", impressions: 26, clicks: 0, position: 9 },
    ];
    const targets = keywordTargets(story, web);
    expect(targets.some((t) => t.phrase.includes("tommy john"))).toBe(false);
  });

  it("drops rows too thin to be demand", () => {
    const web: GscQueryRow[] = [
      { query: "ai accelerator data centres", impressions: 1, clicks: 0, position: 10 },
    ];
    const targets = keywordTargets(story, web);
    expect(targets.every((t) => t.origin === "cluster-entity")).toBe(true);
  });

  it("classifies a page-two web query as striking distance", () => {
    const web: GscQueryRow[] = [
      { query: "new ai accelerator", impressions: 9, clicks: 0, position: STRIKING_MAX_POSITION - 2 },
    ];
    const targets = keywordTargets(story, web);
    expect(targets[0].origin).toBe("gsc-striking-distance");
  });

  it("falls back to the story's own subjects when there is no history", () => {
    const targets = keywordTargets(story, []);
    expect(targets.map((t) => t.phrase)).toEqual(["Nvidia", "Blackwell"]);
    expect(targets.every((t) => t.origin === "cluster-entity")).toBe(true);
  });

  it("never returns the same phrase twice", () => {
    const row: GscQueryRow = { query: "ai accelerator", impressions: 10, clicks: 0, position: 12 };
    const targets = keywordTargets(story, [row], { strikingDistance: [row] });
    expect(targets.filter((t) => t.phrase === "ai accelerator")).toHaveLength(1);
  });

  it("respects the limit", () => {
    const web: GscQueryRow[] = Array.from({ length: 12 }, (_, i) => ({
      query: `ai accelerator variant ${i}`,
      impressions: 5 + i,
      clicks: 0,
      position: 12,
    }));
    expect(keywordTargets(story, web, { limit: 3 })).toHaveLength(3);
  });
});

describe("primaryTarget — the anti-stuffing guard", () => {
  it("returns the best evidence-backed phrase for the headline", () => {
    const web: GscQueryRow[] = [
      { query: "ai accelerator data centres", impressions: 14, clicks: 0, position: 10 },
    ];
    const targets = keywordTargets(story, web);
    expect(primaryTarget(targets)?.phrase).toBe("ai accelerator data centres");
  });

  it("returns undefined when only entity guesses are available", () => {
    // No search evidence means no phrase worth bending a headline around.
    // Forcing one here is exactly how keyword stuffing starts.
    const targets = keywordTargets(story, []);
    expect(primaryTarget(targets)).toBeUndefined();
  });

  it("returns undefined for an empty target list", () => {
    expect(primaryTarget([])).toBeUndefined();
  });
});
