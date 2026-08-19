import { describe, expect, it } from "vitest";
import {
  MIN_COVERAGE_SOURCES,
  MOST_COVERED_LIMIT,
  selectMostCovered,
} from "@/lib/news/queries";
import type { Article, StoryCluster } from "@/lib/news/types";

/**
 * /most-covered publishes CurrentWire's most differentiated signal — how many
 * independent publishers are reporting one event. Everything asserted here is
 * about keeping that claim honest: the floor, the denominators the page
 * prints, the press-release exclusion, and the JSON-LD ceiling.
 */
function cluster(over: Partial<StoryCluster> & { id: string }): StoryCluster {
  return {
    sourceCount: 1,
    rankingScore: 50,
    contentType: "news",
    ...over,
  } as StoryCluster;
}

const article = (sourceSlug: string): Article => ({ sourceSlug }) as Article;

describe("selectMostCovered", () => {
  it("excludes stories below the publisher floor", () => {
    const result = selectMostCovered(
      [
        cluster({ id: "solo", sourceCount: 1 }),
        cluster({ id: "pair", sourceCount: 2 }),
      ],
      [],
    );
    expect(result.stories.map((c) => c.id)).toEqual(["pair"]);
    expect(MIN_COVERAGE_SOURCES).toBe(2);
  });

  it("orders by publisher count, then by ranking score for the ties", () => {
    // Ties are the normal case, so the tiebreak must be deterministic and
    // explainable rather than dependent on array position.
    const result = selectMostCovered(
      [
        cluster({ id: "low", sourceCount: 2, rankingScore: 10 }),
        cluster({ id: "wide", sourceCount: 5, rankingScore: 1 }),
        cluster({ id: "high", sourceCount: 2, rankingScore: 90 }),
      ],
      [],
    );
    expect(result.stories.map((c) => c.id)).toEqual(["wide", "high", "low"]);
  });

  it("reports honest denominators, not just the displayed slice", () => {
    // The page prints "N of M ranked stories" — M must be everything
    // considered, and N must count qualifiers BEFORE the display cap.
    const clusters = [
      ...Array.from({ length: 30 }, (_, i) =>
        cluster({ id: `wide-${i}`, sourceCount: 3 }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        cluster({ id: `solo-${i}`, sourceCount: 1 }),
      ),
    ];
    const result = selectMostCovered(clusters, []);
    expect(result.stories).toHaveLength(MOST_COVERED_LIMIT);
    expect(result.qualifying).toBe(30);
    expect(result.rankedTotal).toBe(40);
    expect(result.maxSourceCount).toBe(3);
  });

  it("counts distinct publishers in the snapshot", () => {
    const result = selectMostCovered(
      [cluster({ id: "a", sourceCount: 2 })],
      [article("bbc-news"), article("bbc-news"), article("npr")],
    );
    expect(result.publishersRepresented).toBe(2);
  });

  it("reports zero breadth without inventing a maximum", () => {
    const result = selectMostCovered([cluster({ id: "solo" })], []);
    expect(result.stories).toEqual([]);
    expect(result.qualifying).toBe(0);
    expect(result.maxSourceCount).toBe(0);
  });

  it("never lists more items than ItemList JSON-LD will enumerate", () => {
    // ItemListJsonLd emits numberOfItems: clusters.length but slices
    // itemListElement at 30. A larger limit would publish schema claiming
    // more items than it lists.
    expect(MOST_COVERED_LIMIT).toBeLessThanOrEqual(30);
  });
});
