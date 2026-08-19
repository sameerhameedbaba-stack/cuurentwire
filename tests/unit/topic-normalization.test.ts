import { describe, expect, it } from "vitest";
import {
  MIN_CLUSTERS_FOR_TOPIC,
  buildTopicIndex,
  isTopicEligible,
  resolveTopic,
  topicKey,
} from "@/lib/news/topics";
import type { Article, StoryCluster } from "@/lib/news/types";
import { topicFoldFixtures, topicKeyFixtures } from "../fixtures/topic-fixtures";

/**
 * Fixture evaluation of topic-slug normalization (backlog item 7).
 * The key mapping is deterministic, so the bar is 100% — a miss is a bug,
 * not a confidence question. The report line mirrors
 * tests/unit/classification-quality.test.ts so both show up the same way.
 */

let seq = 0;

function article(entities: string[]): Article {
  seq++;
  return {
    id: `a${seq}`,
    slug: `topic-fixture-story-a${seq}`,
    title: `Topic fixture story ${seq}`,
    url: `https://example-wire.com/story-${seq}`,
    canonicalUrl: `https://example-wire.com/story-${seq}`,
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example-wire.com",
    sourceTier: "A",
    publishedAt: "2026-08-19T00:00:00.000Z",
    country: "US",
    category: "general",
    categories: ["general"],
    contentType: "news",
    entities,
    provider: "test",
    isMock: true,
  };
}

function cluster(entities: string[], articleCount = 1): StoryCluster {
  const articles = Array.from({ length: articleCount }, () => article(entities));
  const lead = articles[0];
  return {
    id: `c${seq}`,
    slug: `topic-fixture-cluster-c${seq}`,
    title: lead.title,
    category: "general",
    country: "US",
    articles,
    lead,
    sourceCount: 1,
    sourceNames: ["Example Wire"],
    entities,
    firstPublishedAt: lead.publishedAt,
    lastPublishedAt: lead.publishedAt,
    rankingScore: 50,
    rankingBreakdown: {
      freshness: 0, authority: 0, coverage: 0,
      geography: 0, prominence: 0, velocity: 0, total: 0,
    },
    status: null,
    isBreaking: false,
    isMock: true,
  };
}

describe("topicKey (fixture evaluation)", () => {
  it("has a broad, labeled fixture set covering both folds and the traps", () => {
    expect(topicKeyFixtures.length).toBeGreaterThanOrEqual(40);
    expect(topicFoldFixtures.filter((f) => f.fold).length).toBeGreaterThanOrEqual(8);
    expect(topicFoldFixtures.filter((f) => !f.fold).length).toBeGreaterThanOrEqual(10);
  });

  it("maps every fixture entity to its expected key", () => {
    const failures: string[] = [];
    for (const fixture of topicKeyFixtures) {
      const actual = topicKey(fixture.entity);
      if (actual !== fixture.expectedKey) {
        failures.push(
          `"${fixture.entity}" — expected ${fixture.expectedKey}, got ${actual} (${fixture.note})`,
        );
      }
    }
    process.stdout.write(
      `[topic-normalization] keys: ${topicKeyFixtures.length - failures.length}/${topicKeyFixtures.length}\n`,
    );
    for (const failure of failures) {
      process.stdout.write(`[topic-normalization]   miss: ${failure}\n`);
    }
    expect(failures).toEqual([]);
  });

  it("folds only the pairs that must fold", () => {
    const failures: string[] = [];
    for (const fixture of topicFoldFixtures) {
      const same = topicKey(fixture.a) === topicKey(fixture.b);
      if (same !== fixture.fold) {
        failures.push(
          `"${fixture.a}" vs "${fixture.b}" — expected ${fixture.fold ? "FOLD" : "SEPARATE"}, ` +
            `got ${topicKey(fixture.a)} / ${topicKey(fixture.b)} (${fixture.note})`,
        );
      }
    }
    process.stdout.write(
      `[topic-normalization] folds: ${topicFoldFixtures.length - failures.length}/${topicFoldFixtures.length}\n`,
    );
    for (const failure of failures) {
      process.stdout.write(`[topic-normalization]   miss: ${failure}\n`);
    }
    expect(failures).toEqual([]);
  });

  it("never returns a key that is not a valid URL slug", () => {
    for (const fixture of topicKeyFixtures) {
      expect(topicKey(fixture.entity)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("buildTopicIndex", () => {
  it("gives the containment pair one topic on the more specific URL", () => {
    const index = buildTopicIndex([
      cluster(["Big Bend National Park"]),
      cluster(["Big Bend"]),
    ]);
    const entry = index.byKey.get("big-bend");
    expect(entry).toBeDefined();
    expect(entry!.slug).toBe("big-bend-national-park");
    expect(entry!.display).toBe("Big Bend National Park");
    expect(entry!.clusterCount).toBe(2);
  });

  it("counts a cluster once even when it carries both variants", () => {
    const index = buildTopicIndex([
      cluster(["Big Bend", "Big Bend National Park"]),
    ]);
    expect(index.byKey.get("big-bend")!.clusterCount).toBe(1);
  });

  it("keeps the live near-miss topics separate", () => {
    const index = buildTopicIndex([
      cluster(["Florida"]),
      cluster(["Florida House"]),
      cluster(["New York"]),
      cluster(["York"]),
      cluster(["Washington"]),
      cluster(["Washington Post"]),
    ]);
    for (const slug of [
      "florida", "florida-house", "new-york", "york", "washington", "washington-post",
    ]) {
      expect(index.bySlug.get(slug), `missing topic ${slug}`).toBeDefined();
    }
    expect(index.bySlug.get("florida")!.key).not.toBe(
      index.bySlug.get("florida-house")!.key,
    );
    expect(index.bySlug.get("new-york")!.key).not.toBe(index.bySlug.get("york")!.key);
    expect(index.bySlug.get("washington")!.key).not.toBe(
      index.bySlug.get("washington-post")!.key,
    );
  });

  it("withholds a URL from an uncorroborated headline fragment", () => {
    const index = buildTopicIndex([cluster(["Bay Giants", "UnitedHealthcare CEO"], 5)]);
    expect(isTopicEligible(index.byKey.get("bay-giants"))).toBe(false);
    expect(isTopicEligible(index.byKey.get("unitedhealthcare-ceo"))).toBe(false);
    // Article volume in ONE cluster is not corroboration.
    expect(index.byKey.get("bay-giants")!.clusterCount).toBeLessThan(
      MIN_CLUSTERS_FOR_TOPIC,
    );
  });

  it("gives the same phrase a URL once a second story corroborates it", () => {
    const index = buildTopicIndex([cluster(["Bay Giants"]), cluster(["Bay Giants"])]);
    expect(isTopicEligible(index.byKey.get("bay-giants"))).toBe(true);
  });

  it("never withholds a curated dictionary topic for lack of corroboration", () => {
    const index = buildTopicIndex([cluster(["Federal Reserve"])]);
    const entry = index.byKey.get("federal-reserve");
    expect(entry!.clusterCount).toBe(1);
    expect(isTopicEligible(entry)).toBe(true);
  });

  it("pools variants when scoring corroboration", () => {
    // One story says "Big Bend", another says "Big Bend National Park" —
    // together that is a corroborated topic, not two thin ones.
    const index = buildTopicIndex([
      cluster(["Big Bend"]),
      cluster(["Big Bend National Park"]),
    ]);
    expect(isTopicEligible(index.byKey.get("big-bend"))).toBe(true);
  });
});

describe("resolveTopic (URL permanence)", () => {
  const clusters = [
    cluster(["Big Bend National Park"]),
    cluster(["Big Bend National Park"]),
    cluster(["New York"]),
  ];
  const index = buildTopicIndex(clusters);

  it("keeps a previously advertised variant URL resolving to the same topic", () => {
    // /topic/big-bend was published before the canonical became the park.
    const entry = resolveTopic(index, "big-bend");
    expect(entry).not.toBeNull();
    expect(entry!.slug).toBe("big-bend-national-park");
  });

  it("resolves the canonical URL to itself", () => {
    expect(resolveTopic(index, "big-bend-national-park")!.key).toBe("big-bend");
  });

  it("does not hijack a different topic that merely shares a substring", () => {
    expect(resolveTopic(index, "york")).toBeNull();
    expect(resolveTopic(index, "new-york")!.slug).toBe("new-york");
  });

  it("returns null for an unknown slug so the route keeps its 200 empty state", () => {
    expect(resolveTopic(index, "zzz-not-a-real-entity-xyz")).toBeNull();
  });
});
