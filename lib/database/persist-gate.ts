import type { NewsDataset, StoryCluster } from "@/lib/news/types";
import { newsDayET } from "@/lib/utils/news-day";
import { archiveDataset, findNewClusterIds } from "./archive";

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
 * The window is HALF the cycle, not five minutes (widened 2026-08-27).
 * A narrow window only opens for a scheduler whose tick phase happens to
 * land inside it: with ticks every T minutes at an arbitrary phase, a
 * 5-minute window is guaranteed to be hit only when T <= 5, and the
 * external scheduler's beat is not ours to depend on. At half the cycle
 * any beat of 15 minutes or less is guaranteed to land in a window — two
 * ticks 15 minutes apart cannot both sit in the same half. This is the
 * second half of the 2026-08-27 fix; the first is in the cron route, which
 * used to skip the gate entirely on ticks that found the dataset fresh.
 * Archive writes stopped for 14 h on 2026-08-26 and 10 h on 2026-08-27
 * because those two rules combined to open the gate a few times a day.
 */

/** A warm instance persists when its last successful burst is this old. */
export const PERSIST_MIN_INTERVAL_MS = 25 * 60_000;
/** Cold-instance windows: minutes 0-14 and 30-44 of each hour. */
const COLD_WINDOW_MINUTES = 15;
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
export function shouldPersistNow(now: Date = new Date()): boolean {
  const lookahead = new Date(now.getTime() + CRON_INTERVAL_MS);
  if (newsDayET(now) !== newsDayET(lookahead)) return true;
  if (lastPersistAt > 0) {
    return now.getTime() - lastPersistAt >= PERSIST_MIN_INTERVAL_MS;
  }
  return now.getMinutes() % 30 < COLD_WINDOW_MINUTES;
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
  const liveIds = dataset.clusters.filter((c) => !c.isMock).map((c) => c.id);
  const newIds =
    dataset.dataMode === "mock" ? [] : await findNewClusterIds(liveIds);
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
  }
  return archived;
}

/** Take (and clear) the cluster ids awaiting an IndexNow ping. */
export function drainPendingIndexNowIds(): string[] {
  const ids = [...pendingIndexNowIds];
  pendingIndexNowIds.clear();
  return ids;
}

/** Module state must be resettable between test cases. */
export function resetPersistGateForTests(): void {
  lastPersistAt = 0;
  cronBurstUntil = 0;
  unarchivedPublic.clear();
  pendingIndexNowIds.clear();
}
