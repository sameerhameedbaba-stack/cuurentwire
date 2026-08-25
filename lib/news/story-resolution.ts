import lostStories from "@/data/lost-stories.json";
import {
  ArchiveUnavailableError,
  idTokenFromSlug,
  looksLikePublishedStorySlug,
  type ArchivedStory,
} from "@/lib/database/archive";
import { cleanDescription } from "@/lib/news/normalization/boilerplate";
import type { StoryCluster } from "@/lib/news/types";

/**
 * Tombstones: cluster ids whose stories are PERMANENTLY gone — published
 * during the 2026-08-19..21 Neon egress outage, when archive writes were
 * failing, so their rows never existed and never will. The unavailable
 * shield below is scoped to the batched-write window (~30 minutes); without
 * this list it would answer a retriable 500 for these URLs forever, which
 * measurably poisoned crawl health after the outage (impressions -77%
 * on 2026-08-20, avg position 21 → 70+, data/gsc-daily.json). A tombstoned
 * id is an honest 404 in EVERY archive state, including outages. Future
 * data-loss events append here (provenance inside the file).
 */
const LOST_STORY_IDS = new Set<string>(lostStories.ids);

export function isLostStorySlug(slug: string): boolean {
  return LOST_STORY_IDS.has(idTokenFromSlug(slug));
}

/**
 * Story URL resolution order (used by app/story/[slug]/page.tsx and its
 * generateMetadata):
 *
 *   1. live dataset (current behavior, including id-token aliases);
 *   2. merge pointer in the archive — a story whose cluster merged into
 *      another 308-redirects to the survivor (merge → redirect, NEVER
 *      deletion, never a chain: pointers are flattened at write time);
 *   3. story archive in Postgres, when configured;
 *   4. 404 only for a slug that carries no well-formed cluster-id token —
 *      i.e. one we could never have published. A published-LOOKING slug that
 *      nothing knows yields "unavailable" (a retriable 5xx) instead, whether
 *      the archive failed or answered "no such story": since database writes
 *      are batched (lib/database/persist-gate.ts), "the archive has not heard
 *      of it" no longer means "it was never published". See the note at the
 *      not-found branch below for the production measurement behind this.
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
  /**
   * Is a permanent archive attached to this deployment? Only a deployment
   * that HAS one can be in the "published but not yet written" window that
   * the not-found branch below refuses to 404. A deployment without a
   * database never promised permanence, so an unknown slug there is simply
   * unknown — it keeps answering 404, which also keeps the status code a
   * diagnosis (500/503 = configured and failing). Defaults to true so
   * existing callers and tests describe the deployed shape.
   */
  hasArchive?: () => boolean;
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

  // Known-lost ids answer 404 before any shield: absence is not unknown
  // here, it is certain (see LOST_STORY_IDS above).
  if (isLostStorySlug(slug)) return { kind: "not-found" };

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
  if (!archived) {
    // The archive ANSWERED "no such story" — and until 2026-08-21 that was
    // conclusive, because every 5-minute refresh wrote the dataset straight
    // through to Postgres, so a published cluster was archived within one
    // cycle. Batching the writes to a ~25-30 minute cadence for Neon compute
    // cost (lib/database/persist-gate.ts) broke that premise: there is now a
    // window up to half an hour wide in which a cluster is live, already
    // advertised in /news-sitemap.xml, and genuinely absent from the archive.
    //
    // Measured on production 2026-08-22, before this guard: 2 of the 40
    // newest news-sitemap entries answered 404, served from the CDN with a
    // rising `age`, while `/story/<id-token>` for the SAME clusters answered
    // 307 pointing at the very slug that was 404ing. The clusters were live;
    // only the answer was wrong. Both URLs served 200 once the ISR entry
    // expired ~5 minutes later — and Google News fetches a news sitemap
    // within minutes of publication, so that window lands on the one crawl
    // that decides whether a story enters Google News at all.
    //
    // A 404 is the one answer that cannot be taken back: it is cached for
    // the full ISR window and it tells a crawler the URL is gone. "Unknown"
    // is the honest state, so we answer the retriable 5xx that already
    // exists for it. Errors are not stored by ISR, so a URL that resolves on
    // the next request stops being wrong on the next request.
    //
    // Junk paths are unaffected: this needs a well-formed cluster-id token
    // (`c` + 12 hex), which nothing but our own published URLs carries. And
    // a deployment with no archive at all is unaffected too — it was never
    // in the batched-write window and never promised permanence, so its
    // unknown slugs keep answering a plain 404 (hasArchive, above).
    const archiveAttached = lookups.hasArchive?.() ?? true;
    return archiveAttached && looksLikePublishedStorySlug(slug)
      ? { kind: "unavailable" }
      : { kind: "not-found" };
  }

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
