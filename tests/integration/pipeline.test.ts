import { beforeAll, describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/news/pipeline";
import { filterClusters } from "@/lib/news/queries";
import { isTop100Eligible } from "@/lib/news/ranking/score";
import type { NewsDataset } from "@/lib/news/types";

/**
 * Full-pipeline integration: mock providers → normalize → cluster → rank.
 * Exercises the same code path production uses on every refresh.
 */

let dataset: NewsDataset;

beforeAll(async () => {
  process.env.NEWS_DATA_MODE = "mock";
  dataset = await runPipeline();
});

describe("pipeline (mock providers)", () => {
  it("accepts a healthy volume of articles with no rejects from mock data", () => {
    expect(dataset.articles.length).toBeGreaterThan(50);
    expect(dataset.ingestion.articlesRejected).toBe(0);
    expect(dataset.dataMode).toBe("mock");
  });

  it("clusters multi-source coverage instead of repeating stories", () => {
    expect(dataset.clusters.length).toBeLessThan(dataset.articles.length);
    const fed = dataset.clusters.find((c) =>
      c.title.toLowerCase().includes("federal reserve"),
    );
    expect(fed).toBeDefined();
    expect(fed!.sourceCount).toBeGreaterThanOrEqual(5);
  });

  it("never builds a giant mega-cluster", () => {
    // The fingerprint-relaxed threshold and second-pass merge must not chain
    // unrelated stories together: no cluster may hold 12+ articles.
    const largest = Math.max(...dataset.clusters.map((c) => c.articles.length));
    expect(largest).toBeLessThan(12);
  });

  it("gives every cluster a valid ranking and sorts by importance", () => {
    for (const cluster of dataset.clusters) {
      expect(cluster.rankingScore).toBeGreaterThanOrEqual(0);
      expect(cluster.rankingScore).toBeLessThanOrEqual(100);
    }
    const scores = dataset.clusters.map((c) => c.rankingScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("marks every mock story as mock", () => {
    expect(dataset.articles.every((a) => a.isMock)).toBe(true);
    expect(dataset.clusters.every((c) => c.isMock)).toBe(true);
  });

  it("derives trending topics from coverage", () => {
    expect(dataset.trending.length).toBeGreaterThan(0);
    for (const topic of dataset.trending) {
      expect(topic.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("allows at most one breaking story", () => {
    expect(dataset.clusters.filter((c) => c.isBreaking).length).toBeLessThanOrEqual(1);
  });

  it("reports coverage-age and ranking telemetry", () => {
    const stats = dataset.ingestion;
    expect(stats.articleAgeAtIngestMedianMs).toBeGreaterThanOrEqual(0);
    expect(stats.articleAgeAtIngestP90Ms).toBeGreaterThanOrEqual(
      stats.articleAgeAtIngestMedianMs,
    );
    // Accepted articles are at most 72h old, so ingest age is bounded too.
    expect(stats.articleAgeAtIngestP90Ms).toBeLessThanOrEqual(72 * 3_600_000);
    expect(stats.highestRankingScore).toBe(dataset.clusters[0]?.rankingScore ?? 0);
    expect(stats.breakingCount).toBe(
      dataset.clusters.filter((c) => c.isBreaking).length,
    );
    expect(stats.nearBreakingCount).toBe(
      dataset.clusters.filter((c) => c.rankingScore >= 75).length,
    );
    // Breaking requires score >= 85, so every breaking cluster is near-breaking.
    expect(stats.breakingCount).toBeLessThanOrEqual(stats.nearBreakingCount);
  });

  it("detects the mock press release and suppresses it from the Top 100", () => {
    // The clearly-fictional Demo Widget Corp earnings release in mock data
    // must be classified press_release at both article and cluster level…
    const prArticle = dataset.articles.find((a) =>
      a.title.startsWith("Demo Widget Corp"),
    );
    expect(prArticle).toBeDefined();
    expect(prArticle!.contentType).toBe("press_release");

    const prCluster = dataset.clusters.find((c) =>
      c.title.startsWith("Demo Widget Corp"),
    );
    expect(prCluster).toBeDefined();
    expect(prCluster!.contentType).toBe("press_release");

    // …excluded from the Top-100 slice (single-domain issuer communication,
    // no independent coverage) and never BREAKING.
    expect(isTop100Eligible(prCluster!)).toBe(false);
    const top100 = dataset.clusters.filter(isTop100Eligible).slice(0, 100);
    expect(top100.some((c) => c.id === prCluster!.id)).toBe(false);
    expect(prCluster!.isBreaking).toBe(false);

    // Regular reported stories default to news and stay eligible.
    const fed = dataset.clusters.find((c) =>
      c.title.toLowerCase().includes("federal reserve"),
    )!;
    expect(fed.contentType).toBe("news");
    expect(isTop100Eligible(fed)).toBe(true);
  });

  it("reports classification sanity-check warnings without blocking ingestion", () => {
    const stats = dataset.ingestion;
    expect(stats.classificationWarnings).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.classificationWarningSamples)).toBe(true);
    // At most the first 10 samples are exposed, never more than the count.
    expect(stats.classificationWarningSamples.length).toBeLessThanOrEqual(10);
    expect(stats.classificationWarningSamples.length).toBeLessThanOrEqual(
      stats.classificationWarnings,
    );
    // Warnings are diagnostics only — articles were still accepted.
    expect(dataset.articles.length).toBeGreaterThan(0);
  });
});

describe("Top 100 filtering", () => {
  it("filters by country", () => {
    const canada = filterClusters(dataset.clusters, { country: "canada" });
    expect(canada.length).toBeGreaterThan(0);
    for (const cluster of canada) {
      expect(["CA", "US_CA"]).toContain(cluster.country);
    }
  });

  it("filters by category", () => {
    const business = filterClusters(dataset.clusters, { category: "business" });
    expect(business.length).toBeGreaterThan(0);
    for (const cluster of business) {
      expect(
        cluster.category === "business" ||
          cluster.lead.categories.includes("business"),
      ).toBe(true);
    }
  });

  it("filters by time window", () => {
    const now = new Date();
    const recent = filterClusters(dataset.clusters, { time: "3h" }, now);
    for (const cluster of recent) {
      const age = now.getTime() - new Date(cluster.lastPublishedAt).getTime();
      expect(age).toBeLessThanOrEqual(3 * 3_600_000);
    }
  });

  it("sorts by coverage when requested", () => {
    const covered = filterClusters(dataset.clusters, { sort: "most-covered" });
    for (let i = 1; i < covered.length; i++) {
      expect(covered[i - 1].sourceCount).toBeGreaterThanOrEqual(covered[i].sourceCount);
    }
  });
});
