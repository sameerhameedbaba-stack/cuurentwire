CREATE TABLE "article_cluster_members" (
	"cluster_id" varchar(20) NOT NULL,
	"article_id" varchar(16) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_cluster_members_cluster_id_article_id_pk" PRIMARY KEY("cluster_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"source" text NOT NULL,
	"source_slug" varchar(80) NOT NULL,
	"source_domain" text NOT NULL,
	"source_tier" varchar(1) NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	"image_url" text,
	"author" text,
	"country" varchar(12) NOT NULL,
	"category" varchar(40) NOT NULL,
	"categories_all" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" varchar(40) NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingestion_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"data_mode" varchar(8) NOT NULL,
	"articles_received" integer NOT NULL,
	"articles_accepted" integer NOT NULL,
	"articles_rejected" integer NOT NULL,
	"duplicates_removed" integer NOT NULL,
	"cluster_count" integer NOT NULL,
	"provider_stats" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ranking_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cluster_id" varchar(20) NOT NULL,
	"rank" integer NOT NULL,
	"score" real NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"tier" varchar(1) NOT NULL,
	"country" varchar(8),
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_clusters" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"category" varchar(40) NOT NULL,
	"country" varchar(12) NOT NULL,
	"image_url" text,
	"lead_article_id" varchar(16) NOT NULL,
	"source_count" integer NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_published_at" timestamp with time zone NOT NULL,
	"last_published_at" timestamp with time zone NOT NULL,
	"ranking_score" real NOT NULL,
	"ranking_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(16),
	"is_breaking" boolean DEFAULT false NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"updated_at_row" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "members_article_idx" ON "article_cluster_members" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category","published_at");--> statement-breakpoint
CREATE INDEX "articles_country_idx" ON "articles" USING btree ("country","published_at");--> statement-breakpoint
CREATE INDEX "articles_source_idx" ON "articles" USING btree ("source_slug","published_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_started_idx" ON "ingestion_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "snapshots_captured_idx" ON "ranking_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "snapshots_cluster_idx" ON "ranking_snapshots" USING btree ("cluster_id","captured_at");--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "clusters_score_idx" ON "story_clusters" USING btree ("ranking_score");--> statement-breakpoint
CREATE INDEX "clusters_category_idx" ON "story_clusters" USING btree ("category","ranking_score");--> statement-breakpoint
CREATE INDEX "clusters_last_published_idx" ON "story_clusters" USING btree ("last_published_at");