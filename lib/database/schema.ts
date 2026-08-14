import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL schema (Drizzle ORM).
 *
 * The application serves reads from its in-process cache for speed; the
 * database provides durable history — ingestion runs, ranking snapshots and
 * the article/cluster archive — written by the scheduled refresh endpoint
 * when DATABASE_URL is configured. The app runs fully without a database.
 */

export const sources = pgTable(
  "sources",
  {
    slug: varchar("slug", { length: 80 }).primaryKey(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    tier: varchar("tier", { length: 1 }).notNull(),
    country: varchar("country", { length: 8 }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sources_domain_idx").on(table.domain)],
);

export const categories = pgTable("categories", {
  id: varchar("id", { length: 40 }).primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
});

export const articles = pgTable(
  "articles",
  {
    id: varchar("id", { length: 16 }).primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull().unique(),
    source: text("source").notNull(),
    sourceSlug: varchar("source_slug", { length: 80 }).notNull(),
    sourceDomain: text("source_domain").notNull(),
    sourceTier: varchar("source_tier", { length: 1 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    imageUrl: text("image_url"),
    author: text("author"),
    country: varchar("country", { length: 12 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    categoriesAll: jsonb("categories_all").$type<string[]>().notNull().default([]),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    provider: varchar("provider", { length: 40 }).notNull(),
    isMock: boolean("is_mock").notNull().default(false),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("articles_published_idx").on(table.publishedAt),
    index("articles_category_idx").on(table.category, table.publishedAt),
    index("articles_country_idx").on(table.country, table.publishedAt),
    index("articles_source_idx").on(table.sourceSlug, table.publishedAt),
  ],
);

export const storyClusters = pgTable(
  "story_clusters",
  {
    id: varchar("id", { length: 20 }).primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    category: varchar("category", { length: 40 }).notNull(),
    country: varchar("country", { length: 12 }).notNull(),
    imageUrl: text("image_url"),
    leadArticleId: varchar("lead_article_id", { length: 16 }).notNull(),
    sourceCount: integer("source_count").notNull(),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }).notNull(),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }).notNull(),
    rankingScore: real("ranking_score").notNull(),
    rankingBreakdown: jsonb("ranking_breakdown")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    status: varchar("status", { length: 16 }),
    isBreaking: boolean("is_breaking").notNull().default(false),
    isMock: boolean("is_mock").notNull().default(false),
    updatedAtRow: timestamp("updated_at_row", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("clusters_score_idx").on(table.rankingScore),
    index("clusters_category_idx").on(table.category, table.rankingScore),
    index("clusters_last_published_idx").on(table.lastPublishedAt),
  ],
);

export const articleClusterMembers = pgTable(
  "article_cluster_members",
  {
    clusterId: varchar("cluster_id", { length: 20 }).notNull(),
    articleId: varchar("article_id", { length: 16 }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.clusterId, table.articleId] }),
    index("members_article_idx").on(table.articleId),
  ],
);

/**
 * One row in the `sources` jsonb array of story_archive: enough to rebuild
 * the coverage list of an archived story without the articles table.
 */
export interface ArchivedSourceRef {
  name: string;
  domain: string;
  tier: string;
  url: string;
  publishedAt: string;
  title: string;
}

/**
 * Permanent story archive. The live 72h dataset rotates stories out, but
 * published /story/ URLs must keep resolving for crawlers — this table is
 * the durable fallback the story page reads when the live dataset misses.
 * first_seen_at is when WE first archived the story (CurrentWire's real
 * publication time) and is written once, never overwritten.
 */
export const storyArchive = pgTable(
  "story_archive",
  {
    clusterId: varchar("cluster_id", { length: 20 }).primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    category: varchar("category", { length: 40 }).notNull(),
    geography: varchar("geography", { length: 12 }).notNull(),
    contentType: varchar("content_type", { length: 20 }),
    imageUrl: text("image_url"),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }).notNull(),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }).notNull().defaultNow(),
    rankingScore: real("ranking_score").notNull(),
    sourceCount: integer("source_count").notNull(),
    sources: jsonb("sources").$type<ArchivedSourceRef[]>().notNull().default([]),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    /**
     * Set when this story's cluster merged into another cluster: requests
     * for this URL 308-redirect to the survivor. Always flattened to the
     * FINAL destination (never a chain), and cleared again if the id
     * returns to the live dataset.
     */
    mergedIntoClusterId: varchar("merged_into_cluster_id", { length: 20 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("story_archive_slug_idx").on(table.slug),
    index("story_archive_last_published_idx").on(table.lastPublishedAt),
    index("story_archive_merged_into_idx").on(table.mergedIntoClusterId),
  ],
);

/**
 * Last complete valid dataset snapshot — a single row (id = 1) holding the
 * full processed NewsDataset as JSON. Two jobs:
 *  1. Coherence fallback: when the shared cache misses and an instance has
 *     no in-process copy, routes serve THIS snapshot instead of running a
 *     fresh pipeline per request (which would create a divergent reality).
 *  2. Cluster-id continuity across instances: the pipeline seeds its
 *     previous-run registry from here, so cold serverless instances keep
 *     story URLs stable instead of re-deriving cluster ids from scratch.
 */
export const datasetSnapshots = pgTable("dataset_snapshots", {
  id: integer("id").primaryKey(),
  datasetVersion: varchar("dataset_version", { length: 64 }).notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  articleCount: integer("article_count").notNull(),
  clusterCount: integer("cluster_count").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    dataMode: varchar("data_mode", { length: 8 }).notNull(),
    articlesReceived: integer("articles_received").notNull(),
    articlesAccepted: integer("articles_accepted").notNull(),
    articlesRejected: integer("articles_rejected").notNull(),
    duplicatesRemoved: integer("duplicates_removed").notNull(),
    clusterCount: integer("cluster_count").notNull(),
    providerStats: jsonb("provider_stats").$type<unknown[]>().notNull().default([]),
  },
  (table) => [index("ingestion_runs_started_idx").on(table.startedAt)],
);

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    clusterId: varchar("cluster_id", { length: 20 }).notNull(),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull().default({}),
  },
  (table) => [
    index("snapshots_captured_idx").on(table.capturedAt),
    index("snapshots_cluster_idx").on(table.clusterId, table.capturedAt),
  ],
);
