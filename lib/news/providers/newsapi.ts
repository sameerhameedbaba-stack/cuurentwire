import { env } from "@/lib/env";
import type { FetchParams, NewsProvider, RawArticle } from "@/lib/news/types";

/**
 * NewsAPI.org adapter — https://newsapi.org/docs
 * Note: the free NewsAPI tier is development-only per their terms;
 * production use requires a paid plan.
 */

interface NewsApiArticle {
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  author?: string;
  source?: { id?: string; name?: string };
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
  message?: string;
}

export const newsApiProvider: NewsProvider = {
  name: "newsapi",

  isConfigured() {
    return Boolean(env.newsApiKey);
  },

  async fetchLatest(params: FetchParams = {}): Promise<RawArticle[]> {
    const apiKey = env.newsApiKey;
    if (!apiKey) return [];

    const countries = params.country ? [params.country] : (["us", "ca"] as const);
    const results: RawArticle[] = [];

    for (const country of countries) {
      const url = new URL("https://newsapi.org/v2/top-headlines");
      url.searchParams.set("country", country);
      url.searchParams.set("pageSize", String(Math.min(params.limit ?? 50, 100)));
      if (params.category) url.searchParams.set("category", params.category);

      const response = await fetch(url, {
        headers: { "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`NewsAPI responded ${response.status}`);
      }
      const data = (await response.json()) as NewsApiResponse;
      if (data.status !== "ok") {
        throw new Error(`NewsAPI error: ${data.message ?? "unknown"}`);
      }

      for (const item of data.articles ?? []) {
        if (!item.title || !item.url || !item.publishedAt) continue;
        results.push({
          title: item.title,
          description: item.description ?? undefined,
          url: item.url,
          source: item.source?.name ?? "",
          publishedAt: item.publishedAt,
          imageUrl: item.urlToImage ?? undefined,
          author: item.author ?? undefined,
          providerCategory: params.category,
          providerCountry: country,
          provider: "newsapi",
        });
      }
    }

    return results;
  },
};
