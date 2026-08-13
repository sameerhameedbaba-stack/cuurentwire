import type { CategoryId } from "@/config/categories";
import type { SourceTier } from "@/config/sources";

/** Geographic relevance classification. */
export type Country = "US" | "CA" | "US_CA" | "GLOBAL_NA" | "GLOBAL";

export const COUNTRY_LABELS: Record<Country, string> = {
  US: "United States",
  CA: "Canada",
  US_CA: "US & Canada",
  GLOBAL_NA: "Global · North America",
  GLOBAL: "International",
};

/** Raw article as returned by a provider adapter, before normalization. */
export interface RawArticle {
  title: string;
  description?: string;
  url: string;
  source: string;
  sourceDomain?: string;
  publishedAt: string;
  updatedAt?: string;
  imageUrl?: string;
  author?: string;
  providerCategory?: string;
  providerCountry?: string;
  provider: string;
  isMock?: boolean;
}

/** Normalized, validated, classified article. */
export interface Article {
  /** Stable hash of the canonical URL. */
  id: string;
  slug: string;
  title: string;
  description?: string;
  url: string;
  canonicalUrl: string;
  source: string;
  sourceSlug: string;
  sourceDomain: string;
  sourceTier: SourceTier;
  /** ISO 8601 UTC. */
  publishedAt: string;
  updatedAt?: string;
  imageUrl?: string;
  author?: string;
  country: Country;
  category: CategoryId;
  categories: CategoryId[];
  entities: string[];
  provider: string;
  clusterId?: string;
  isMock: boolean;
}

export interface RankingBreakdown {
  /** 0–35 */
  freshness: number;
  /** 0–20 */
  authority: number;
  /** 0–20 */
  coverage: number;
  /** 0–10 */
  geography: number;
  /** 0–10 */
  prominence: number;
  /** 0–5 */
  velocity: number;
  /** 0–100 */
  total: number;
}

export type ClusterStatus = "live" | "developing" | "updated" | null;

/** A canonical story: one or more articles covering the same event. */
export interface StoryCluster {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  category: CategoryId;
  country: Country;
  imageUrl?: string;
  /** Members, best source tier first, then newest. */
  articles: Article[];
  /** The representative article (best tier, most complete). */
  lead: Article;
  sourceCount: number;
  sourceNames: string[];
  entities: string[];
  firstPublishedAt: string;
  lastPublishedAt: string;
  rankingScore: number;
  rankingBreakdown: RankingBreakdown;
  status: ClusterStatus;
  isBreaking: boolean;
  isMock: boolean;
}

export interface TrendingTopic {
  topic: string;
  slug: string;
  articleCount: number;
  clusterCount: number;
  score: number;
}

export interface IngestionStats {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  providers: ProviderRunStat[];
  articlesReceived: number;
  articlesAccepted: number;
  articlesRejected: number;
  duplicatesRemoved: number;
  clusterCount: number;
}

export interface ProviderRunStat {
  provider: string;
  ok: boolean;
  articleCount: number;
  error?: string;
  durationMs: number;
}

export type DataMode = "mock" | "live";

/** Full processed dataset served to the frontend. */
export interface NewsDataset {
  articles: Article[];
  /** All clusters, ranked by score descending. */
  clusters: StoryCluster[];
  trending: TrendingTopic[];
  generatedAt: string;
  dataMode: DataMode;
  ingestion: IngestionStats;
}

export interface FetchParams {
  /** Max articles the provider should return. */
  limit?: number;
  /** Restrict to a country where the provider supports it. */
  country?: "us" | "ca";
  category?: string;
}

export interface NewsProvider {
  name: string;
  /** Whether the provider has the configuration it needs (API key etc.). */
  isConfigured(): boolean;
  fetchLatest(params?: FetchParams): Promise<RawArticle[]>;
}
