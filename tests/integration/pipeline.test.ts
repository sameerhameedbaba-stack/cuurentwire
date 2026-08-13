import { beforeAll, describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/news/pipeline";
import { filterClusters } from "@/lib/news/queries";
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
