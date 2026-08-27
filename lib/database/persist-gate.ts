import type { NewsDataset, StoryCluster } from "@/lib/news/types";
import { newsDayET } from "@/lib/utils/news-day";
import { archiveDataset, readArchivedClusterSlugs } from "./archive";

/**
 * Batched database persistence (cost control, 2026-08-21).
 *
 * The external cron hits /api/cron/news-refresh every 5 minutes, and every
 * run used to write to Neon (dataset persist, snapshot, archive upsert,
 * briefing). Neon's paid Launch plan bills compute per hour awake and the
 * endpoint suspends only after ~5 idle minutes, so 5-minute writes kept it
 * awake 24/7 (~$19/mo floor against the owner's $30/mo cap — see
 * seo/PLAYBOOK.md hard constraints and seo/BACKLOG.md item 0). Batching
 * the writes to a ~25-30 minute cadence lets compute suspend between
 * bursts. News freshness is untouched: the dataset still refreshes every
 * 5 minutes — only the database writes are batched. Reads are already
 * batched by the read-through Data Cache in archive.ts (30-min/6-h TTLs).
 *
 * The persist decision must not cost a database read (a read would wake
 * the very compute this exists to let sleep), so it uses two free signals:
 *
 * - Module state: when this instance last completed a successful archive.
 *   Per-instance, like the cron route's rate-limit window — and the cron's
 *   steady 5-minute beat keeps its instance warm, so in practice this is
 *   the signal that decides.
 * - Wall clock: a cold instance (fresh deploy, recycled function) has no
 *   module state, so it opens the gate only during the first half of each
 *   half hour. Every instance agrees on those windows without any
 *   coordination, and they bound the persist gap across restarts: a
 *   redeploy can never stretch archive latency past the next half-hour
 *   boundary. "Persist immediately when cold" would be simpler, but with a
 *   dead cron every traffic-triggered producer run on a fresh instance
 *   would then write — the windows keep even that failure mode at two
 *   bursts per hour (a burst marks the instance, so the 25-minute clock,
 *   not the window width, is what bounds repeats).
 *
 * The window width depends on WHO is asking (split 2026-08-27):
 *
 * - the authenticated cron route gets HALF the cycle. A narrow window only
 *   opens for a scheduler whose tick phase happens to land inside it: with
 *   ticks every T minutes at an arbitrary phase, a 5-minute window is
 *   guaranteed to be hit only when T <= 5, and the external scheduler's
 *   beat is not ours to depend on. At half the cycle any beat of 15
 *   minutes or less must land in a window — two ticks 15 minutes apart
 *   cannot both sit in the same half. Ticks arrive a few times an hour, so
 *   a wide window costs at most a few extra wake-ups.
 * - the shared-cache producer keeps the narrow one. It is the fallback for
 *   a dead cron, and it runs on whatever traffic happens to miss the cache
 *   — measured 2026-08-27, giving it the wide window turned ~2 bursts an
 *   hour into a write almost every minute of the window (12 distinct write
 *   minutes between 17:30 and 17:43), which keeps Neon compute awake
 *   instead of letting it suspend between bursts. The narrow window is
 *   what bounds that failure mode, exactly as the note above says.
 *
 * This is the second half of the 2026-08-27 fix; the first is in the cron
 * route, which used to skip the gate entirely on ticks that found the
 * dataset fresh. Archive writes stopped for 14 h on 2026-08-26 and 10 h on
 * 2026-08-27 because those two rules combined to open the gate a handful of
 * times a day.
 */

/** A warm instance persists when its last successful burst is this old. */
export const PERSIST_MIN_INTERVAL_MS = 25 * 60_000;
/**
 * Cold-instance window widths, in minutes from each half-hour boundary.
 * Cron: minutes 0-14 and 30-44. Producer: minutes 0-4 and 30-34.
 */
const COLD_WINDOW_MINUTES = { cron: 15, producer: 5 } as const;

/** Who is asking for a burst — the window width differs (see above). */
export type PersistCaller = keyof typeof COLD_WINDOW_MINUTES;
/**
 * The external cron's cadence. Only used to ask "is this the ET day's last
 * tick?" — a slower cron makes the lookahead fire on a later tick, which
 * still writes before midnight whenever a tick lands inside the window.
 */
const CRON_INTERVAL_MS = 5 * 60_000;
/** Leak guard for a cron-burst claim that was never released. */
const CRON_BURST_TTL_MS = 2 * 60_000;

let lastPersistAt = 0;
let cronBurstUntil = 0;

/**
 * Should this run do the database write burst?
 *
 * The ET-midnight check comes first and overrides the cadence: the daily
 * briefing row freezes when the Eastern date rolls over
 * (lib/database/briefing.ts), so the last tick before midnight must write
 * regardless — otherwise the frozen row would miss the day's final ~25
 * minutes of movement that a 5-minute cadence used to capture.
 */
export function shouldPersistNow(
  now: Date = new Date(),
  caller: PersistCaller = "producer",
): boolean {
  const lookahead = new Date(now.getTime() + CRON_INTERVAL_MS);
  if (newsDayET(now) !== newsDayET(lookahead)) return true;
  if (lastPersistAt > 0) {
    return now.getTime() - lastPersistAt >= PERSIST_MIN_INTERVAL_MS;
  }
  return now.getMinutes() % 30 < COLD_WINDOW_MINUTES[caller];
}

/** Record a successful write burst (call when the archive upsert landed). */
export function markPersisted(now: Date = new Date()): void {
  lastPersistAt = now.getTime();
}

/**
 * The cron route claims the burst around forceRefresh() so the shared-cache
 * producer leaves the archive upsert to the route. The route archives AFTER
 * asking findNewClusterIds which ids are new — if the producer archived
 * first (it runs inside forceRefresh, before the route's own DB work),
 * every new story would already look old and the IndexNow ping for it
 * could never fire.
 */
export function claimCronBurst(now: Date = new Date()): void {
  cronBurstUntil = now.getTime() + CRON_BURST_TTL_MS;
}

export function releaseCronBurst(): void {
  cronBurstUntil = 0;
}

export function isCronBurstActive(now: Date = new Date()): boolean {
  return now.getTime() < cronBurstUntil;
}

/**
 * Public-but-not-yet-archived clusters, by id, in insertion order.
 *
 * Batching creates a gap the old archive-every-generation code did not
 * have: a cluster id minted by a mid-window regeneration is advertised in
 * sitemaps immediately, and if it vanishes (merge, re-cluster) before the
 * next burst it would never reach the permanent archive — its URL would
 * 404 forever, the exact loss the URL-survival probe once caught. So every
 * generation that becomes public registers its live clusters here, and the
 * burst carries the ones that have already vanished into the archive
 * alongside the current dataset. Cleared after each successful burst; the
 * cap only matters during a long database outage, where the oldest entries
 * are dropped first.
 */
const REGISTRY_CAP = 500;
const unarchivedPublic = new Map<string, StoryCluster>();

/**
 * Newly archived cluster ids awaiting an IndexNow ping. Normally drained
 * by the same cron burst that stashed them; a producer-side burst (cron
 * outage) stashes here so the ping still happens on the next cron tick.
 */
const PENDING_PING_CAP = 500;
const pendingIndexNowIds = new Set<string>();

/**
 * Slugs a story used to be published under, awaiting an ISR revalidation.
 *
 * A cluster's canonical slug is rebuilt whenever pickLead() re-selects the
 * lead, so headlines flap and story URLs are renamed constantly — measured
 * 2026-08-28: 5 of 178 archived live stories were slugged differently in
 * the live dataset than in the archive at one instant. The OLD URL then
 * 307s to the new one, and that redirect is an ISR entry of its own under
 * the story route's 30-day TTL. Nothing invalidates it: the cron
 * revalidates `/story/<canonical slug>` for live clusters, which is never
 * the retired alias, and the redirect is returned from the live branch of
 * resolveStoryRequest before any tagged read, so revalidateTag misses it
 * too. A redirect can therefore outlive by weeks the slug it points at —
 * and when the headline flaps back, the fresh redirect points at the frozen
 * one and the two form an INFINITE 307 LOOP. That is not hypothetical: one
 * was live on /news-sitemap.xml on 2026-08-26 (seo/BACKLOG.md item 1),
 * where a crawler following the entry reaches no page at all.
 *
 * The burst already reads the archive's stored slug per cluster, so a
 * rename is free to detect: stored slug != current slug means the stored
 * one is now an alias whose cached redirect must be re-rendered.
 */
const PENDING_STALE_SLUG_CAP = 200;
const pendingStaleSlugs = new Set<string>();

/** Record every live cluster of a public generation (mock data never). */
export function registerPublicClusters(dataset: NewsDataset): void {
  if (dataset.dataMode === "mock") return;
  for (const cluster of dataset.clusters) {
    if (cluster.isMock) continue;
    // Re-insert so insertion order tracks most-recently-seen.
    unarchivedPublic.delete(cluster.id);
    unarchivedPublic.set(cluster.id, cluster);
  }
  while (unarchivedPublic.size > REGISTRY_CAP) {
    const oldest = unarchivedPublic.keys().next().value;
    if (oldest === undefined) break;
    unarchivedPublic.delete(oldest);
  }
}

/**
 * The write burst's archive step: upsert the current dataset PLUS any
 * registered clusters that already vanished from it, and stash which ids
 * were genuinely new (asked BEFORE the upsert makes everything look old)
 * for the IndexNow ping. Returns archiveDataset's count — 0 on failure,
 * in which case the registry is kept so the next burst retries the carry.
 */
export async function archivePublicDataset(dataset: NewsDataset): Promise<number> {
  const live = dataset.clusters.filter((c) => !c.isMock);
  const liveIds = live.map((c) => c.id);
  // One read answers both questions: which ids are new (for the IndexNow
  // ping) and which ones have been re-slugged (for the stale-redirect
  // revalidation). null = the archive did not answer; assume neither.
  const archivedSlugs =
    dataset.dataMode === "mock" ? null : await readArchivedClusterSlugs(liveIds);
  const newIds = archivedSlugs
    ? liveIds.filter((id) => !archivedSlugs.has(id))
    : [];
  const renamed = archivedSlugs
    ? live.filter((c) => {
        const stored = archivedSlugs.get(c.id);
        return stored !== undefined && stored !== c.slug;
      })
    : [];
  const currentIds = new Set(liveIds);
  const carryover = [...unarchivedPublic.values()].filter(
    (c) => !currentIds.has(c.id),
  );
  const archived = await archiveDataset(dataset, carryover);
  if (archived > 0) {
    // Everything registered so far was in this upsert (current ∪ carry).
    unarchivedPublic.clear();
    for (const id of newIds) pendingIndexNowIds.add(id);
    while (pendingIndexNowIds.size > PENDING_PING_CAP) {
      const oldest = pendingIndexNowIds.values().next().value;
      if (oldest === undefined) break;
      pendingIndexNowIds.delete(oldest);
    }
    // The upsert has just replaced the stored slug, so this is the last
    // moment the old one is knowable.
    for (const cluster of renamed) {
      const stored = archivedSlugs?.get(cluster.id);
      if (stored) pendingStaleSlugs.add(stored);
    }
    while (pendingStaleSlugs.size > PENDING_STALE_SLUG_CAP) {
      const oldest = pendingStaleSlugs.values().next().value;
      if (oldest === undefined) break;
      pendingStaleSlugs.delete(oldest);
    }
  }
  return archived;
}

/** Take (and clear) the cluster ids awaiting an IndexNow ping. */
export function drainPendingIndexNowIds(): string[] {
  const ids = [...pendingIndexNowIds];
  pendingIndexNowIds.clear();
  return ids;
}

/**
 * Take (and clear) the retired slugs whose cached redirect needs
 * re-rendering. The caller revalidates `/story/<slug>` for each — see the
 * registry comment above for why nothing else does.
 */
export function drainStaleSlugs(): string[] {
  const slugs = [...pendingStaleSlugs];
  pendingStaleSlugs.clear();
  return slugs;
}

/** Module state must be resettable between test cases. */
export function resetPersistGateForTests(): void {
  lastPersistAt = 0;
  cronBurstUntil = 0;
  unarchivedPublic.clear();
  pendingIndexNowIds.clear();
  pendingStaleSlugs.clear();
}
