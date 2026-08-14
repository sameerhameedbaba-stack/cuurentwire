import { beforeEach, describe, expect, it } from "vitest";
import { clusterArticles } from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import {
  clearPreviousDataset,
  setPreviousDataset,
} from "@/lib/news/previous";
import type { Article, NewsDataset, RawArticle, StoryCluster } from "@/lib/news/types";

/**
 * Category hysteresis across simulated consecutive generations (audit P0 #1:
 * a story flipping Business→World between two adjacent page loads).
 * Contract under test:
 *  - identical membership: a disagreeing fresh vote NEVER flips the
 *    category on run 2 — only on run 3, if the same disagreement persists;
 *  - changed membership (symmetric URL difference > 1): immediate adoption;
 *  - A→B→A vote flapping with unchanged membership never surfaces B.
 */

const NOW = new Date("2026-08-13T12:00:00Z");

// The previous-run registry is global state — every test starts cold.
beforeEach(() => clearPreviousDataset());

function makeArticle(
  title: string,
  domain: string,
  minutesAgo: number,
  overrides: Partial<RawArticle> = {},
): Article {
  const article = normalizeArticle(
    {
      title,
      description: "Shared description for category stability tests.",
      url: `https://${domain}/story-${Math.abs(minutesAgo)}`,
      source: domain,
      publishedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
      provider: "test",
      ...overrides,
    },
    NOW,
  );
  if (!article) throw new Error("test article failed to normalize");
  return article;
}

/**
 * The same two-member event regenerated each run (identical canonical URLs)
 * with the member category forced — simulating classifier drift re-voting a
 * different category over UNCHANGED membership.
 */
function fedPair(category: Article["category"]): Article[] {
  return [
    {
      ...makeArticle(
        "Federal Reserve holds benchmark interest rate steady after policy meeting",
        "outlet-a.com",
        30,
      ),
      category,
    },
    {
      ...makeArticle(
        "Federal Reserve keeps benchmark interest rate unchanged at policy meeting",
        "outlet-b.com",
        25,
      ),
      category,
    },
  ];
}

const extraMember = (
  title: string,
  domain: string,
  minutesAgo: number,
  category: Article["category"],
): Article => ({ ...makeArticle(title, domain, minutesAgo), category });

/** Feed a run's output back as the next run's previous generation. */
function asPrevious(clusters: StoryCluster[]): void {
  setPreviousDataset({
    articles: clusters.flatMap((c) => c.articles),
    clusters,
  } as unknown as NewsDataset);
}

describe("category hysteresis across generations", () => {
  it("a new story adopts the fresh vote with no streak", () => {
    const run = clusterArticles(fedPair("business"), NOW);
    expect(run).toHaveLength(1);
    expect(run[0].category).toBe("business");
    expect(run[0].categoryStreak).toBeUndefined();
  });

  it("identical membership: holds on run 2, adopts on run 3 when the vote persists", () => {
    const run1 = clusterArticles(fedPair("world"), NOW);
    expect(run1).toHaveLength(1);
    expect(run1[0].category).toBe("world");
    asPrevious(run1);

    // Run 2: the vote drifts to business over identical membership — held.
    const run2 = clusterArticles(fedPair("business"), NOW);
    expect(run2).toHaveLength(1);
    expect(run2[0].id).toBe(run1[0].id);
    expect(run2[0].category).toBe("world");
    expect(run2[0].categoryStreak).toEqual({ candidate: "business", count: 1 });
    asPrevious(run2);

    // Run 3: the same disagreement persists — now it wins, streak cleared.
    const run3 = clusterArticles(fedPair("business"), NOW);
    expect(run3).toHaveLength(1);
    expect(run3[0].id).toBe(run1[0].id);
    expect(run3[0].category).toBe("business");
    expect(run3[0].categoryStreak).toBeUndefined();
  });

  it("A→B→A vote flapping with unchanged membership never surfaces B", () => {
    const run1 = clusterArticles(fedPair("world"), NOW);
    asPrevious(run1);

    const run2 = clusterArticles(fedPair("business"), NOW);
    expect(run2[0].category).toBe("world");
    asPrevious(run2);

    // The vote returns to world: agreement resets the streak — business was
    // never displayed in any generation.
    const run3 = clusterArticles(fedPair("world"), NOW);
    expect(run3[0].category).toBe("world");
    expect(run3[0].categoryStreak).toBeUndefined();
  });

  it("a different disagreement resets the streak instead of inheriting it", () => {
    const run1 = clusterArticles(fedPair("world"), NOW);
    asPrevious(run1);

    const run2 = clusterArticles(fedPair("business"), NOW);
    expect(run2[0].categoryStreak).toEqual({ candidate: "business", count: 1 });
    asPrevious(run2);

    // Run 3 disagrees with a NEW candidate: still held, streak restarts.
    const run3 = clusterArticles(fedPair("politics"), NOW);
    expect(run3[0].category).toBe("world");
    expect(run3[0].categoryStreak).toEqual({ candidate: "politics", count: 1 });
    asPrevious(run3);

    const run4 = clusterArticles(fedPair("politics"), NOW);
    expect(run4[0].category).toBe("politics");
    expect(run4[0].categoryStreak).toBeUndefined();
  });

  it("genuinely changed membership (symmetric difference > 1) adopts immediately", () => {
    const run1 = clusterArticles(fedPair("world"), NOW);
    asPrevious(run1);

    // Two new outlets join: the vote changed because the story changed.
    const grown = [
      ...fedPair("business"),
      extraMember(
        "Fed holds benchmark interest rate steady after latest policy meeting",
        "outlet-c.com",
        20,
        "business",
      ),
      extraMember(
        "Federal Reserve leaves benchmark interest rate steady following meeting",
        "outlet-d.com",
        15,
        "business",
      ),
    ];
    const run2 = clusterArticles(grown, NOW);
    expect(run2).toHaveLength(1);
    expect(run2[0].id).toBe(run1[0].id);
    expect(run2[0].category).toBe("business");
    expect(run2[0].categoryStreak).toBeUndefined();
  });

  it("a single added member (symmetric difference 1) is NOT genuine change", () => {
    const run1 = clusterArticles(fedPair("world"), NOW);
    asPrevious(run1);

    const oneMore = [
      ...fedPair("business"),
      extraMember(
        "Fed holds benchmark interest rate steady after latest policy meeting",
        "outlet-c.com",
        20,
        "business",
      ),
    ];
    const run2 = clusterArticles(oneMore, NOW);
    expect(run2).toHaveLength(1);
    expect(run2[0].category).toBe("world");
    expect(run2[0].categoryStreak).toEqual({ candidate: "business", count: 1 });
  });
});
