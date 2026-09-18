/**
 * The published article: its shape, its validation, and how it is stored.
 *
 * STORAGE — files in the repo, not rows in a database.
 *
 * Articles live as JSON under `content/articles/` and are read at BUILD time,
 * so every article page is fully static. This is not a stylistic choice, it is
 * the cost decision that makes the slim relaunch survivable: the aggregator
 * was paused for burning 4.8M ISR writes against a 200K allowance and 122h of
 * CPU against 4h, almost all of it re-rendering pages on demand. A static page
 * costs nothing to serve, does nothing per view, and touches no database.
 *
 * It also means an article is a reviewable artefact. It arrives in a commit,
 * the owner can read the diff, and publishing is a deploy — not a mutation in
 * a table nobody can see.
 *
 * VALIDATION — the editorial rules are enforced here, not just documented.
 *
 * The schema refuses an article with fewer than two independent publications,
 * or fewer than two a reader can actually open. An article that breaks the
 * free-range rule cannot be loaded, so it cannot be built, so it cannot ship.
 * A rule that lives only in a prompt is a suggestion; a rule in the schema is
 * a rule.
 */

import { z } from "zod";
import { CATEGORY_IDS } from "@/config/categories";
import { MIN_FREE_SOURCES, MIN_INDEPENDENT_DOMAINS } from "@/lib/editorial/eligibility";

/**
 * One block of article body.
 *
 * Structured blocks rather than a Markdown string: no parser dependency, no
 * `dangerouslySetInnerHTML`, and the renderer can only ever produce the
 * elements named here. Inline links use a restricted `[text](url)` form parsed
 * into React nodes — see `parseInline` in the renderer — never into HTML.
 */
export const articleBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({ type: z.literal("heading"), text: z.string().min(1) }),
  z.object({ type: z.literal("list"), items: z.array(z.string().min(1)).min(2) }),
  z.object({
    type: z.literal("quote"),
    text: z.string().min(1),
    /** Who said it and where it was reported. Required — an unattributed quote does not run. */
    attribution: z.string().min(1),
  }),
]);

export type ArticleBlock = z.infer<typeof articleBlockSchema>;

export const articleSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  access: z.enum(["free", "metered", "paywalled"]),
  /** The publication's own headline, so a reader can see what they are opening. */
  headline: z.string().min(1),
});

export type ArticleSource = z.infer<typeof articleSourceSchema>;

export const articleCorrectionSchema = z.object({
  /** ISO date the correction was made. */
  date: z.string().min(1),
  /** What was wrong and what it now says. Plain, specific, no euphemism. */
  text: z.string().min(1),
});

export const publishedArticleSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
    title: z.string().min(10),
    /** The standfirst: one sentence under the headline. */
    dek: z.string().min(20),
    category: z.enum(CATEGORY_IDS),
    /**
     * `draft` articles are ignored by the loader, so an unfinished or held
     * piece can sit in the repo without any risk of it being built.
     */
    status: z.enum(["draft", "published"]),
    publishedAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
    body: z.array(articleBlockSchema).min(3),
    sources: z.array(articleSourceSchema),
    /** Keyword targets this piece was built around, for later measurement. */
    keywordsTargeted: z.array(z.string()).default([]),
    /** The cluster this came from, so a run can trace an article to its brief. */
    clusterId: z.string().optional(),
    corrections: z.array(articleCorrectionSchema).default([]),
  })
  .superRefine((article, ctx) => {
    // The corroboration rule, enforced rather than trusted.
    const domains = new Set(
      article.sources.map((s) => {
        try {
          return new URL(s.url).hostname.replace(/^www\./, "");
        } catch {
          return s.url;
        }
      }),
    );
    if (domains.size < MIN_INDEPENDENT_DOMAINS) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: `needs at least ${MIN_INDEPENDENT_DOMAINS} independent publications, found ${domains.size}`,
      });
    }
    // The free-range rule, likewise.
    const free = article.sources.filter((s) => s.access === "free").length;
    if (free < MIN_FREE_SOURCES) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: `needs at least ${MIN_FREE_SOURCES} sources a reader can open without paying, found ${free}`,
      });
    }
    if (article.updatedAt && article.updatedAt < article.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt cannot precede publishedAt",
      });
    }
  });

export type PublishedArticle = z.infer<typeof publishedArticleSchema>;

/**
 * Parse one article, returning either the article or the reasons it is
 * invalid. Never throws: a single malformed file must not take down a build,
 * it must be reported and skipped.
 */
export function parseArticle(
  raw: unknown,
): { ok: true; article: PublishedArticle } | { ok: false; errors: string[] } {
  const result = publishedArticleSchema.safeParse(raw);
  if (result.success) return { ok: true, article: result.data };
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}

/** Newest first — the order a reader expects and the order the index renders. */
export function sortByPublished(articles: PublishedArticle[]): PublishedArticle[] {
  return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Sources a reader can open without paying. */
export function readableSources(article: PublishedArticle): ArticleSource[] {
  return article.sources.filter((s) => s.access === "free");
}

/**
 * The disclosure shown on every article.
 *
 * Owner decision 2026-09-15: AI-assistance disclosure on every article, no
 * fake human bylines. One constant so it cannot drift between templates.
 */
export const AI_DISCLOSURE_NOTICE =
  "Written with AI assistance by the CurrentWire News Desk, from reporting by " +
  "the publications listed above. No article is published without passing our " +
  "sourcing checks.";
