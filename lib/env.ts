/**
 * Typed server-side environment access. Values are read lazily so tests can
 * override process.env, and no secret ever reaches the client bundle.
 */

export type NewsDataMode = "mock" | "live";

export function getDataMode(): NewsDataMode {
  const mode = process.env.NEWS_DATA_MODE?.toLowerCase();
  if (mode === "live") return "live";
  if (mode === "mock") return "mock";
  // Default: live when at least one provider is configured, otherwise mock.
  return hasAnyProviderKey() ? "live" : "mock";
}

export function hasAnyProviderKey(): boolean {
  return Boolean(
    process.env.GNEWS_API_KEY ||
      process.env.NEWS_API_KEY ||
      process.env.RSS_FEEDS,
  );
}

export const env = {
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL || undefined;
  },
  get gnewsApiKey(): string | undefined {
    return process.env.GNEWS_API_KEY || undefined;
  },
  get newsApiKey(): string | undefined {
    return process.env.NEWS_API_KEY || undefined;
  },
  get rssFeeds(): string[] {
    return (process.env.RSS_FEEDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
  },
  get adminSecret(): string | undefined {
    return process.env.ADMIN_SECRET || undefined;
  },
  get refreshIntervalMs(): number {
    const minutes = Number(process.env.NEWS_REFRESH_MINUTES ?? "5");
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60_000;
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
