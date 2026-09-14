/**
 * Editorial eligibility for the slim relaunch.
 *
 * The 2026-09-15 owner decision replaced mass aggregation with ~10 original,
 * multi-source articles per day. Two filters decide what may become one of
 * those ten, and they answer different questions:
 *
 *   1. ELIGIBILITY — may this story enter the pool at all? (free-range
 *      sourcing, corroboration, not a press-release echo)
 *   2. REVIEW — may it publish without the owner reading it first?
 *      (crime, courts, health, money advice)
 *
 * Keeping them separate matters: a story can be perfectly eligible and still
 * need a human, and conflating the two would either bury good stories or
 * auto-publish the ones most capable of causing harm.
 *
 * Everything here is a pure function over a cluster. No network, no clock
 * beyond what the caller passes in, so the whole gate is testable offline —
 * which is the only way it can be verified while production is paused.
 */

import type { CategoryId } from "@/config/categories";
import { isFreeToRead, resolveAccess, type SourceAccess } from "@/config/sources";
import { isPressReleaseMember, sourceMix } from "@/lib/news/coverage-analysis";
import type { Article, StoryCluster } from "@/lib/news/types";

/**
 * Minimum independent publications (distinct domains, press releases
 * excluded) before a story may run at all.
 *
 * The recorded rule is "accusations always attributed and 2+ sources or the
 * piece doesn't run". Applying it to EVERY story, not only accusations, is
 * deliberate: single-source synthesis is just a rewrite of one article,
 * which is both the legal risk and the thing Google's scaled-content policy
 * targets. Two independent reports is what makes our piece genuinely ours.
 */
export const MIN_INDEPENDENT_DOMAINS = 2;

/**
 * Minimum free-to-read publications among those independent sources.
 *
 * "Free range" (owner, 2026-09-15) = sources that cost us nothing AND that a
 * reader can actually open. If every report on a story sits behind a
 * paywall, our article becomes the only readable account of it — we would be
 * asking readers to trust claims they cannot check, which is precisely the
 * position a new publication must not take.
 */
export const MIN_FREE_SOURCES = 2;

/**
 * Categories cleared for auto-publication at launch.
 *
 * Deliberately narrow (owner decision: "starting in low-risk verticals
 * (technology/business/science), scaling only on 4 weeks of evidence").
 * Widening this set is an owner decision backed by evidence, never a
 * routine's judgement call — see seo/STRATEGY.md.
 */
export const LAUNCH_CATEGORIES: readonly CategoryId[] = [
  "technology",
  "business",
  "science",
] as const;

/**
 * Categories that always need the owner's eyes regardless of launch scope.
 * Health is here because health misinformation causes direct harm and
 * Google's YMYL standards treat it as such.
 */
const ALWAYS_REVIEW_CATEGORIES: readonly CategoryId[] = ["health"] as const;

/**
 * Crime, courts and legal-process language.
 *
 * We do NOT try to decide whether the person named is public or private.
 * That judgement is unreliable from a headline, and the cost of getting it
 * wrong is defaming a real person. Any crime or court context routes to the
 * owner — a slightly wider gate than the recorded rule, chosen knowingly.
 */
const CRIME_COURT_TERMS: readonly string[] = [
  "arrest", "arrested", "charged", "charges", "indicted", "indictment",
  "convicted", "conviction", "sentenced", "sentencing", "plea", "pleaded",
  "guilty", "acquitted", "verdict", "trial", "lawsuit", "sued", "suing",
  "court", "judge", "jury", "prosecutor", "prosecution", "defendant",
  "testimony", "subpoena", "allegation", "alleged", "allegedly", "accuser",
  "accused", "fraud", "embezzlement", "assault", "abuse", "murder",
  "homicide", "manslaughter", "kidnapping", "trafficking", "rape",
  "misconduct", "harassment", "investigation", "probe", "raid", "custody",
  "extradition", "settlement", "class action", "felony", "misdemeanor",
];

/**
 * Personal-finance advice language. Reporting that a market moved is news;
 * telling a reader what to do with their money is advice, and advice is the
 * owner's call.
 */
const MONEY_ADVICE_TERMS: readonly string[] = [
  "should you buy", "should you sell", "best stocks", "top stocks",
  "stocks to buy", "stocks to watch", "investment advice", "how to invest",
  "best etf", "retirement plan", "how to save", "crypto to buy",
  "price prediction", "price target", "buy the dip", "portfolio",
  "financial advice", "get rich", "passive income", "best mortgage",
  "refinance", "credit score", "tax loophole", "tax tips",
];

/** Why a story was rejected or flagged. Stable machine-readable codes. */
export type EligibilityReason =
  | "single-source"
  | "not-enough-free-sources"
  | "press-release-only"
  | "opinion-heavy"
  | "outside-launch-categories"
  | "sensitive-crime-or-courts"
  | "sensitive-health"
  | "sensitive-money-advice";

export interface EligibilityVerdict {
  /** May this story enter the daily pool at all? */
  eligible: boolean;
  /**
   * True when the story may be published without the owner reading it.
   * False means: keep it, write it, but hold it for approval.
   * Always false when `eligible` is false.
   */
  autoPublish: boolean;
  /** Stable reason codes; empty when the story auto-publishes cleanly. */
  reasons: EligibilityReason[];
  /** Distinct non-press-release domains backing the story. */
  independentDomains: number;
  /** How many of those are free to read. */
  freeSources: number;
  /** Free-to-read source names, for the brief's "check it yourself" line. */
  freeSourceNames: string[];
}

type ClusterInput = Pick<
  StoryCluster,
  "articles" | "title" | "category" | "summary"
>;

/** Distinct domains among non-press-release members. */
function independentMembers(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const article of articles) {
    if (isPressReleaseMember(article)) continue;
    const domain = article.sourceDomain.trim().toLowerCase();
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push(article);
  }
  return out;
}

/**
 * Word-boundary match, so "probe" does not fire on "problem" and "court"
 * does not fire on "courtesy". Multi-word terms are matched as phrases.
 */
function containsTerm(haystack: string, terms: readonly string[]): boolean {
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(haystack)) return true;
  }
  return false;
}

/**
 * The text a sensitivity check reads: our own cluster-level framing plus
 * every member headline. Member descriptions are deliberately included —
 * a neutral headline over a crime story is common, and the gate should see
 * the whole coverage, not just the lead.
 */
function sensitivityCorpus(cluster: ClusterInput): string {
  const parts = [cluster.title, cluster.summary ?? ""];
  for (const article of cluster.articles) {
    parts.push(article.title);
    if (article.description) parts.push(article.description);
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

/**
 * Decide whether a clustered story may run, and whether it may run
 * unattended.
 *
 * @param cluster        the candidate story
 * @param launchCategories categories cleared for auto-publication; defaults
 *                       to LAUNCH_CATEGORIES. Passed in so the owner can
 *                       widen scope through config rather than a code edit,
 *                       and so tests can pin the behaviour independently of
 *                       the current launch scope.
 */
export function assessEligibility(
  cluster: ClusterInput,
  launchCategories: readonly CategoryId[] = LAUNCH_CATEGORIES,
): EligibilityVerdict {
  const reasons: EligibilityReason[] = [];
  const independent = independentMembers(cluster.articles);
  const free = independent.filter((a) => isFreeToRead(a.source, a.sourceDomain));
  const mix = sourceMix(cluster);

  // ── Filter 1: may this run at all? ────────────────────────────────────
  if (mix.total > 0 && independent.length === 0) {
    reasons.push("press-release-only");
  }
  if (independent.length < MIN_INDEPENDENT_DOMAINS) {
    reasons.push("single-source");
  }
  if (free.length < MIN_FREE_SOURCES) {
    reasons.push("not-enough-free-sources");
  }
  // A story whose independent coverage is mostly comment rather than
  // reporting has no agreed facts to synthesise from.
  if (
    independent.length >= MIN_INDEPENDENT_DOMAINS &&
    mix.opinionOrAnalysis > mix.total / 2
  ) {
    reasons.push("opinion-heavy");
  }

  const eligible = reasons.length === 0;

  // ── Filter 2: may it run unattended? ──────────────────────────────────
  const corpus = sensitivityCorpus(cluster);
  const sensitive: EligibilityReason[] = [];
  if (containsTerm(corpus, CRIME_COURT_TERMS)) {
    sensitive.push("sensitive-crime-or-courts");
  }
  if (ALWAYS_REVIEW_CATEGORIES.includes(cluster.category)) {
    sensitive.push("sensitive-health");
  }
  if (containsTerm(corpus, MONEY_ADVICE_TERMS)) {
    sensitive.push("sensitive-money-advice");
  }
  if (!launchCategories.includes(cluster.category)) {
    sensitive.push("outside-launch-categories");
  }
  reasons.push(...sensitive);

  return {
    eligible,
    autoPublish: eligible && sensitive.length === 0,
    reasons,
    independentDomains: independent.length,
    freeSources: free.length,
    freeSourceNames: free.map((a) => a.source),
  };
}

/**
 * Access breakdown of a cluster's independent coverage. Used by the brief so
 * the writer can say plainly which reports a reader is able to open.
 */
export function accessBreakdown(
  cluster: Pick<StoryCluster, "articles">,
): Record<SourceAccess, string[]> {
  const out: Record<SourceAccess, string[]> = {
    free: [],
    metered: [],
    paywalled: [],
  };
  for (const article of independentMembers(cluster.articles)) {
    const access = resolveAccess(article.source, article.sourceDomain);
    if (!out[access].includes(article.source)) out[access].push(article.source);
  }
  return out;
}
