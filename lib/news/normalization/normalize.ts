import { resolveTier, lookupSourceByDomain, lookupSourceByName } from "@/config/sources";
import { classifyCategory } from "@/lib/news/classification/category";
import { classifyContentType } from "@/lib/news/classification/content-type";
import { classifyGeography } from "@/lib/news/classification/geography";
import { extractEntities } from "@/lib/news/classification/entities";
import { cleanDescription, cleanDisplayTitle } from "@/lib/news/normalization/boilerplate";
import { canonicalizeUrl, domainFromUrl } from "@/lib/news/normalization/canonicalize";
import type { Article, RawArticle } from "@/lib/news/types";
import { slugify, stableId, truncate } from "@/lib/utils/text";

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Normalize a raw provider article into a validated, classified Article.
 * Returns null for malformed input (missing title/URL, bad dates, unsafe URL).
 */
export function normalizeArticle(raw: RawArticle, now: Date = new Date()): Article | null {
  const title = raw.title?.trim();
  if (!title || title.length < 8) return null;
  if (/^\[removed\]$/i.test(title)) return null;

  const canonicalUrl = canonicalizeUrl(raw.url);
  if (!canonicalUrl) return null;

  const published = new Date(raw.publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  // Reject articles claiming to be published more than 30 minutes in the future.
  if (published.getTime() > now.getTime() + 30 * 60_000) return null;

  const sourceDomain = raw.sourceDomain?.trim() || domainFromUrl(raw.url);
  // Publisher identity comes from the DOMAIN map first; the provider-supplied
  // source string (often an RSS channel title like "ABC News: Top Stories")
  // is only a fallback for unknown domains.
  const sourceDef =
    lookupSourceByDomain(sourceDomain) ?? lookupSourceByName(raw.source ?? "");
  const source = sourceDef?.name ?? raw.source?.trim() ?? sourceDomain;
  if (!source) return null;

  // Content type runs on the RAW title/description BEFORE display cleaning:
  // the "| Author" byline pipe that cleaning strips IS an opinion signal.
  const rawTitle = stripHtml(title);
  const rawDescription = raw.description?.trim()
    ? stripHtml(raw.description.trim())
    : undefined;
  const contentType = classifyContentType({
    title: rawTitle,
    description: rawDescription,
  });

  // Boilerplate is stripped BEFORE truncation so a trailing "Sign up for…"
  // sentence can never survive by being inside the length budget.
  const cleanedDescription = rawDescription
    ? cleanDescription(rawDescription)
    : "";
  const description = cleanedDescription
    ? truncate(cleanedDescription, MAX_DESCRIPTION_LENGTH)
    : undefined;

  const cleanTitle = truncate(cleanDisplayTitle(rawTitle), MAX_TITLE_LENGTH);
  const category = classifyCategory({
    title: cleanTitle,
    description,
    providerCategory: raw.providerCategory,
    providerCategoryIsPrior: raw.providerCategoryIsPrior,
  });
  const country = classifyGeography({
    title: cleanTitle,
    description,
    sourceCountry: sourceDef?.country,
    providerCountry: raw.providerCountry,
  });

  const id = stableId(canonicalUrl);
  // Root-relative paths are local assets (demo art); remote URLs must be http(s).
  const imageUrl =
    raw.imageUrl &&
    (raw.imageUrl.startsWith("/") || canonicalizeUrl(raw.imageUrl))
      ? raw.imageUrl
      : undefined;

  return {
    id,
    slug: `${slugify(cleanTitle)}-${id}`,
    title: cleanTitle,
    description,
    url: raw.url,
    canonicalUrl,
    source,
    sourceSlug: slugify(source, 60),
    sourceDomain,
    sourceTier: resolveTier(source, sourceDomain),
    publishedAt: published.toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    imageUrl,
    author: raw.author?.trim() || undefined,
    country,
    category: category.primary,
    categories: category.all,
    contentType,
    entities: extractEntities(cleanTitle, description),
    provider: raw.provider,
    isMock: raw.isMock ?? false,
  };
}

/** Remove duplicate articles by canonical URL, keeping the first occurrence. */
export function dedupeExact(articles: Article[]): { unique: Article[]; removed: number } {
  const seen = new Set<string>();
  const unique: Article[] = [];
  let removed = 0;
  for (const article of articles) {
    if (seen.has(article.canonicalUrl)) {
      removed++;
      continue;
    }
    seen.add(article.canonicalUrl);
    unique.push(article);
  }
  return { unique, removed };
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
