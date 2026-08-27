import {
  BUSINESS_TIEBREAK_KEYWORDS,
  CATEGORIES,
  CATEGORY_IDS,
  CONDITIONAL_ENTITY_SIGNALS,
  ENTITY_CATEGORY_SIGNALS,
  NEGATIVE_KEYWORDS,
  type CategoryId,
} from "@/config/categories";

/**
 * Deterministic keyword-scored category classifier.
 * Title matches weigh more than description matches; an exact provider
 * category alias is a strong signal but never the only one. Entity signals
 * (word-boundary matched) weigh like a title keyword hit; conditional
 * entity signals additionally need a context keyword to co-occur;
 * feed-section priors are a weak nudge; negative keywords kill obvious
 * false positives; an exact top tie that includes business resolves to
 * business when a financial-frame keyword is present.
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
  /**
   * PUBLIC ROUTING FIELD — copied to `Article.categories`, which drives the
   * indexable "Related coverage" rail on every category page
   * (`getCategoryData`, lib/news/queries.ts). Only categories this classifier
   * is willing to stand behind belong here: the confident path lists the
   * primary plus its genuine secondary signals, and every ambiguity-guard
   * path lists `["general"]` alone. Candidates the guard REJECTED go to
   * `rejectedCandidates` instead — see the guard below for the measurement
   * that forced that split.
   */
  all: CategoryId[];
  /**
   * Categories that tied for the top score and were rejected by the
   * ambiguity guard. Diagnostics only — never a routing or listing signal.
   * Empty whenever the guard did not fire on a tie.
   */
  rejectedCandidates: CategoryId[];
  /**
   * 0..1, deterministic — normalized margin between the top-2 category
   * scores ((top1 - top2) / top1). 1 when only one category scored,
   * 0 for the neutral general fallback.
   */
  confidence: number;
  /** Per-category totals for every category that scored above zero. */
  scores: Partial<Record<CategoryId, number>>;
  /** Signals that fired, as "category:type:signal" strings. */
  matchedSignals: string[];
}

const TITLE_KEYWORD_WEIGHT = 3;
/**
 * Multi-word phrases are rarer and more precise than single words, so a
 * phrase hit in the title outweighs a single-word hit — "premier league"
 * (sports) must beat the "premier" (politics) it contains.
 */
const PHRASE_TITLE_BONUS = 1;
const DESCRIPTION_KEYWORD_WEIGHT = 1;
/** Entity signal — comparable to a title keyword hit. */
const ENTITY_WEIGHT = 3;
const PROVIDER_ALIAS_WEIGHT = 4;
/** Feed-section prior — a nudge, never absolute. */
const PRIOR_WEIGHT = 2;
/** Negative keyword hit — cancels a title keyword hit. */
const NEGATIVE_WEIGHT = 3;
/**
 * Minimum top score required to assign a specific category. A single
 * description keyword hit (weight 1) is noise, not evidence — anything
 * below a feed-section prior (2) falls back to the internal general
 * bucket. World is NEVER a fallback: it must be earned by signals like
 * any other category.
 */
const MIN_PRIMARY_SCORE = 2;

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

/**
 * Keyword matcher: word-boundary with an optional plural "s".
 * "app" must never fire inside "kidnapped"/"disappearing"/"happier"
 * (substring matching was the root cause of systematic technology
 * misclassification), while "market" still matches "markets".
 */
const keywordRegexCache = new Map<string, RegExp>();
function keywordRegex(keyword: string): RegExp {
  let regex = keywordRegexCache.get(keyword);
  if (!regex) {
    const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`);
    keywordRegexCache.set(keyword, regex);
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
      const regex = keywordRegex(keyword);
      if (regex.test(title)) {
        score += TITLE_KEYWORD_WEIGHT;
        if (keyword.trim().includes(" ")) score += PHRASE_TITLE_BONUS;
        matchedSignals.push(`${id}:title:${keyword.trim()}`);
      } else if (regex.test(description)) {
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

  // Conditional entity signals — the entity alone is ambiguous (SpaceX in
  // investor news), so it scores only when a required context keyword
  // co-occurs anywhere in the text.
  for (const signal of CONDITIONAL_ENTITY_SIGNALS) {
    if (!boundaryRegex(signal.entity).test(combined)) continue;
    if (!signal.requires.some((keyword) => keywordRegex(keyword).test(combined))) {
      continue;
    }
    scores.set(signal.category, (scores.get(signal.category) ?? 0) + ENTITY_WEIGHT);
    matchedSignals.push(`${signal.category}:entity:${signal.entity}`);
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
      if (keywordRegex(keyword).test(combined)) {
        score -= NEGATIVE_WEIGHT;
        matchedSignals.push(`${id}:negative:${keyword}`);
      }
    }
    if (score > 0) scores.set(id, score);
    else scores.delete(id);
  }

  if (scores.size === 0) {
    // Nothing matched — the internal general bucket, never world.
    return {
      primary: "general",
      all: ["general"],
      rejectedCandidates: [],
      confidence: 0,
      scores: {},
      matchedSignals,
    };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1];
  let tiedTop = sorted.filter(([, s]) => s === topScore).map(([id]) => id);

  // Financial-frame tie-break: an exact top tie that includes business
  // while a money keyword is present is a money story ("Nvidia discloses
  // $21B stake in SpaceX" ties business/technology on entity signals —
  // the stake is the story). Business wins instead of falling to general.
  if (tiedTop.length > 1 && topScore >= MIN_PRIMARY_SCORE && tiedTop.includes("business")) {
    const frame = BUSINESS_TIEBREAK_KEYWORDS.find((keyword) =>
      keywordRegex(keyword).test(combined),
    );
    if (frame) {
      const index = sorted.findIndex(([id]) => id === "business");
      sorted.unshift(...sorted.splice(index, 1));
      tiedTop = ["business"];
      matchedSignals.push(`business:tiebreak:${frame}`);
    }
  }

  // Ambiguity guards. A specific category needs a minimum score, and an
  // exact tie between different categories must never be decided by map
  // insertion order — ambiguous stories go to the internal general bucket.
  if (topScore < MIN_PRIMARY_SCORE || tiedTop.length > 1) {
    // The guard fired: no specific category is defensible, so `all` carries
    // general ALONE. The tied ids used to be pushed in here, which routed an
    // ambiguous story onto the "Related coverage" rail of EVERY category it
    // tied for — the guard protected `articleSection` while leaking the very
    // categories it had just rejected onto the indexable pages it exists to
    // protect. Measured against the 313-story validated truth set: the tie
    // path produced 40 such category-page placements and 31 of them (77.5%)
    // did not match the human label. That is arithmetic, not bad luck — a
    // two-way tie lists the story on both pages and at most one can be right.
    // The candidates stay available as diagnostics; they are not a signal.
    const rejectedCandidates =
      tiedTop.length > 1 ? tiedTop.filter((id) => id !== "general").slice(0, 3) : [];
    return {
      primary: "general",
      all: ["general"],
      rejectedCandidates,
      confidence: 0,
      scores: Object.fromEntries(sorted) as Partial<Record<CategoryId, number>>,
      matchedSignals,
    };
  }

  const primary = sorted[0][0];
  const threshold = Math.max(3, topScore * 0.4);
  const all = sorted.filter(([, s]) => s >= threshold).map(([id]) => id);
  if (!all.includes(primary)) all.unshift(primary);

  const confidence =
    sorted.length === 1
      ? 1
      : Math.min(1, Math.max(0, (topScore - sorted[1][1]) / topScore));

  return {
    primary,
    all: all.slice(0, 3),
    rejectedCandidates: [],
    confidence,
    scores: Object.fromEntries(sorted) as Partial<Record<CategoryId, number>>,
    matchedSignals,
  };
}
