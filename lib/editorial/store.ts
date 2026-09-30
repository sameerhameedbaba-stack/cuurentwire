/**
 * Reading published articles off disk at build time.
 *
 * SERVER ONLY. This touches the filesystem, so it must never be imported into
 * a client component — doing so fails the build with a module-not-found on
 * `node:fs`, which is the guard rail here (the repo does not carry the
 * `server-only` package, and this is not worth a dependency for). It is called
 * from `generateStaticParams` and from page components during the build, which
 * is exactly when the filesystem exists.
 *
 * Failure policy: one bad file is reported and skipped, never fatal. A single
 * malformed article taking down the whole site would be a far worse outcome
 * than that article being missing — and the build log names it, so it gets
 * fixed. `assertAllArticlesValid()` exists for the test that DOES want the
 * hard failure.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArticle, sortByPublished, type PublishedArticle } from "@/lib/editorial/article";

/** Where articles live. Repo-relative so it works in the build sandbox. */
export const ARTICLES_DIR = join(process.cwd(), "content", "articles");

export interface LoadResult {
  articles: PublishedArticle[];
  /** Files that failed validation: path and why. */
  invalid: { file: string; errors: string[] }[];
  /** Valid but not published yet. */
  drafts: number;
}

function readArticleFiles(dir: string): { file: string; raw: unknown }[] {
  if (!existsSync(dir)) return [];
  const out: { file: string; raw: unknown }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...readArticleFiles(join(dir, entry.name)));
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    const path = join(dir, entry.name);
    try {
      out.push({ file: path, raw: JSON.parse(readFileSync(path, "utf8")) });
    } catch (error) {
      out.push({ file: path, raw: { __parseError: String(error) } });
    }
  }
  return out;
}

/**
 * Load every article in the store.
 *
 * Not memoised across builds on purpose — Next calls this a handful of times
 * per build over a directory of at most a few thousand small files, and a
 * stale cache during development is a worse trade than the milliseconds.
 */
export function loadArticles(dir: string = ARTICLES_DIR): LoadResult {
  const articles: PublishedArticle[] = [];
  const invalid: { file: string; errors: string[] }[] = [];
  let drafts = 0;
  const slugs = new Map<string, string>();

  for (const { file, raw } of readArticleFiles(dir)) {
    const parsed = parseArticle(raw);
    if (!parsed.ok) {
      invalid.push({ file, errors: parsed.errors });
      continue;
    }
    const article = parsed.article;
    // Two files claiming one slug would make the built route ambiguous and
    // the winner would depend on directory order. Refuse both loudly.
    const existing = slugs.get(article.slug);
    if (existing) {
      invalid.push({ file, errors: [`duplicate slug "${article.slug}", also in ${existing}`] });
      continue;
    }
    slugs.set(article.slug, file);
    if (article.status !== "published") {
      drafts += 1;
      continue;
    }
    articles.push(article);
  }

  return { articles: sortByPublished(articles), invalid, drafts };
}

/** Published articles only — the common case. */
export function getPublishedArticles(dir?: string): PublishedArticle[] {
  const { articles, invalid } = loadArticles(dir);
  if (invalid.length > 0) {
    // Surfaces in the build log where it will actually be read.
    console.warn(
      `[editorial] ${invalid.length} article file(s) skipped:\n` +
        invalid.map((i) => `  ${i.file}\n    ${i.errors.join("\n    ")}`).join("\n"),
    );
  }
  return articles;
}

export function getArticleBySlug(slug: string, dir?: string): PublishedArticle | undefined {
  return getPublishedArticles(dir).find((article) => article.slug === slug);
}

export function getArticlesByCategory(category: string, dir?: string): PublishedArticle[] {
  return getPublishedArticles(dir).filter((article) => article.category === category);
}

/**
 * Throw if anything in the store is invalid.
 *
 * Used by the test suite, where a broken article SHOULD fail the run — CI is
 * the right place to be strict, because nothing is being served yet.
 */
export function assertAllArticlesValid(dir?: string): void {
  const { invalid } = loadArticles(dir);
  if (invalid.length === 0) return;
  throw new Error(
    `Invalid article file(s):\n` +
      invalid.map((i) => `  ${i.file}\n    ${i.errors.join("\n    ")}`).join("\n"),
  );
}
