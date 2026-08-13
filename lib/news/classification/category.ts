import {
  CATEGORIES,
  CATEGORY_IDS,
  ENTITY_CATEGORY_SIGNALS,
  NEGATIVE_KEYWORDS,
  type CategoryId,
} from "@/config/categories";

/**
 * Deterministic keyword-scored category classifier.
 * Title matches weigh more than description matches; an exact provider
 * category alias is a strong signal but never the only one. Entity signals
 * (word-boundary matched) weigh like a title keyword hit; feed-section
 * priors are a weak nudge; negative keywords kill obvious false positives.
 */

export interface CategoryInput {
  title: string;
  description?: string;
  providerCategory?: string;
  /**
   * True when providerCategory is an inferred feed-section prior (RSS domain
   * → section) rather than an explicit publisher category. Priors weigh
   * PRIOR_WEIGHT instead of PROVIDER_ALIAS_WEIGHT and never decide alone.
   */
  providerCategoryIsPrior?: boolean;
}

export interface CategoryResult {
  primary: CategoryId;
  all: CategoryId[];
  /**
   * 0..1, deterministic — normalized margin between the top-2 category
   * scores ((top1 - top2) / top1). 1 when only one category scored,
   * 0 for the neutral world fallback.
   */
  confidence: number;
  /** Per-category totals for every category that scored above zero. */
  scores: Partial<Record<CategoryId, number>>;
  /** Signals that fired, as "category:type:signal" strings. */
  matchedSignals: string[];
}

const TITLE_KEYWORD_WEIGHT = 3;
const DESCRIPTION_KEYWORD_WEIGHT = 1;
/** Entity signal — comparable to a title keyword hit. */
const ENTITY_WEIGHT = 3;
const PROVIDER_ALIAS_WEIGHT = 4;
/** Feed-section prior — a nudge, never absolute. */
const PRIOR_WEIGHT = 2;
/** Negative keyword hit — cancels a title keyword hit. */
const NEGATIVE_WEIGHT = 3;

/** Word-boundary matcher so "nfl" never fires inside "inflation". */
const boundaryRegexCache = new Map<string, RegExp>();
function boundaryRegex(needle: string): RegExp {
  let regex = boundaryRegexCache.get(needle);
  if (!regex) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
    boundaryRegexCache.set(needle, regex);
  }
  return regex;
}

export function classifyCategory(input: CategoryInput): CategoryResult {
  const title = ` ${input.title.toLowerCase()} `;
  const description = ` ${(input.description ?? "").toLowerCase()} `;
  const combined = `${title}${description}`;
  const providerCategory = input.providerCategory?.toLowerCase().trim();

  const scores = new Map<CategoryId, number>();
  const matchedSignals: string[] = [];

  for (const id of CATEGORY_IDS) {
    const def = CATEGORIES[id];
    let score = 0;
    for (const keyword of def.keywords) {
      if (title.includes(keyword)) {
        score += TITLE_KEYWORD_WEIGHT;
        matchedSignals.push(`${id}:title:${keyword.trim()}`);
      } else if (description.includes(keyword)) {
        score += DESCRIPTION_KEYWORD_WEIGHT;
        matchedSignals.push(`${id}:desc:${keyword.trim()}`);
      }
    }
    if (providerCategory && def.providerAliases.includes(providerCategory)) {
      if (input.providerCategoryIsPrior) {
        score += PRIOR_WEIGHT;
        matchedSignals.push(`${id}:prior:${providerCategory}`);
      } else {
        score += PROVIDER_ALIAS_WEIGHT;
        matchedSignals.push(`${id}:provider:${providerCategory}`);
      }
    }
    if (score > 0) scores.set(id, score);
  }

  // Entity signals — curated map, word-boundary matched over title + description.
  for (const [entity, id] of Object.entries(ENTITY_CATEGORY_SIGNALS)) {
    if (boundaryRegex(entity).test(combined)) {
      scores.set(id, (scores.get(id) ?? 0) + ENTITY_WEIGHT);
      matchedSignals.push(`${id}:entity:${entity}`);
    }
  }

  // Negative keywords — subtract and drop categories pushed to zero or below.
  for (const [id, negatives] of Object.entries(NEGATIVE_KEYWORDS) as [
    CategoryId,
    string[],
  ][]) {
    const current = scores.get(id);
    if (current === undefined) continue;
    let score = current;
    for (const keyword of negatives) {
      if (combined.includes(keyword)) {
        score -= NEGATIVE_WEIGHT;
        matchedSignals.push(`${id}:negative:${keyword}`);
      }
    }
    if (score > 0) scores.set(id, score);
    else scores.delete(id);
  }

  if (scores.size === 0) {
    // Nothing matched — world as the neutral bucket.
    return {
      primary: "world",
      all: ["world"],
      confidence: 0,
      scores: {},
      matchedSignals,
    };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const threshold = Math.max(3, sorted[0][1] * 0.4);
  const all = sorted.filter(([, s]) => s >= threshold).map(([id]) => id);
  if (!all.includes(primary)) all.unshift(primary);

  const confidence =
    sorted.length === 1
      ? 1
      : Math.min(1, Math.max(0, (sorted[0][1] - sorted[1][1]) / sorted[0][1]));

  return {
    primary,
    all: all.slice(0, 3),
    confidence,
    scores: Object.fromEntries(sorted) as Partial<Record<CategoryId, number>>,
    matchedSignals,
  };
}
