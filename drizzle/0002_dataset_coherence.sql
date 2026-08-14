-- Dataset coherence + URL permanence (audit 3).
-- Applied to Neon via the Vercel dashboard Query editor (wrapped in a DO
-- block there because the editor rejects multi-command prepared statements).

CREATE TABLE IF NOT EXISTS "dataset_snapshots" (
  "id" integer PRIMARY KEY,
  "dataset_version" varchar(64) NOT NULL,
  "generated_at" timestamp with time zone NOT NULL,
  "article_count" integer NOT NULL,
  "cluster_count" integer NOT NULL,
  "data" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "story_archive"
  ADD COLUMN IF NOT EXISTS "merged_into_cluster_id" varchar(20);

CREATE INDEX IF NOT EXISTS "story_archive_merged_into_idx"
  ON "story_archive" ("merged_into_cluster_id");
