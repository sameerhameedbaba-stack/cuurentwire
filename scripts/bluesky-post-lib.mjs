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

/**
 * The normalised form of a post's headline, used as a SECOND dedup key
 * alongside dedupKey.
 *
 * THE BUG THIS FIXES (measured on the live account 2026-09-07). Keying on the
 * cluster id closed the headline-rewrite duplicate, but it assumed one story is
 * one cluster. It is not: on 2026-09-05 the archive opened `cfd84c3e6f25d`
 * at 14:25:06Z and `ceee985710f14` at 14:30:18Z for the SAME event, five
 * minutes apart, and the poster shared both — at 15:21Z and 17:25Z, with
 * byte-identical text, "US hits three Iranian oil tankers after saying its
 * warships were targeted". The archive itself agreed later: `cfd84c3e6f25d` is
 * now `merged: true` and 308s to the other's canonical slug. Two distinct
 * cluster ids at post time, so dedupKey could not see it.
 *
 * The headline the poster is about to publish is a signal it already holds, and
 * two of our own stories carrying the identical headline are the same event.
 * A false skip costs nothing worse than posting the next story instead.
 */
export function headlineKey(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/…$/, "")
    .trim();
}

/**
 * True when `title` is already represented in `postedTexts` (the text of the
 * account's own recent posts).
 *
 * A stored post may have been truncated to the 280-grapheme post limit, in
 * which case it ends in an ellipsis and is a PREFIX of the full headline — so
 * a truncated entry matches by prefix and a whole one matches exactly. Anything
 * looser would let one long headline swallow unrelated stories.
 */
export function headlineAlreadyPosted(postedTexts, title) {
  const key = headlineKey(title);
  if (!key) return false;
  return (postedTexts ?? []).some((posted) => {
    const stored = headlineKey(posted);
    if (!stored) return false;
    return String(posted).trimEnd().endsWith("…") ? key.startsWith(stored) : key === stored;
  });
}
