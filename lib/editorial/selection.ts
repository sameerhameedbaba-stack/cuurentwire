/**
 * Daily top-10 selection for the slim relaunch.
 *
 * Owner decision, 2026-09-15: ~10 original articles per day TOTAL — not ten
 * per vertical. The number is the point. It is what keeps the site inside the
 * free Hobby caps that the 16k-page aggregator blew through (ISR writes 4.8M
 * against a 200K allowance), and it is what makes ten genuinely researched
 * pieces possible instead of thousands of thin ones.
 *
 * Selection is deliberately boring and deterministic: rank, filter, cap per
 * category, take ten. No model is asked to choose; the same inputs always
 * produce the same slate, which is what makes a bad day debuggable.
 */

import type { CategoryId } from "@/config/categories";
import { assessEligibility, LAUNCH_CATEGORIES, type EligibilityVerdict } from "@/lib/editorial/eligibility";
import type { StoryCluster } from "@/lib/news/types";

/** Articles published per day, total. */
export const DAILY_TARGET = 10;

/**
 * Most stories one category may contribute to a single day's slate.
 *
 * Without a cap, one busy news day in technology fills all ten slots and the
 * site looks like a single-topic blog. Four of ten keeps a dominant story
 * dominant without letting it own the day.
 */
export const MAX_PER_CATEGORY = 4;

export interface SelectedStory {
  cluster: StoryCluster;
  verdict: EligibilityVerdict;
}

export interface DailySelection {
  /** Cleared to write and publish unattended, best first. Never exceeds DAILY_TARGET. */
  publish: SelectedStory[];
  /**
   * Eligible and worth writing, but held for the owner (crime, courts,
   * health, money advice, or outside the launch verticals). Not counted
   * against DAILY_TARGET — the owner decides if and when these run.
   */
  review: SelectedStory[];
  /** Failed the sourcing gate. Kept with reasons so a run can explain itself. */
  rejected: SelectedStory[];
  /** Why the slate is short, when it is. */
  shortfall?: string;
}

export interface SelectionOptions {
  target?: number;
  maxPerCategory?: number;
  launchCategories?: readonly CategoryId[];
}

/**
 * Build one day's slate from the day's clusters.
 *
 * Ranking uses the existing `rankingScore` rather than a new one: that scorer
 * is already benchmarked and already carries recency, source authority and
 * coverage breadth. Inventing a second ranking here would create two
 * definitions of "important" that quietly disagree.
 */
export function selectDaily(
  clusters: StoryCluster[],
  options: SelectionOptions = {},
): DailySelection {
  const {
    target = DAILY_TARGET,
    maxPerCategory = MAX_PER_CATEGORY,
    launchCategories = LAUNCH_CATEGORIES,
  } = options;

  const assessed: SelectedStory[] = clusters
    .map((cluster) => ({ cluster, verdict: assessEligibility(cluster, launchCategories) }))
    .sort((a, b) => b.cluster.rankingScore - a.cluster.rankingScore);

  const rejected = assessed.filter((s) => !s.verdict.eligible);
  const eligible = assessed.filter((s) => s.verdict.eligible);
  const review = eligible.filter((s) => !s.verdict.autoPublish);
  const candidates = eligible.filter((s) => s.verdict.autoPublish);

  const publish: SelectedStory[] = [];
  const perCategory = new Map<CategoryId, number>();
  for (const story of candidates) {
    if (publish.length >= target) break;
    const category = story.cluster.category;
    const used = perCategory.get(category) ?? 0;
    if (used >= maxPerCategory) continue;
    perCategory.set(category, used + 1);
    publish.push(story);
  }

  const selection: DailySelection = { publish, review, rejected };

  if (publish.length < target) {
    // Say which constraint bound, not just that the slate is short — the
    // fix for "nothing corroborated today" is nothing like the fix for
    // "technology was capped".
    const capped = candidates.length - publish.length;
    const parts: string[] = [
      `${publish.length}/${target} slots filled from ${clusters.length} clusters`,
    ];
    if (capped > 0) parts.push(`${capped} held back by the ${maxPerCategory}-per-category cap`);
    if (rejected.length > 0) parts.push(`${rejected.length} failed the sourcing gate`);
    if (review.length > 0) parts.push(`${review.length} waiting on owner review`);
    selection.shortfall = parts.join("; ");
  }

  return selection;
}

/** Count of each rejection/hold reason across a slate, for the daily report. */
export function reasonTally(selection: DailySelection): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const story of [...selection.rejected, ...selection.review]) {
    for (const reason of story.verdict.reasons) {
      tally[reason] = (tally[reason] ?? 0) + 1;
    }
  }
  return tally;
}
