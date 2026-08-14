import type { ArchivedStory } from "@/lib/database/archive";
import type { StoryCluster } from "@/lib/news/types";

/**
 * Story URL resolution order (used by app/story/[slug]/page.tsx and its
 * generateMetadata):
 *
 *   1. live dataset (current behavior, including id-token aliases);
 *   2. merge pointer in the archive — a story whose cluster merged into
 *      another 308-redirects to the survivor (merge → redirect, NEVER
 *      deletion, never a chain: pointers are flattened at write time);
 *   3. story archive in Postgres, when configured;
 *   4. 404 only when none of the above knows the URL.
 *
 * A hit under a non-canonical slug becomes a redirect to the canonical one.
 * Pure orchestration over injected lookups so the fallback logic is
 * unit-testable without a database.
 */

export type StoryResolution =
  | { kind: "live"; cluster: StoryCluster }
  | { kind: "archived"; story: ArchivedStory }
  /** Canonical-slug normalization — temporary (307). */
  | { kind: "redirect"; slug: string }
  /** Cluster merge — permanent (308) to the surviving story. */
  | { kind: "merged"; slug: string }
  | { kind: "not-found" };

export interface StoryLookups {
  getLive: (slugOrId: string) => Promise<StoryCluster | null>;
  getArchived: (slugOrId: string) => Promise<ArchivedStory | null>;
}

export async function resolveStoryRequest(
  slug: string,
  lookups: StoryLookups,
): Promise<StoryResolution> {
  const live = await lookups.getLive(slug);
  if (live) {
    // Old or shortened links resolve by stable id — send them to the
    // canonical URL. Temporary (307): cluster titles change, a 308 would
    // strand crawlers on retired slug aliases.
    if (live.slug !== slug) return { kind: "redirect", slug: live.slug };
    return { kind: "live", cluster: live };
  }

  const archived = await lookups.getArchived(slug);
  if (!archived) return { kind: "not-found" };

  if (archived.mergedIntoClusterId) {
    // The survivor may be live (usual case) or itself archived.
    const liveTarget = await lookups.getLive(archived.mergedIntoClusterId);
    if (liveTarget) return { kind: "merged", slug: liveTarget.slug };
    const archivedTarget = await lookups.getArchived(archived.mergedIntoClusterId);
    if (
      archivedTarget &&
      archivedTarget.slug !== slug &&
      // Pointers are flattened at write time; a target that itself carries
      // a pointer would mean a chain — render the archived copy instead of
      // risking a redirect loop.
      !archivedTarget.mergedIntoClusterId
    ) {
      return { kind: "merged", slug: archivedTarget.slug };
    }
    // Broken/unknown pointer: keep the URL working with the archived copy.
  }

  if (archived.slug !== slug) return { kind: "redirect", slug: archived.slug };
  return { kind: "archived", story: archived };
}
