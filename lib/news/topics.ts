import {
  CURATED_ENTITY_NAMES,
  canonicalizeEntity,
} from "@/lib/news/classification/entities";
import type { StoryCluster } from "@/lib/news/types";
import { slugify } from "@/lib/utils/text";

/**
 * Topic identity for /topic/<slug>.
 *
 * Two jobs, kept apart on purpose:
 *
 *  1. `topicKey` — a CONTEXT-FREE identity for one entity name. Variants of
 *     the same thing collapse onto one key, so "Big Bend" and "Big Bend
 *     National Park" can never become two hubs again.
 *  2. `buildTopicIndex` — one pass over the live dataset that picks the
 *     canonical DISPLAY (and therefore the canonical URL) per key and counts
 *     how many clusters actually mention it.
 *
 * Nothing here folds by substring. Substring containment is provably wrong
 * on this site: measured live 2026-08-19, /topic/florida lists 24 stories
 * and /topic/florida-house lists 2 (the state vs the legislature chamber),
 * /topic/washington lists 4 and /topic/washington-post 0, /topic/new-york
 * lists 7 and /topic/york 0. Every fold below needs curated evidence.
 *
 * Deliberately NOT changed: `extractEntities`. Article entities are
 * clustering evidence (lib/news/clustering/cluster.ts feeds them into
 * similarity and fingerprints, benchmarked at P>=0.98/R>=0.80 over 491
 * pairs). Topic hygiene is a URL problem, so it is solved at the URL layer.
 */

/**
 * Distinct live clusters a DISCOVERED (non-dictionary) entity must have
 * before it is worth a topic URL. One cluster mentioning "Bay Giants" is a
 * headline fragment until a second, independent story corroborates it.
 * Curated dictionary entities are exempt — they are topics by definition.
 */
export const MIN_CLUSTERS_FOR_TOPIC = 2;

/**
 * Place-type qualifiers: a trailing phrase that names the KIND of thing
 * rather than the thing, so "<X> National Park" and "<X>" are one topic.
 * Longest first — the loop takes the first match.
 *
 * Deliberately excluded, each with a live counterexample: "City" (New York
 * City is not New York), "State" (Ohio State is not Ohio), "House"
 * (/topic/florida-house is the legislature, /topic/florida is the state),
 * "County" (Orange County is not Orange). Add an entry only with a fixture.
 */
const TYPE_SUFFIXES = [
  "national historical park",
  "national historic site",
  "national wildlife refuge",
  "national recreation area",
  "national monument",
  "national seashore",
  "national forest",
  "provincial park",
  "national park",
  "state park",
] as const;

/** Lowercase, de-accented, apostrophe-free, single-spaced form of a name. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Plausible singular/plural siblings of ONE word. */
function pluralVariants(word: string): string[] {
  const variants = new Set<string>();
  variants.add(`${word}s`);
  if (/[^aeiou]y$/.test(word)) variants.add(`${word.slice(0, -1)}ies`);
  if (/(?:s|x|z|ch|sh)$/.test(word)) variants.add(`${word}es`);
  if (word.length > 4 && word.endsWith("ies")) variants.add(`${word.slice(0, -3)}y`);
  if (word.length > 4 && /(?:ses|xes|zes|ches|shes)$/.test(word)) {
    variants.add(word.slice(0, -2));
  }
  if (word.length > 3 && /[^s]s$/.test(word)) variants.add(word.slice(0, -1));
  return [...variants].filter((v) => v !== word && v.length > 2);
}

/**
 * Singular/plural folding is licensed by the curated vocabulary and applies
 * to the WHOLE name, never to a token inside it. "Wildfire" folds onto
 * "Wildfires" because "Wildfires" is in the dictionary; "Giants",
 * "Washington Commanders" and "Toronto Maple Leafs" are proper plurals
 * nobody curated, so they are left exactly as they are. Identities are
 * registered before variants so a curated name can never be shadowed by
 * another name's sibling.
 */
function buildCuratedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const names = CURATED_ENTITY_NAMES.map(normalizeName).filter((n) => n.length > 0);
  for (const name of names) {
    if (!keys.has(name)) keys.set(name, name);
  }
  for (const name of names) {
    const words = name.split(" ");
    const last = words[words.length - 1];
    for (const variant of pluralVariants(last)) {
      const candidate = [...words.slice(0, -1), variant].join(" ");
      if (!keys.has(candidate)) keys.set(candidate, name);
    }
  }
  return keys;
}

const CURATED_KEY_BY_NAME = buildCuratedKeys();
const CURATED_DISPLAY_NAMES = new Set(
  CURATED_ENTITY_NAMES.map((name) => name.toLowerCase()),
);

/**
 * Stable identity of one entity name, in slug form. Alias canonicalization
 * first (so "The Fed" and "Federal Reserve" are one key), then the
 * place-type suffix strip, then the vocabulary-licensed plural fold.
 */
export function topicKey(entity: string): string {
  let normalized = normalizeName(canonicalizeEntity(entity));
  if (!normalized) return "";
  for (const suffix of TYPE_SUFFIXES) {
    if (normalized.endsWith(` ${suffix}`)) {
      normalized = normalized.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return slugify(CURATED_KEY_BY_NAME.get(normalized) ?? normalized, 60);
}

/** Same identity, computed from a requested URL slug. */
export function topicKeyFromSlug(slug: string): string {
  return topicKey(slug.replace(/-/g, " "));
}

export interface TopicEntry {
  /** Identity shared by every variant of this topic. */
  key: string;
  /** Canonical URL slug — the most specific observed name. */
  slug: string;
  /** Canonical display name. */
  display: string;
  /** Distinct live clusters mentioning any variant of this topic. */
  clusterCount: number;
  /** True when a curated dictionary/alias entity produced this topic. */
  curated: boolean;
  /** Every slug that must resolve here, canonical form included. */
  variantSlugs: string[];
}

export interface TopicIndex {
  byKey: ReadonlyMap<string, TopicEntry>;
  bySlug: ReadonlyMap<string, TopicEntry>;
}

/** Token count — "most specific" means "most words", not "longest string". */
function specificity(display: string): number {
  return display.trim().split(/\s+/).length;
}

/**
 * One pass over the ranked clusters. Per key: how many distinct clusters
 * mention it, which display forms were seen and how often, and whether a
 * curated entity produced it. The canonical display is the most specific
 * observed form (most words), ties broken by mention count then
 * lexicographically, so the result is deterministic for a given dataset.
 */
export function buildTopicIndex(clusters: StoryCluster[]): TopicIndex {
  const draft = new Map<
    string,
    { clusterCount: number; curated: boolean; displays: Map<string, number> }
  >();

  for (const cluster of clusters) {
    const seenInCluster = new Set<string>();
    for (const raw of cluster.entities) {
      const display = canonicalizeEntity(raw);
      const key = topicKey(display);
      if (!key) continue;
      let entry = draft.get(key);
      if (!entry) {
        entry = { clusterCount: 0, curated: false, displays: new Map() };
        draft.set(key, entry);
      }
      // Two variants in one cluster are still one story for this topic.
      if (!seenInCluster.has(key)) {
        seenInCluster.add(key);
        entry.clusterCount++;
      }
      entry.displays.set(display, (entry.displays.get(display) ?? 0) + 1);
      if (CURATED_DISPLAY_NAMES.has(display.toLowerCase())) entry.curated = true;
    }
  }

  const byKey = new Map<string, TopicEntry>();
  const bySlug = new Map<string, TopicEntry>();
  for (const [key, value] of draft) {
    const ranked = [...value.displays.entries()].sort(
      (a, b) =>
        specificity(b[0]) - specificity(a[0]) ||
        b[1] - a[1] ||
        a[0].localeCompare(b[0]),
    );
    const display = ranked[0][0];
    const variantSlugs = [
      ...new Set([slugify(display, 60), key, ...ranked.map(([name]) => slugify(name, 60))]),
    ];
    const entry: TopicEntry = {
      key,
      slug: slugify(display, 60),
      display,
      clusterCount: value.clusterCount,
      curated: value.curated,
      variantSlugs,
    };
    byKey.set(key, entry);
    for (const slug of variantSlugs) {
      const existing = bySlug.get(slug);
      // A slug can only be claimed twice by unrelated keys in pathological
      // data; the better-covered topic wins so the mapping stays stable.
      if (!existing || entry.clusterCount > existing.clusterCount) {
        bySlug.set(slug, entry);
      }
    }
  }

  return { byKey, bySlug };
}

/**
 * Memoized per clusters array. `getDataset()` hands out the same object for
 * the whole 5-minute cache window, so generateMetadata and the page body of
 * one request share a single index instead of rebuilding it twice.
 */
const indexCache = new WeakMap<StoryCluster[], TopicIndex>();

export function topicIndexFor(clusters: StoryCluster[]): TopicIndex {
  const cached = indexCache.get(clusters);
  if (cached) return cached;
  const index = buildTopicIndex(clusters);
  indexCache.set(clusters, index);
  return index;
}

/**
 * Resolve a requested /topic/<slug>. Exact variant match first (so a slug
 * that is currently canonical always wins), then identity match — which is
 * what keeps an older, less specific URL alive after the canonical form
 * becomes more specific.
 */
export function resolveTopic(index: TopicIndex, slug: string): TopicEntry | null {
  return index.bySlug.get(slug) ?? index.byKey.get(topicKeyFromSlug(slug)) ?? null;
}

/**
 * Is this topic worth advertising as a link/URL? Curated dictionary topics
 * always are. A discovered phrase has to be corroborated by a second
 * independent cluster — the deterministic answer to headline-fragment
 * bigrams ("Bay Giants", "UnitedHealthcare CEO") that needs no deny-list
 * and makes no claim about whether the phrase is a real name.
 */
export function isTopicEligible(entry: TopicEntry | null | undefined): boolean {
  if (!entry) return false;
  return entry.curated || entry.clusterCount >= MIN_CLUSTERS_FOR_TOPIC;
}
