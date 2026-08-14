import { describe, expect, it } from "vitest";
import { dedupeExact, normalizeArticle } from "@/lib/news/normalization/normalize";
import type { RawArticle } from "@/lib/news/types";

const NOW = new Date("2026-08-13T12:00:00Z");

function raw(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title: "A perfectly reasonable headline about the economy",
    description: "Something happened and here is a description of it.",
    url: "https://www.example.com/story?utm_source=feed",
    source: "Example Outlet",
    publishedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
    provider: "test",
    ...overrides,
  };
}

describe("normalizeArticle", () => {
  it("normalizes a valid article with canonical URL and stable id", () => {
    const article = normalizeArticle(raw(), NOW);
    expect(article).not.toBeNull();
    expect(article!.canonicalUrl).toBe("https://example.com/story");
    expect(article!.id).toMatch(/^[0-9a-f]{12}$/);
    expect(article!.slug.endsWith(article!.id)).toBe(true);
    expect(article!.publishedAt).toBe(raw().publishedAt);
  });

  it("rejects malformed input", () => {
    expect(normalizeArticle(raw({ title: "" }), NOW)).toBeNull();
    expect(normalizeArticle(raw({ title: "Short" }), NOW)).toBeNull();
    expect(normalizeArticle(raw({ title: "[Removed]" }), NOW)).toBeNull();
    expect(normalizeArticle(raw({ url: "javascript:alert(1)" }), NOW)).toBeNull();
    expect(normalizeArticle(raw({ publishedAt: "not-a-date" }), NOW)).toBeNull();
  });

  it("rejects articles claiming future publication", () => {
    const future = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();
    expect(normalizeArticle(raw({ publishedAt: future }), NOW)).toBeNull();
  });

  it("demotes weak-World DOMESTIC crime stories, keeps genuinely international ones", () => {
    // Domestic Canadian crime: "kidnapped" is world vocabulary, but the
    // story is Toronto + no international marker — never World.
    const domestic = normalizeArticle(
      raw({
        title: "Man kidnapped at gunpoint in Toronto parking garage, police say",
        description: "Investigators are asking witnesses to come forward.",
      }),
      NOW,
    );
    expect(domestic!.country).toBe("CA");
    expect(domestic!.category).not.toBe("world");

    // International abduction: the foreign place carries world evidence, so
    // the US-relevance of the victim never demotes it.
    const international = normalizeArticle(
      raw({
        title: "American missionary kidnapped in Niger is released, his group says",
        description: "The aid group confirmed the release after months of captivity.",
      }),
      NOW,
    );
    expect(international!.category).toBe("world");

    // Strong domestic-relevant world evidence (multiple signals) stays world.
    const strong = normalizeArticle(
      raw({
        title: "Canada imposes sanctions after airstrike, recalls its embassy staff",
        description: "Ottawa announced coordinated diplomatic measures.",
      }),
      NOW,
    );
    expect(strong!.category).toBe("world");
  });

  it("strips HTML from titles and descriptions", () => {
    const article = normalizeArticle(
      raw({
        title: "Headline with <b>markup</b> &amp; entities inside it",
        description: "<p>Description with markup</p>",
      }),
      NOW,
    );
    expect(article!.title).toBe("Headline with markup & entities inside it");
    expect(article!.description).toBe("Description with markup");
  });

  it("resolves source tier from configured domains", () => {
    const article = normalizeArticle(
      raw({ url: "https://www.reuters.com/business/story", source: "Reuters" }),
      NOW,
    );
    expect(article!.sourceTier).toBe("A");
    const unknown = normalizeArticle(
      raw({ url: "https://tiny-blog.example.net/post", source: "Tiny Blog" }),
      NOW,
    );
    expect(unknown!.sourceTier).toBe("C");
  });
});

describe("dedupeExact", () => {
  it("removes articles sharing a canonical URL", () => {
    const a = normalizeArticle(raw(), NOW)!;
    const b = normalizeArticle(
      raw({ url: "http://example.com/story#comments" }),
      NOW,
    )!;
    const c = normalizeArticle(
      raw({ url: "https://example.com/other-story" }),
      NOW,
    )!;
    const { unique, removed } = dedupeExact([a, b, c]);
    expect(unique).toHaveLength(2);
    expect(removed).toBe(1);
  });
});
