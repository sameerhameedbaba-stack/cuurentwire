import { CATEGORIES } from "@/config/categories";
import type { SourceTier } from "@/config/sources";
import { RANKING_WEIGHTS } from "@/lib/news/ranking/score";
import { topicKey } from "@/lib/news/topics";
import {
  CONTENT_TYPE_LABELS,
  COUNTRY_LABELS,
  type RankingBreakdown,
  type StoryCluster,
} from "@/lib/news/types";
import { truncate } from "@/lib/utils/text";

/**
 * Facts behind the story-page context module.
 *
 * Every value is read off the cluster the page already renders — the lead
 * publisher's identity and tier, the timestamps the page already displays,
 * CurrentWire's OWN ranking breakdown, the classification, and the live
 * topic counts the page already built for its chips. Nothing is generated,
 * inferred, paraphrased or fetched.
 *
 * Why it exists: 300 of the 313 URLs in the news sitemap (censused
 * 2026-08-19) carry exactly one report, so the only body text on those pages
 * was a publisher dek plus labels.
 *
 * Why it is SMALL: the same census is a duplicate-content problem across
 * 2,199 permanent story URLs, and a fixed block of explanatory prose repeated
 * on every one of them makes that worse, not better. So this module carries
 * only values that DIFFER between two stories; the standing explanations live
 * on /methodology, /methodology/publisher-tiers and
 * /methodology/coverage-breadth, and the component links there instead of
 * restating them.
 *
 * Pure and side-effect free so it is unit-testable without a renderer.
 */

export type RankingSignalKey = Exclude<keyof RankingBreakdown, "total">;

/** Signal names EXACTLY as /methodology heads them — the module links there. */
export const RANKING_SIGNAL_LABELS: Record<RankingSignalKey, string> = {
  freshness: "Freshness",
  authority: "Source authority",
  coverage: "Coverage breadth",
  geography: "Geographic relevance",
  prominence: "Story prominence",
  velocity: "Velocity",
};

/** Display order = the order the signals are documented in on /methodology. */
const SIGNAL_ORDER: RankingSignalKey[] = [
  "freshness",
  "authority",
  "coverage",
  "geography",
  "prominence",
  "velocity",
];

export interface RankingSignalRow {
  key: RankingSignalKey;
  label: string;
  /** Points this story actually scored (already rounded by scoreCluster). */
  points: number;
  /** Maximum this signal can contribute (RANKING_WEIGHTS). */
  max: number;
}

export interface StoryTopicRow {
  /** Entity name exactly as extracted for this cluster. */
  name: string;
  /**
   * OTHER live clusters mentioning this topic. Absent when the caller passed
   * no counts — never guessed.
   */
  others?: number;
}

export interface StoryContextFacts {
  leadSource: string;
  leadDomain: string;
  leadTier: SourceTier;
  author?: string;
  leadPublishedAt: string;
  /** Archive first_seen_at — when CurrentWire's page went live. */
  publishedByUsAt?: string;
  /** "43 minutes", "2 hours" — only when it is a real, forward-running gap. */
  pickupDelay?: string;
  /** Distinct publications in the RENDERED coverage list. */
  publicationCount: number;
  /** Total 0-100 score; absent when the breakdown carries no live signals. */
  score?: number;
  /** Six rows, or [] when the cluster was rebuilt from the archive. */
  signals: RankingSignalRow[];
  /** Highest share of its OWN maximum; absent when signals is empty. */
  strongest?: RankingSignalRow;
  categoryLabel: string;
  categoryPath: string;
  countryLabel: string;
  contentTypeLabel: string;
  /** Extracted topics, deduplicated by topic identity, in cluster order. */
  topics: StoryTopicRow[];
}

/** Beyond this the gap is a data artifact, not a pickup delay. */
const MAX_PICKUP_MINUTES = 72 * 60;

/** extractEntities caps an article at 8; the rendered list matches that. */
const MAX_TOPICS = 8;

/**
 * Minutes between the earliest source report and the moment CurrentWire
 * published its page — returned ONLY when positive and inside the 72h
 * ingestion window.
 *
 * Both guards are load-bearing and were written against live data. The
 * coverage list holds only members still inside the publishers' feed
 * windows, so when an earlier report rotates out, firstPublishedAt jumps
 * FORWARD past our own first_seen_at and the difference goes negative —
 * observed live 2026-08-19 on
 * /story/bill-rasmussen-co-founder-of-espn-dies-at-93-c88309129ec2c (page
 * live 12:35 PM ET, earliest surviving report 7:47 PM ET the same day).
 * A negative or absurd gap is never printed.
 */
export function pickupDelayMinutes(
  firstPublishedAt: string,
  publishedByUsAt: string | undefined,
): number | undefined {
  if (!publishedByUsAt) return undefined;
  const published = new Date(firstPublishedAt).getTime();
  const ours = new Date(publishedByUsAt).getTime();
  if (!Number.isFinite(published) || !Number.isFinite(ours)) return undefined;
  const minutes = Math.round((ours - published) / 60_000);
  if (minutes <= 0 || minutes > MAX_PICKUP_MINUTES) return undefined;
  return minutes;
}

/** "43 minutes", "1 hour", "6 hours". Whole units only — no false precision. */
export function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Copyright cap for a publisher-supplied excerpt in the Coverage list.
 *
 * 220 characters is one to two sentences of the summary the publisher itself
 * syndicates in its feed for exactly this purpose. It is well under half the
 * 500-character cap normalization already applies to the same field
 * (MAX_DESCRIPTION_LENGTH, lib/news/normalization/normalize.ts:13 — the value
 * already rendered as the story dek), and roughly 3-5% of a typical 400-800
 * word news report, so it cannot reconstruct the article. It always renders
 * directly beneath the publisher's name, its tier, and a link to the original
 * report.
 */
export const COVERAGE_EXCERPT_MAX_CHARS = 220;

/** Below this an excerpt is a stub, not information — render nothing. */
const COVERAGE_EXCERPT_MIN_CHARS = 40;

/**
 * The excerpt to show under one report in the Coverage list, or undefined.
 *
 * `alreadyShown` is the story dek (cluster.summary), which IS the lead
 * member's description verbatim (clustering: `summary: lead.description`,
 * lib/news/clustering/cluster.ts:711). Repeating it under the lead's own
 * entry would duplicate text inside one page, so an excerpt the dek already
 * contains — or that contains the dek — is dropped. On a one-article cluster
 * this returns undefined for the only member, by design: the change adds
 * text only where a SECOND publisher actually said something else.
 */
export function coverageExcerpt(
  description: string | undefined,
  alreadyShown: string | undefined,
): string | undefined {
  const text = description?.replace(/\s+/g, " ").trim();
  if (!text || text.length < COVERAGE_EXCERPT_MIN_CHARS) return undefined;
  const shown = alreadyShown?.replace(/\s+/g, " ").trim();
  if (shown && (shown.startsWith(text) || text.startsWith(shown))) return undefined;
  return truncate(text, COVERAGE_EXCERPT_MAX_CHARS);
}

export function buildStoryContext(
  cluster: StoryCluster,
  options: {
    publishedByUsAt?: string;
    /**
     * Live cluster counts keyed by `topicKey` — the same identity the story
     * page's "In this story" chips use, so variants of one topic pool.
     */
    topicCounts?: ReadonlyMap<string, number>;
    /** Archived stories are absent from the live dataset — see below. */
    isArchived?: boolean;
  } = {},
): StoryContextFacts {
  const lead = cluster.lead;
  const breakdown = cluster.rankingBreakdown;

  // Archive-rebuilt clusters carry an all-zero breakdown with only `total`
  // set (archivedStoryToCluster, lib/database/archive.ts:1023) — and that
  // total is a stale score from whenever the story last ranked live. Printing
  // a per-signal table of zeros, or that stale total, would be a fabricated
  // metric: emit no signals at all and let the component drop the block.
  const hasLiveSignals = SIGNAL_ORDER.some((key) => breakdown[key] > 0);
  const signals: RankingSignalRow[] = hasLiveSignals
    ? SIGNAL_ORDER.map((key) => ({
        key,
        label: RANKING_SIGNAL_LABELS[key],
        points: breakdown[key],
        max: RANKING_WEIGHTS[key],
      }))
    : [];

  // "Strongest" = closest to its OWN maximum, not most points: geographic
  // relevance at 10 of 10 beats freshness at 31.5 of 35. Strict > keeps the
  // documented signal order as the deterministic tie-break.
  let strongest: RankingSignalRow | undefined;
  for (const row of signals) {
    if (!strongest || row.points / row.max > strongest.points / strongest.max) {
      strongest = row;
    }
  }

  // A live cluster contributes 1 to its own topics' counts; an archived one
  // is absent from the live dataset. Same correction the story page already
  // applies to the "In this story" chips.
  const selfCount = options.isArchived ? 0 : 1;
  const topics: StoryTopicRow[] = [];
  const seenKeys = new Set<string>();
  for (const entity of cluster.entities) {
    if (topics.length >= MAX_TOPICS) break;
    const key = topicKey(entity);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    topics.push(
      options.topicCounts
        ? {
            name: entity,
            others: Math.max(0, (options.topicCounts.get(key) ?? selfCount) - selfCount),
          }
        : { name: entity },
    );
  }

  const minutes = pickupDelayMinutes(cluster.firstPublishedAt, options.publishedByUsAt);
  const categoryDef = CATEGORIES[cluster.category];

  return {
    leadSource: lead.source,
    leadDomain: lead.sourceDomain,
    leadTier: lead.sourceTier,
    author: lead.author,
    leadPublishedAt: lead.publishedAt,
    publishedByUsAt: options.publishedByUsAt,
    pickupDelay: minutes === undefined ? undefined : formatDelay(minutes),
    // Derived from the rendered coverage list, NEVER cluster.sourceCount —
    // the rule CoverageSources already states: sourceCount tracks the active
    // feed window and the two drift apart on archived stories.
    publicationCount: new Set(cluster.articles.map((a) => a.source)).size,
    score: hasLiveSignals ? breakdown.total : undefined,
    signals,
    strongest,
    categoryLabel: categoryDef.label,
    categoryPath: categoryDef.path,
    countryLabel: COUNTRY_LABELS[cluster.country],
    contentTypeLabel: CONTENT_TYPE_LABELS[cluster.contentType ?? "news"],
    topics,
  };
}
