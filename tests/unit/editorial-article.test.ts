import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseArticle, readableSources, sortByPublished, type PublishedArticle } from "@/lib/editorial/article";
import { assertAllArticlesValid, getArticleBySlug, loadArticles } from "@/lib/editorial/store";

/** A valid article: two independent, free-to-read publications. */
function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "chipmaker-ships-ai-accelerator",
    title: "Chipmaker ships its new AI accelerator",
    dek: "Two publications put the price at $40,000 per unit.",
    category: "technology",
    status: "published",
    publishedAt: "2026-09-18T09:00:00.000Z",
    body: [
      { type: "paragraph", text: "First paragraph." },
      { type: "paragraph", text: "Second paragraph." },
      { type: "paragraph", text: "Third paragraph." },
    ],
    sources: [
      {
        name: "Associated Press",
        url: "https://apnews.com/article/x",
        access: "free",
        headline: "Chipmaker ships new accelerator",
      },
      {
        name: "The Verge",
        url: "https://theverge.com/x",
        access: "free",
        headline: "The new accelerator lands",
      },
    ],
    ...overrides,
  };
}

const tempDirs: string[] = [];

function storeWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "cw-articles-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("publishedArticleSchema — the editorial rules are enforced, not trusted", () => {
  it("accepts a well-formed article", () => {
    const result = parseArticle(makeRaw());
    expect(result.ok).toBe(true);
  });

  it("refuses an article with only one publication", () => {
    const result = parseArticle(
      makeRaw({
        sources: [
          { name: "AP", url: "https://apnews.com/a", access: "free", headline: "Only one" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain("at least 2 independent publications");
  });

  it("refuses two 'sources' that are the same publication twice", () => {
    const result = parseArticle(
      makeRaw({
        sources: [
          { name: "AP", url: "https://apnews.com/a", access: "free", headline: "One" },
          { name: "AP", url: "https://apnews.com/b", access: "free", headline: "Two" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain("independent publications");
  });

  it("refuses an article a reader cannot open — the free-range rule", () => {
    const result = parseArticle(
      makeRaw({
        sources: [
          { name: "WSJ", url: "https://wsj.com/a", access: "paywalled", headline: "One" },
          { name: "Bloomberg", url: "https://bloomberg.com/b", access: "paywalled", headline: "Two" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain("without paying");
  });

  it("refuses an unattributed quote", () => {
    const result = parseArticle(
      makeRaw({
        body: [
          { type: "paragraph", text: "One." },
          { type: "paragraph", text: "Two." },
          { type: "quote", text: "We are pleased." },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a non-kebab-case slug", () => {
    expect(parseArticle(makeRaw({ slug: "Not A Slug" })).ok).toBe(false);
  });

  it("refuses updatedAt before publishedAt", () => {
    const result = parseArticle(makeRaw({ updatedAt: "2026-09-17T09:00:00.000Z" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain("cannot precede");
  });

  it("refuses a stub with no real body", () => {
    expect(parseArticle(makeRaw({ body: [{ type: "paragraph", text: "Only one." }] })).ok).toBe(false);
  });

  it("defaults corrections to an empty list", () => {
    const result = parseArticle(makeRaw());
    expect(result.ok && result.article.corrections).toEqual([]);
  });

  it("never throws on rubbish input", () => {
    expect(parseArticle(null).ok).toBe(false);
    expect(parseArticle({ __parseError: "boom" }).ok).toBe(false);
    expect(parseArticle("not an object").ok).toBe(false);
  });
});

describe("the store", () => {
  it("loads a published article", () => {
    const dir = storeWith({ "a.json": makeRaw() });
    const { articles, invalid } = loadArticles(dir);
    expect(invalid).toEqual([]);
    expect(articles).toHaveLength(1);
    expect(articles[0].slug).toBe("chipmaker-ships-ai-accelerator");
  });

  it("ignores drafts entirely", () => {
    const dir = storeWith({ "draft.json": makeRaw({ status: "draft" }) });
    const { articles, drafts } = loadArticles(dir);
    expect(articles).toHaveLength(0);
    expect(drafts).toBe(1);
  });

  it("skips an invalid file instead of failing the whole build", () => {
    const dir = storeWith({
      "good.json": makeRaw(),
      "bad.json": makeRaw({ slug: "other-slug", sources: [] }),
    });
    const { articles, invalid } = loadArticles(dir);
    expect(articles).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].file).toContain("bad.json");
  });

  it("survives a file that is not even JSON", () => {
    const dir = storeWith({ "broken.json": "{ this is not json" });
    const { articles, invalid } = loadArticles(dir);
    expect(articles).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it("refuses a duplicate slug rather than letting directory order decide", () => {
    const dir = storeWith({ "one.json": makeRaw(), "two.json": makeRaw() });
    const { articles, invalid } = loadArticles(dir);
    expect(articles).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].errors.join()).toContain("duplicate slug");
  });

  it("reads nested directories, so articles can be foldered by date", () => {
    const dir = storeWith({ "2026-09-18/a.json": makeRaw() });
    expect(loadArticles(dir).articles).toHaveLength(1);
  });

  it("returns an empty store for a directory that does not exist", () => {
    expect(loadArticles("/nonexistent/path/xyz").articles).toEqual([]);
  });

  it("finds an article by slug", () => {
    const dir = storeWith({ "a.json": makeRaw() });
    expect(getArticleBySlug("chipmaker-ships-ai-accelerator", dir)?.title).toBeDefined();
    expect(getArticleBySlug("nope", dir)).toBeUndefined();
  });

  it("assertAllArticlesValid throws on a broken store and passes on a clean one", () => {
    const clean = storeWith({ "a.json": makeRaw() });
    expect(() => assertAllArticlesValid(clean)).not.toThrow();
    const broken = storeWith({ "a.json": makeRaw({ sources: [] }) });
    expect(() => assertAllArticlesValid(broken)).toThrow(/Invalid article file/);
  });

  it("the real content/ directory is always valid", () => {
    // Guards the actual store: a malformed article committed to the repo
    // fails CI rather than quietly vanishing from the built site.
    expect(() => assertAllArticlesValid()).not.toThrow();
  });
});

describe("helpers", () => {
  it("sorts newest first", () => {
    const base = parseArticle(makeRaw());
    if (!base.ok) throw new Error("fixture invalid");
    const older: PublishedArticle = { ...base.article, slug: "older", publishedAt: "2026-09-01T00:00:00.000Z" };
    const newer: PublishedArticle = { ...base.article, slug: "newer", publishedAt: "2026-09-20T00:00:00.000Z" };
    expect(sortByPublished([older, newer]).map((a) => a.slug)).toEqual(["newer", "older"]);
  });

  it("readableSources returns only what a reader can open", () => {
    const result = parseArticle(
      makeRaw({
        sources: [
          { name: "AP", url: "https://apnews.com/a", access: "free", headline: "One" },
          { name: "Verge", url: "https://theverge.com/b", access: "free", headline: "Two" },
          { name: "WSJ", url: "https://wsj.com/c", access: "paywalled", headline: "Three" },
        ],
      }),
    );
    if (!result.ok) throw new Error("fixture invalid");
    expect(readableSources(result.article).map((s) => s.name)).toEqual(["AP", "Verge"]);
  });
});
