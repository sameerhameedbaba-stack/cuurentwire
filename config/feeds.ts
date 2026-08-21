/**
 * Curated official RSS feeds (2026-08-21 probe: scripts/probe-feeds.mjs).
 *
 * Every entry is a publisher's own public syndication feed. Coverage was
 * running on 13 feeds; this list multiplies the input so every section and
 * topic hub has enough real stories to rank, and adds Canada's and the US's
 * largest national desks section by section.
 *
 * Selection rules (verified by the probe, not assumed):
 * - alive, fresh (newest item < ~3 days), real descriptions;
 * - section feeds from multi-section publishers carry a `category` prior —
 *   a WEAK classifier nudge (PRIOR_WEIGHT), never a verdict;
 * - national-desk feeds carry a `country` hint for geography;
 * - no NYT/WaPo (RSS terms restrict commercial reuse), no CNN (feeds
 *   abandoned — newest items years old), no USA Today (empty feeds).
 *
 * Activation: merged with the RSS_FEEDS env var (owner-added feeds) whenever
 * RSS is on — i.e. RSS_FEEDS is set or RSS_CURATED_FEEDS=on. RSS_CURATED_FEEDS=off
 * disables this list entirely (env feeds only). Local dev without either
 * stays in demo mode exactly as before.
 */
import type { CategoryId } from "./categories";
import { env } from "@/lib/env";

export interface FeedDefinition {
  url: string;
  /** Publisher name for humans (identity still resolves via config/sources). */
  publisher: string;
  /** Single-section feed: classifier prior for that section. */
  category?: CategoryId;
  /** National-desk feed: geography hint. */
  country?: "US" | "CA";
  /** Per-feed item cap (default DEFAULT_FEED_ITEM_CAP) — floods never dominate. */
  maxItems?: number;
  /** Per-feed fetch timeout (default DEFAULT_FEED_TIMEOUT_MS). */
  timeoutMs?: number;
}

export const DEFAULT_FEED_TIMEOUT_MS = 8_000;

export const DEFAULT_FEED_ITEM_CAP = 25;

export const CURATED_FEEDS: FeedDefinition[] = [
  // ── US national desks ────────────────────────────────────────────────
  { url: "https://feeds.npr.org/1003/rss.xml", publisher: "NPR", country: "US" },
  { url: "https://feeds.npr.org/1014/rss.xml", publisher: "NPR", category: "politics" },
  { url: "https://feeds.npr.org/1004/rss.xml", publisher: "NPR", category: "world" },
  { url: "https://feeds.npr.org/1006/rss.xml", publisher: "NPR", category: "business" },
  { url: "https://feeds.npr.org/1019/rss.xml", publisher: "NPR", category: "technology" },
  { url: "https://feeds.npr.org/1007/rss.xml", publisher: "NPR", category: "science" },
  { url: "https://feeds.npr.org/1128/rss.xml", publisher: "NPR", category: "health" },
  { url: "https://feeds.npr.org/1013/rss.xml", publisher: "NPR" }, // education
  { url: "https://feeds.npr.org/1008/rss.xml", publisher: "NPR", category: "culture" },
  { url: "https://feeds.npr.org/1025/rss.xml", publisher: "NPR", category: "climate" },
  { url: "https://www.cbsnews.com/latest/rss/us", publisher: "CBS News", country: "US" },
  { url: "https://www.cbsnews.com/latest/rss/politics", publisher: "CBS News", category: "politics" },
  { url: "https://www.cbsnews.com/latest/rss/world", publisher: "CBS News", category: "world" },
  { url: "https://www.cbsnews.com/latest/rss/health", publisher: "CBS News", category: "health" },
  { url: "https://www.cbsnews.com/latest/rss/moneywatch", publisher: "CBS News", category: "business" },
  { url: "https://www.cbsnews.com/latest/rss/science", publisher: "CBS News", category: "science" },
  { url: "https://www.cbsnews.com/latest/rss/technology", publisher: "CBS News", category: "technology" },
  { url: "https://www.cbsnews.com/latest/rss/entertainment", publisher: "CBS News", category: "culture" },
  { url: "https://www.cbsnews.com/latest/rss/crime", publisher: "CBS News", country: "US" },
  { url: "https://abcnews.go.com/abcnews/usheadlines", publisher: "ABC News", country: "US" },
  { url: "https://abcnews.go.com/abcnews/politicsheadlines", publisher: "ABC News", category: "politics" },
  { url: "https://abcnews.go.com/abcnews/internationalheadlines", publisher: "ABC News", category: "world" },
  { url: "https://abcnews.go.com/abcnews/moneyheadlines", publisher: "ABC News", category: "business" },
  { url: "https://abcnews.go.com/abcnews/technologyheadlines", publisher: "ABC News", category: "technology" },
  { url: "https://abcnews.go.com/abcnews/healthheadlines", publisher: "ABC News", category: "health" },
  { url: "https://abcnews.go.com/abcnews/entertainmentheadlines", publisher: "ABC News", category: "culture" },
  { url: "https://abcnews.go.com/abcnews/sportsheadlines", publisher: "ABC News", category: "sports" },
  { url: "https://feeds.nbcnews.com/nbcnews/public/politics", publisher: "NBC News", category: "politics" },
  { url: "https://feeds.nbcnews.com/nbcnews/public/world", publisher: "NBC News", category: "world" },
  { url: "https://feeds.nbcnews.com/nbcnews/public/business", publisher: "NBC News", category: "business" },
  { url: "https://feeds.nbcnews.com/nbcnews/public/health", publisher: "NBC News", category: "health" },
  { url: "https://feeds.nbcnews.com/nbcnews/public/science", publisher: "NBC News", category: "science" },
  { url: "https://www.pbs.org/newshour/feeds/rss/politics", publisher: "PBS NewsHour", category: "politics" },
  { url: "https://www.pbs.org/newshour/feeds/rss/nation", publisher: "PBS NewsHour", country: "US" },
  { url: "https://www.pbs.org/newshour/feeds/rss/world", publisher: "PBS NewsHour", category: "world" },
  { url: "https://www.pbs.org/newshour/feeds/rss/economy", publisher: "PBS NewsHour", category: "business" },
  { url: "https://www.pbs.org/newshour/feeds/rss/science", publisher: "PBS NewsHour", category: "science" },
  { url: "https://www.pbs.org/newshour/feeds/rss/health", publisher: "PBS NewsHour", category: "health" },
  { url: "https://www.pbs.org/newshour/feeds/rss/education", publisher: "PBS NewsHour" },
  { url: "https://moxie.foxnews.com/google-publisher/politics.xml", publisher: "Fox News", category: "politics" },
  { url: "https://moxie.foxnews.com/google-publisher/us.xml", publisher: "Fox News", country: "US" },
  { url: "https://moxie.foxnews.com/google-publisher/world.xml", publisher: "Fox News", category: "world" },
  { url: "https://moxie.foxnews.com/google-publisher/science.xml", publisher: "Fox News", category: "science" },
  { url: "https://moxie.foxnews.com/google-publisher/health.xml", publisher: "Fox News", category: "health" },
  { url: "https://api.axios.com/feed/", publisher: "Axios", maxItems: 25 },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", publisher: "CNBC", category: "business" },
  { url: "https://www.cnbc.com/id/10000113/device/rss/rss.html", publisher: "CNBC", category: "politics" },
  { url: "https://www.cnbc.com/id/21324812/device/rss/rss.html", publisher: "CNBC", category: "business" }, // personal finance
  { url: "https://www.cnbc.com/id/10000108/device/rss/rss.html", publisher: "CNBC", category: "health" },
  { url: "http://feeds.marketwatch.com/marketwatch/topstories/", publisher: "MarketWatch", category: "business" },
  { url: "https://thehill.com/feed/", publisher: "The Hill", category: "politics", maxItems: 25 },
  { url: "http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", publisher: "BBC News" },
  { url: "https://www.theguardian.com/us-news/rss", publisher: "The Guardian", country: "US", maxItems: 25 },
  // ── Canada ───────────────────────────────────────────────────────────
  { url: "https://www.cbc.ca/webfeed/rss/rss-topstories", publisher: "CBC News" },
  { url: "https://www.cbc.ca/webfeed/rss/rss-canada", publisher: "CBC News", country: "CA" },
  { url: "https://www.cbc.ca/webfeed/rss/rss-politics", publisher: "CBC News", category: "politics", country: "CA" },
  { url: "https://globalnews.ca/canada/feed/", publisher: "Global News", country: "CA" },
  { url: "https://globalnews.ca/politics/feed/", publisher: "Global News", category: "politics", country: "CA" },
  { url: "https://globalnews.ca/money/feed/", publisher: "Global News", category: "business", country: "CA" },
  { url: "https://globalnews.ca/health/feed/", publisher: "Global News", category: "health", country: "CA" },
  { url: "https://globalnews.ca/world/feed/", publisher: "Global News", category: "world" },
  { url: "https://globalnews.ca/entertainment/feed/", publisher: "Global News", category: "culture" },
  { url: "https://globalnews.ca/sports/feed/", publisher: "Global News", category: "sports", country: "CA" },
  { url: "https://globalnews.ca/tech/feed/", publisher: "Global News", category: "technology" },
  { url: "https://nationalpost.com/feed/", publisher: "National Post", country: "CA" },
  { url: "https://financialpost.com/feed/", publisher: "Financial Post", category: "business", country: "CA" },
  { url: "https://www.sportsnet.ca/feed/", publisher: "Sportsnet", category: "sports", country: "CA", maxItems: 20 },
  // ── World ────────────────────────────────────────────────────────────
  { url: "http://feeds.bbci.co.uk/news/world/rss.xml", publisher: "BBC News", category: "world" },
  { url: "https://www.theguardian.com/world/rss", publisher: "The Guardian", category: "world", maxItems: 25 },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", publisher: "Al Jazeera", category: "world", maxItems: 15 },
  { url: "https://www.france24.com/en/rss", publisher: "France 24", category: "world", maxItems: 15 },
  // ── Technology & AI ──────────────────────────────────────────────────
  { url: "https://techcrunch.com/feed/", publisher: "TechCrunch", category: "technology" },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", publisher: "TechCrunch", category: "technology" },
  { url: "https://www.technologyreview.com/feed/", publisher: "MIT Technology Review", category: "technology" },
  { url: "https://venturebeat.com/category/ai/feed/", publisher: "VentureBeat", category: "technology" },
  { url: "https://www.theverge.com/rss/index.xml", publisher: "The Verge", category: "technology" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", publisher: "Ars Technica", category: "technology" },
  // ── Science & health ─────────────────────────────────────────────────
  { url: "https://www.space.com/feeds/all", publisher: "Space.com", category: "science", maxItems: 15 },
  { url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", publisher: "NASA", category: "science" },
  { url: "https://phys.org/rss-feed/", publisher: "Phys.org", category: "science", maxItems: 15 },
  { url: "https://www.statnews.com/feed/", publisher: "STAT", category: "health", maxItems: 15 },
  { url: "https://kffhealthnews.org/feed/", publisher: "KFF Health News", category: "health" },
  // ── Climate & energy ─────────────────────────────────────────────────
  { url: "https://insideclimatenews.org/feed/", publisher: "Inside Climate News", category: "climate" },
  { url: "https://grist.org/feed/", publisher: "Grist", category: "climate" },
  { url: "https://www.theguardian.com/us/environment/rss", publisher: "The Guardian", category: "climate" },
  // ── Entertainment ────────────────────────────────────────────────────
  { url: "https://variety.com/feed/", publisher: "Variety", category: "culture" },
  { url: "https://deadline.com/feed/", publisher: "Deadline", category: "culture" },
  { url: "https://www.billboard.com/feed/", publisher: "Billboard", category: "culture" },
  // ── Sports ───────────────────────────────────────────────────────────
  { url: "https://www.espn.com/espn/rss/news", publisher: "ESPN", category: "sports" },
  { url: "https://www.cbssports.com/rss/headlines/", publisher: "CBS Sports", category: "sports", maxItems: 20 },
  // ── Topic specialists (education, housing, justice, regional) ────────
  { url: "https://www.chalkbeat.org/arc/outboundfeeds/rss/", publisher: "Chalkbeat", country: "US", maxItems: 15 },
  { url: "https://www.housingwire.com/feed/", publisher: "HousingWire", category: "business", country: "US" },
  { url: "https://www.themarshallproject.org/rss/recent.rss", publisher: "The Marshall Project", country: "US", maxItems: 10 },
  { url: "https://www.propublica.org/feeds/propublica/main", publisher: "ProPublica", country: "US", maxItems: 10 },
  { url: "https://www.texastribune.org/feeds/main/", publisher: "The Texas Tribune", country: "US", maxItems: 15 },
  { url: "https://calmatters.org/feed/", publisher: "CalMatters", country: "US" },
  { url: "https://www.latimes.com/local/rss2.0.xml", publisher: "Los Angeles Times", country: "US", maxItems: 15 },
  { url: "https://religionnews.com/feed/", publisher: "Religion News Service", country: "US" },
];

function normalizeFeedUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** True when the curated list should join the configured feeds. */
export function curatedFeedsEnabled(): boolean {
  const flag = (process.env.RSS_CURATED_FEEDS ?? "").trim().toLowerCase();
  if (flag === "off" || flag === "false" || flag === "0") return false;
  if (flag === "on" || flag === "true" || flag === "1") return true;
  // Default: on whenever the owner has RSS switched on at all.
  return env.rssFeeds.length > 0;
}

/**
 * The complete feed list for this deployment: owner env feeds first (their
 * order is preserved for health views), then curated feeds not already
 * present. Deduped on a normalized URL.
 */
export function configuredFeeds(): FeedDefinition[] {
  const seen = new Set<string>();
  const out: FeedDefinition[] = [];
  for (const url of env.rssFeeds) {
    const key = normalizeFeedUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, publisher: new URL(url).hostname });
  }
  if (curatedFeedsEnabled()) {
    for (const feed of CURATED_FEEDS) {
      const key = normalizeFeedUrl(feed.url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(feed);
    }
  }
  return out;
}
