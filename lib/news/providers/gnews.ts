import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import type { FetchParams, NewsProvider, RawArticle } from "@/lib/news/types";

/**
 * GNews adapter — https://gnews.io/docs/v4
 * Free tier supports top-headlines by country/category.
 *
 * Results live in their own shared cache entry (tag "gnews-articles") on a
 * slower cadence than the dataset cache, so the RSS fast lane can refresh
 * the dataset every few minutes without spending GNews quota. HTTP errors
 * still throw inside the cached function, so a failure is never cached.
 */

export const GNEWS_CACHE_TAG = "gnews-articles";

interface GNewsArticle {
  title: string;
  description?: string;
  content?: string;
  url: string;
  image?: string;
  publishedAt: string;
  source?: { name?: string; url?: string };
}

interface GNewsResponse {
  articles?: GNewsArticle[];
}

export const gnewsProvider: NewsProvider = {
  name: "gnews",

  isConfigured() {
    return Boolean(env.gnewsApiKey);
  },

  async fetchLatest(params: FetchParams = {}): Promise<RawArticle[]> {
    if (!env.gnewsApiKey) return [];

    // Own cache entry with its own revalidate window: the dataset cache can
    // re-run every ~5 min while GNews is only hit once per its cadence.
    // RawArticle[] is JSON-serializable, so the shared cache round-trips it.
    const cached = unstable_cache(fetchFromApi, ["gnews-articles"], {
      tags: [GNEWS_CACHE_TAG],
      revalidate: env.gnewsRefreshMinutes * 60,
    });
    return cached(params);
  },
};

/** Uncached GNews API call. Throws on HTTP errors so failures never cache. */
async function fetchFromApi(params: FetchParams): Promise<RawArticle[]> {
  const apiKey = env.gnewsApiKey;
  if (!apiKey) return [];

  const countries = params.country ? [params.country] : (["us", "ca"] as const);
  const results: RawArticle[] = [];
  let firstRequest = true;

  for (const country of countries) {
    // GNews free tier allows ~1 request/second — space out country fetches.
    if (!firstRequest) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    firstRequest = false;
    const url = new URL("https://gnews.io/api/v4/top-headlines");
    url.searchParams.set("country", country);
    url.searchParams.set("lang", "en");
    url.searchParams.set("max", String(Math.min(params.limit ?? 50, 100)));
    if (params.category) url.searchParams.set("category", params.category);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`GNews responded ${response.status}`);
    }
    const data = (await response.json()) as GNewsResponse;

    for (const item of data.articles ?? []) {
      if (!item.title || !item.url) continue;
      results.push({
        title: item.title,
        description: item.description || item.content?.slice(0, 400),
        url: item.url,
        source: item.source?.name ?? "",
        sourceDomain: item.source?.url
          ? safeHostname(item.source.url)
          : undefined,
        publishedAt: item.publishedAt,
        imageUrl: item.image,
        providerCategory: params.category,
        providerCountry: country,
        provider: "gnews",
      });
    }
  }

  return results;
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
