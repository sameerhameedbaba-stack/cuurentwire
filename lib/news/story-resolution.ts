import type { ArchivedStory } from "@/lib/database/archive";
import type { StoryCluster } from "@/lib/news/types";

/**
 * Story URL resolution order (used by app/story/[slug]/page.tsx and its
 * generateMetadata):
 *
 *   1. live dataset (current behavior, including id-token aliases);
 *   2. story archive in Postgres, when configured;
 *   3. 404 only when neither knows the URL.
 *
 * A hit under a non-canonical slug becomes a redirect to the canonical one.
 * Pure orchestration over injected lookups so the fallback logic is
 * unit-testable without a database.
 */

export type StoryResolution =
  | { kind: "live"; cluster: StoryCluster }
  | { kind: "archived"; story: ArchivedStory }
  | { kind: "redirect"; slug: string }
  | { kind: "not-found" };

export interface StoryLookups {
  getLive: (slug: string) => Promise<StoryCluster | null>;
  getArchived: (slug: string) => Promise<ArchivedStory | null>;
}

export async function resolveStoryRequest(
  slug: string,
  lookups: StoryLookups,
): Promise<StoryResolution> {
  const live = await lookups.getLive(slug);
  if (live) {
    // Old or shortened links resolve by stable id — send them to the
    // canonical URL. Temporary (307): cluster URLs are ephemeral, a 308
    // would strand crawlers on retired aliases.
    if (live.slug !== slug) return { kind: "redirect", slug: live.slug };
    return { kind: "live", cluster: live };
  }
  const archived = await lookups.getArchived(slug);
  if (!archived) return { kind: "not-found" };
  if (archived.slug !== slug) return { kind: "redirect", slug: archived.slug };
  return { kind: "archived", story: archived };
}
