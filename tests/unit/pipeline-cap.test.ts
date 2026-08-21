import { describe, expect, it } from "vitest";
import { capNewest, MAX_PIPELINE_ARTICLES } from "@/lib/news/pipeline";

describe("capNewest", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 7, 21, h)).toISOString();

  it("returns the input untouched under the limit", () => {
    const list = [{ id: "a", publishedAt: at(1) }];
    expect(capNewest(list, 5)).toBe(list);
  });

  it("keeps the newest N while preserving original order", () => {
    const list = [
      { id: "old", publishedAt: at(1) },
      { id: "newest", publishedAt: at(9) },
      { id: "mid", publishedAt: at(5) },
      { id: "older", publishedAt: at(2) },
    ];
    expect(capNewest(list, 2).map((a) => a.id)).toEqual(["newest", "mid"]);
  });

  it("the pipeline cap sits inside the measured budget", () => {
    expect(MAX_PIPELINE_ARTICLES).toBeGreaterThanOrEqual(800);
    expect(MAX_PIPELINE_ARTICLES).toBeLessThanOrEqual(1_200);
  });
});
