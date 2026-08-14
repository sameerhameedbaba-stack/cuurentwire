import type { CategoryId } from "@/config/categories";
import type { SourceTier } from "@/config/sources";

/** Geographic relevance classification. */
export type Country = "US" | "CA" | "US_CA" | "GLOBAL_NA" | "GLOBAL";

/**
 * Editorial content type, detected deterministically at normalization
 * (lib/news/classification/content-type.ts). Conservative: anything not
 * clearly opinion/analysis/press-release/live-blog stays "news".
 */
export type ContentType = "news" | "opinion" | "analysis" | "press_release" | "live";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  news: "News",
  opinion: "Opinion",
  analysis: "Analysis",
  press_release: "Press release",
  live: "Live",
};

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
  /**
   * True when providerCategory is an inferred feed-section prior (RSS
   * domain → section) rather than an explicit publisher category.
   */
  providerCategoryIsPrior?: boolean;
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
  /** Editorial content type (news unless clearly something else). */
  contentType?: ContentType;
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
  /**
   * Cluster-level content type: press_release only when EVERY member is a
   * press release (one real news report means genuine coverage); otherwise
   * the lead article's content type.
   */
  contentType?: ContentType;
  /**
   * Category-hysteresis state (internal, see cluster.ts): a fresh majority
   * vote that disagreed with the carried-over category while membership was
   * unchanged, and how many consecutive generations it has persisted. Flows
   * through the DB snapshot jsonb so the streak survives cold starts on any
   * instance. Absent whenever vote and category agree.
   */
  categoryStreak?: { candidate: CategoryId; count: number };
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
  /**
   * Coverage age at ingest (pipeline run time minus article publishedAt),
   * across accepted articles. Measures how old our coverage is when we
   * pick it up — not how fast publishers report.
   */
  articleAgeAtIngestMedianMs: number;
  articleAgeAtIngestP90Ms: number;
  /** Top cluster's ranking score (0–100); 0 when there are no clusters. */
  highestRankingScore: number;
  /** Clusters carrying the BREAKING label (at most one by design). */
  breakingCount: number;
  /** Clusters with rankingScore >= 75 — near or at breaking intensity. */
  nearBreakingCount: number;
  /**
   * Suspicious classification patterns spotted after classification
   * (espn.com in politics/world, technology with zero content signals,
   * low-confidence specific categories). Diagnostics only — ingestion is
   * never blocked.
   */
  classificationWarnings: number;
  /** First 10 warning descriptions, for the admin status page. */
  classificationWarningSamples: string[];
}

export interface ProviderRunStat {
  provider: string;
  ok: boolean;
  articleCount: number;
  error?: string;
  durationMs: number;
  /** Per-feed health, populated by multi-feed providers (RSS only). */
  feeds?: FeedHealth[];
}

/** Health of a single configured feed during the last provider run. */
export interface FeedHealth {
  url: string;
  ok: boolean;
  itemsParsed: number;
  itemsSkipped: number;
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
  /**
   * Version stamp of this snapshot, e.g. "20260815T101512Z-ab39f2"
   * (generation time + content hash of the cluster ids). Every public route
   * rendering from one snapshot reports the same version — the primary
   * debugging handle for cache-coherence questions.
   */
  datasetVersion: string;
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
