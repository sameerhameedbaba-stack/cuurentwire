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

/** Truncate on a word boundary with an ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trimEnd()}…`;
}
