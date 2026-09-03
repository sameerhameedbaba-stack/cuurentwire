/**
 * Pure helpers for the Bluesky auto-poster (scripts/bluesky-post.mjs).
 *
 * Kept free of I/O so the dedup rule is unit-testable; the script does the
 * fetching.
 */

/**
 * The cluster-id suffix every published story slug carries, mirrored from
 * CLUSTER_ID_RE in lib/database/archive.ts. tests/unit/bluesky-post-lib.test.ts
 * parses that file and fails if the two ever drift — this script runs under
 * plain node in CI and cannot import the TypeScript module.
 */
export const CLUSTER_ID_RE = /^c[0-9a-f]{12}$/;

/**
 * The key a story URL is deduped by: its cluster id, not the URL string.
 *
 * THE BUG THIS FIXES (found 2026-09-04). Dedup is stateless — the poster reads
 * its own recent feed and skips any story whose link it has already shared —
 * and it compared full URLs. But a story's slug is derived from its headline,
 * and the headline is rewritten as coverage develops, so the same story
 * reappears in /rss under a new URL and reads as new. Measured on the live
 * account: "Gloria Steinem, trailblazing journalist and activist, dies at 92"
 * posted 2026-09-03 11:27 UTC and "Feminist icon Gloria Steinem dies at 92"
 * posted 16:33 UTC are ONE story — both URLs end `-c6f6dcadc62b0` — posted
 * twice, five hours apart, to the same followers.
 *
 * Keying on the id token is the same fix `archiveRowCacheKey` made for the
 * archive row cache on 2026-09-01, and rests on the same verified property:
 * every published story slug ends with its own cluster id, so the token IS the
 * story's identity. A URL carrying no well-formed token was never one of our
 * story URLs (a section page, an external link), so it keeps its normalised
 * URL as its key and the previous behaviour.
 */
export function dedupKey(url) {
  const normalised = String(url ?? "").replace(/\/$/, "");
  const token = normalised.slice(normalised.lastIndexOf("-") + 1).toLowerCase();
  return CLUSTER_ID_RE.test(token) ? token : normalised;
}
