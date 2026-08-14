import { describe, expect, it } from "vitest";
import { lookupSourceByDomain, resolveTier } from "@/config/sources";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import type { RawArticle } from "@/lib/news/types";

/**
 * Source identity normalization (Stage C audit fix): publisher display name
 * and tier come from the DOMAIN map; RSS channel titles ("ABC News: Top
 * Stories") are only a fallback for unknown domains. Every live feed's
 * item-link domain (and known variants) must resolve to the intended
 * canonical name and tier.
 */

const NOW = new Date("2026-08-14T12:00:00Z");

/** All 13 live RSS feeds + GNews domains: item-link host → expected identity. */
const LIVE_FEED_DOMAINS: [domain: string, name: string, tier: string][] = [
  // 13 RSS_FEEDS publishers (item-link hostnames as observed in the feeds)
  ["www.npr.org", "NPR", "A"],
  ["feeds.npr.org", "NPR", "A"],
  ["abcnews.go.com", "ABC News", "B"],
  ["abcnews.com", "ABC News", "B"], // migrated domain seen in live items
  ["www.cbsnews.com", "CBS News", "B"],
  ["www.theguardian.com", "The Guardian", "B"],
  ["www.cnbc.com", "CNBC", "B"],
  ["www.theverge.com", "The Verge", "B"],
  ["arstechnica.com", "Ars Technica", "B"],
  ["www.espn.com", "ESPN", "B"],
  ["www.politico.com", "Politico", "B"],
  ["feeds.bbci.co.uk", "BBC News", "A"], // feed host
  ["www.bbc.com", "BBC News", "A"],
  ["www.bbc.co.uk", "BBC News", "A"],
  ["thehill.com", "The Hill", "B"],
  ["globalnews.ca", "Global News", "B"],
  ["financialpost.com", "Financial Post", "B"],
  // Frequent GNews source domains
  ["www.cbc.ca", "CBC News", "A"],
  ["www.ctvnews.ca", "CTV News", "A"],
  ["www.reuters.com", "Reuters", "A"],
  ["apnews.com", "Associated Press", "A"],
  ["www.cnn.com", "CNN", "B"],
  ["edition.cnn.com", "CNN", "B"],
];

describe("live feed domain → canonical publisher identity", () => {
  it.each(LIVE_FEED_DOMAINS)("%s → %s (tier %s)", (domain, name, tier) => {
    const def = lookupSourceByDomain(domain);
    expect(def, `no source definition resolves ${domain}`).toBeDefined();
    expect(def!.name).toBe(name);
    expect(def!.tier).toBe(tier);
    expect(resolveTier("anything", domain)).toBe(tier);
  });
});

describe("normalizeArticle source identity", () => {
  const raw = (overrides: Partial<RawArticle>): RawArticle => ({
    title: "A perfectly reasonable synthetic headline about a court ruling",
    url: "https://example.com/x",
    source: "src",
    publishedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
    provider: "rss",
    ...overrides,
  });

  it("prefers the domain map over a leaked RSS channel title (audit case)", () => {
    const article = normalizeArticle(
      raw({
        source: "ABC News: Top Stories",
        url: "https://abcnews.go.com/US/synthetic/story?id=1",
        sourceDomain: "abcnews.go.com",
      }),
      NOW,
    )!;
    expect(article.source).toBe("ABC News");
    expect(article.sourceTier).toBe("B");

    const migrated = normalizeArticle(
      raw({
        source: "ABC News: Top Stories",
        url: "https://abcnews.com/US/synthetic/story?id=2",
        sourceDomain: "abcnews.com",
      }),
      NOW,
    )!;
    expect(migrated.source).toBe("ABC News");
    expect(migrated.sourceTier).toBe("B");
  });

  it("keeps the channel title only for unknown domains", () => {
    const article = normalizeArticle(
      raw({
        source: "SmallTown Gazette RSS",
        url: "https://smalltown-gazette.example.net/story",
        sourceDomain: "smalltown-gazette.example.net",
      }),
      NOW,
    )!;
    expect(article.source).toBe("SmallTown Gazette RSS");
    expect(article.sourceTier).toBe("C");
  });

  it("resolves BBC item links on bbc.co.uk to BBC News tier A", () => {
    const article = normalizeArticle(
      raw({
        source: "BBC News - Home",
        url: "https://www.bbc.co.uk/news/articles/synthetic",
        sourceDomain: "www.bbc.co.uk",
      }),
      NOW,
    )!;
    expect(article.source).toBe("BBC News");
    expect(article.sourceTier).toBe("A");
  });
});
