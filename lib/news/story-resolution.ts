import {
  ArchiveUnavailableError,
  looksLikePublishedStorySlug,
  type ArchivedStory,
} from "@/lib/database/archive";
import { cleanDescription } from "@/lib/news/normalization/boilerplate";
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
 *   4. 404 only when none of the above knows the URL — and only when the
 *      archive actually answered. An archive that is configured but
 *      unreachable yields "unavailable" (a retriable 5xx), never 404.
 *
 * A hit under a non-canonical slug becomes a redirect to the canonical one.
 * Pure orchestration over injected lookups so the fallback logic is
 * unit-testable without a database.
 */

/**
 * Display-time guard: summaries archived before a boilerplate-cleaner fix
 * keep their dirty text forever (the archive upsert only self-heals stories
 * still in feeds). cleanDescription is idempotent, so re-applying on the way
 * out is safe. The archive does not record WHICH member wrote the summary,
 * so every member domain's publisher rules are applied. Never throws —
 * worst case the stored summary renders as-is.
 */
function withCleanSummary(story: ArchivedStory): ArchivedStory {
  if (!story.summary) return story;
  try {
    let cleaned = cleanDescription(story.summary);
    for (const source of story.sources) {
      cleaned = cleanDescription(cleaned, source.domain);
    }
    if (cleaned === story.summary) return story;
    return { ...story, summary: cleaned || null };
  } catch {
    return story;
  }
}

export type StoryResolution =
  | { kind: "live"; cluster: StoryCluster }
  | { kind: "archived"; story: ArchivedStory }
  /** Canonical-slug normalization — temporary (307). */
  | { kind: "redirect"; slug: string }
  /** Cluster merge — permanent (308) to the surviving story. */
  | { kind: "merged"; slug: string }
  | { kind: "not-found" }
  /**
   * The archive could not be consulted, and the slug looks like one we
   * published. The caller must answer a RETRIABLE 5xx — never 404.
   */
  | { kind: "unavailable" };

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

  let archived: ArchivedStory | null;
  try {
    archived = await lookups.getArchived(slug);
  } catch (error) {
    if (!(error instanceof ArchiveUnavailableError)) throw error;
    // The live dataset holds ~72h; everything older lives only in the
    // archive. With the archive down we cannot tell "retired story" from
    // "never existed", so we refuse to answer 404 for anything that
    // carries a real cluster-id token. Junk paths still 404, because
    // those were never story URLs whatever the database says.
    return looksLikePublishedStorySlug(slug)
      ? { kind: "unavailable" }
      : { kind: "not-found" };
  }
  if (!archived) return { kind: "not-found" };

  if (archived.mergedIntoClusterId) {
    // The survivor may be live (usual case) or itself archived.
    const liveTarget = await lookups.getLive(archived.mergedIntoClusterId);
    if (liveTarget) return { kind: "merged", slug: liveTarget.slug };
    // A failure resolving the merge target must not strand the request:
    // the archived copy we already hold keeps the URL answering 200.
    const archivedTarget = await lookups
      .getArchived(archived.mergedIntoClusterId)
      .catch((error: unknown) => {
        if (error instanceof ArchiveUnavailableError) return null;
        throw error;
      });
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
  return { kind: "archived", story: withCleanSummary(archived) };
}
