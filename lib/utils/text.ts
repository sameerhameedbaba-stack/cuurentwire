import { createHash } from "node:crypto";

/** Small deterministic text utilities shared across the news pipeline. */

/**
 * sha256-based stable id, first 12 hex chars — used for article and cluster
 * ids. 48 bits keeps the collision birthday bound far beyond dataset sizes
 * (the previous 32-bit FNV-1a bound was ~77k inputs).
 */
export function stableId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

/** FNV-1a 32-bit hash rendered as 8-char hex. Kept for non-id hashing needs. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "story";
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "by", "from", "as", "is", "are", "was", "were", "be", "been", "it",
  "its", "this", "that", "these", "those", "into", "over", "after", "before",
  "amid", "amidst", "up", "down", "out", "about", "than", "then", "will",
  "would", "could", "should", "has", "have", "had", "not", "no", "new", "says",
  "say", "said", "how", "what", "why", "when", "who", "more", "amid", "his",
  "her", "their", "our", "your", "may", "can", "us",
]);

/** Lower-cased significant tokens with stopwords removed. */
export function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jaccard similarity of two token sets. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Consecutive-token bigrams, used to catch reordered-word headlines. */
export function bigrams(tokens: string[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    result.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}

/**
 * Meta description: whole sentences wherever possible.
 *
 * A word-boundary truncation ends in "…" mid-thought, which reads as broken
 * copy in a SERP snippet. This keeps adding complete sentences while they fit
 * and only falls back to `truncate` when even the first sentence is too long
 * to show. Trailing separators left by a clipped sentence (", ", " - ", ": ")
 * are cleaned off so the snippet never ends on a dangling connector.
 */
export function metaDescription(text: string, maxLength = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;

  // Sentence ends: . ! ? optionally followed by a closing quote/bracket, then
  // whitespace.
  //
  // The comment here used to claim "common abbreviations keep their following
  // token, so a split there simply yields a longer sentence — never a wrong
  // cut". That was false: there is no abbreviation handling at all, and a
  // LEADING abbreviation breaks the pattern outright. `[^.!?]+` cannot include
  // the '.' in "U.S.", so no match can begin at index 0; the engine advances
  // and the first successful match starts mid-token, yielding "S. ". The loop
  // accepts it (2 <= 155) and stops on the long remainder.
  //
  // Measured live on indexed story pages 2026-09-04: descriptions of "S."
  // (2 chars), ", Sept." (7), "Some Jan." (9), plus 13- and 15-char cases in a
  // 40-page sample — on the site's only click-earning surface. No unit test
  // covered a leading abbreviation, which is why CI never saw it.
  //
  // Rather than teach the regex an abbreviation list (a large, locale-shaped
  // guess), the two invariants a real sentence split must satisfy are asserted
  // and anything else falls through to the ellipsis truncation below, which is
  // always safe and always starts at the beginning of the text.
  const sentences = clean.match(/[^.!?]+(?:[.!?]+["')\]]*\s+|[.!?]+$)/g);
  if (sentences) {
    let out = "";
    for (const sentence of sentences) {
      const next = (out + sentence).trimEnd();
      if (next.length > maxLength) break;
      out = next + " ";
    }
    const kept = out.trim();
    // 1. It must start where the text starts. A result that is not a prefix
    //    means the split silently dropped leading words ("S." from "U.S.").
    // 2. It must be substantive. A 4-character "Rep." IS a prefix and still
    //    makes a useless snippet. The floor tracks maxLength so a deliberately
    //    tiny budget still gets its one short sentence.
    const floor = Math.min(25, Math.floor(maxLength * 0.8));
    if (kept && kept.length >= floor && clean.startsWith(kept)) return kept;
  }
  return truncate(clean, maxLength).replace(/[\s,;:\-–—]+…$/, "…");
}

/** Truncate on a word boundary with an ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trimEnd()}…`;
}
