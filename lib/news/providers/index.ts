import { getDataMode } from "@/lib/env";
import type { NewsProvider } from "@/lib/news/types";
import { gnewsProvider } from "./gnews";
import { mockProvider } from "./mock";
import { newsApiProvider } from "./newsapi";
import { rssProvider } from "./rss";

/** All registered live providers, in priority order. */
export const LIVE_PROVIDERS: NewsProvider[] = [
  gnewsProvider,
  newsApiProvider,
  rssProvider,
];

/**
 * Providers active for the current data mode.
 * Mock mode returns only the mock provider; live mode returns every
 * configured live provider (multiple providers improve clustering).
 */
export function activeProviders(): NewsProvider[] {
  if (getDataMode() === "mock") return [mockProvider];
  const configured = LIVE_PROVIDERS.filter((p) => p.isConfigured());
  return configured.length > 0 ? configured : [mockProvider];
}
