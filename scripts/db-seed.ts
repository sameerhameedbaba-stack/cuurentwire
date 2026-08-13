import { CATEGORIES, CATEGORY_IDS } from "../config/categories";
import { SOURCES } from "../config/sources";
import { getDb } from "../lib/database/client";
import { categories, sources } from "../lib/database/schema";
import { slugify } from "../lib/utils/text";

/** Seed reference tables (sources, categories). Idempotent. */
async function main() {
  const db = getDb();
  if (!db) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  await db
    .insert(sources)
    .values(
      SOURCES.map((s) => ({
        slug: slugify(s.name, 80),
        name: s.name,
        domain: s.domain,
        tier: s.tier,
        country: s.country,
        isDemo: s.demo ?? false,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(categories)
    .values(
      CATEGORY_IDS.map((id) => ({
        id,
        label: CATEGORIES[id].label,
        description: CATEGORIES[id].description,
      })),
    )
    .onConflictDoNothing();

  console.log(`Seeded ${SOURCES.length} sources and ${CATEGORY_IDS.length} categories.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
