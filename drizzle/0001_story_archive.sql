CREATE TABLE "story_archive" (
	"cluster_id" varchar(20) PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"category" varchar(40) NOT NULL,
	"geography" varchar(12) NOT NULL,
	"content_type" varchar(20),
	"image_url" text,
	"first_published_at" timestamp with time zone NOT NULL,
	"last_published_at" timestamp with time zone NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_score" real NOT NULL,
	"source_count" integer NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "story_archive_slug_idx" ON "story_archive" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "story_archive_last_published_idx" ON "story_archive" USING btree ("last_published_at");
