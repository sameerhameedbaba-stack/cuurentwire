import { isDistributorDomain } from "@/lib/news/classification/content-type";
import { independentSourceCount } from "@/lib/news/ranking/score";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import type { Article, StoryCluster } from "@/lib/news/types";

/**
 * Deterministic coverage analysis for story pages ("Automated coverage
 * analysis" section). Everything here is computed from the cluster's member
 * articles — no generated claims, no paraphrasing: the only strings that
 * leave this module verbatim are entity names and phrases that literally
 * occur in the articles' own titles/descriptions.
 */

export interface SourceMix {
  /** Distinct domains of non-press-release members. */
  independentDomains: number;
  /** Member articles that are press releases (by type or distributor domain). */
  pressReleases: number;
  /** Member articles labeled opinion or analysis. */
  opinionOrAnalysis: number;
  /** All member articles. */
  total: number;
}

export interface CorroboratedDetail {
  /** Verbatim phrase as it appears in the first article that carries it. */
  phrase: string;
  /** Source names of the independent members whose text contains the phrase. */
  sources: string[];
}

/**
 * Press-release membership check that also works for archive-rebuilt
 * clusters: archived members carry no contentType, but a distributor domain
 * is a press release by definition (same feed-origin rule the classifier
 * uses).
 */
export function isPressReleaseMember(
  article: Pick<Article, "contentType" | "sourceDomain">,
): boolean {
  return (
    article.contentType === "press_release" ||
    isDistributorDomain(article.sourceDomain)
  );
}

/** Composition of a cluster's coverage, for the source-mix line. */
export function sourceMix(cluster: Pick<StoryCluster, "articles">): SourceMix {
  const editorial = cluster.articles.filter((a) => !isPressReleaseMember(a));
  return {
    // independentSourceCount floors at 1 (the issuer) for ranking purposes;
    // the DISPLAYED mix must honestly say 0 when no member is editorial.
    independentDomains:
      editorial.length === 0
        ? 0
        : independentSourceCount({ articles: editorial }),
    pressReleases: cluster.articles.length - editorial.length,
    opinionOrAnalysis: editorial.filter(
      (a) => a.contentType === "opinion" || a.contentType === "analysis",
    ).length,
    total: cluster.articles.length,
  };
}

const MAX_CORROBORATED_DETAILS = 6;

/** "$2 billion", "US$40m", "CA$1.2 million", "$2,000". */
const MONEY_PATTERN =
  /(?:US|CA|C|A)?\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|[mbk]n?))?\b/gi;

/** "18-year-old", "6-month-old". */
const AGE_PATTERN = /\b\d{1,3}-(?:year|month|week|day)-old\b/gi;

/** "45%", "4.5 percent", "12 per cent". */
const PERCENT_PATTERN = /\b\d[\d.]*(?:\s?%|\s(?:percent|per cent)\b)/gi;

/** "8 games", "3 people", "5 years" — a number followed by a plain word. */
const COUNT_PATTERN = /\b(\d[\d,]*)\s+([A-Za-z][A-Za-z-]{2,})\b/g;

/**
 * Function words that make a number-plus-word pair meaningless as a detail
 * ("3 of", "2 more"); "percent" is excluded because PERCENT_PATTERN already
 * emits the full percentage phrase.
 */
const COUNT_STOPWORDS = new Set([
  "the", "and", "for", "are", "was", "were", "has", "have", "had", "will",
  "would", "could", "should", "that", "this", "with", "from", "into", "over",
  "under", "more", "most", "other", "others", "than", "then", "when", "who",
  "which", "after", "before", "said", "says", "new", "its", "his", "her",
  "their", "per", "off", "out", "not", "but", "can", "may", "might", "been",
  "being", "them", "they", "against", "percent",
]);

/** Bare 1800–2099 numbers read as years, not counts ("2026 season"). */
const YEAR_LIKE = /^(?:1[89]|20)\d{2}$/;

/**
 * Conservative numeric detail candidates that literally occur in the text:
 * money amounts, ages, percentages, and simple counts. Never rewrites or
 * combines anything — each returned string is a verbatim substring.
 */
export function extractNumericPhrases(text: string): string[] {
  const phrases: string[] = [];
  for (const pattern of [MONEY_PATTERN, AGE_PATTERN, PERCENT_PATTERN]) {
    for (const match of text.matchAll(pattern)) phrases.push(match[0]);
  }
  for (const match of text.matchAll(COUNT_PATTERN)) {
    const [full, number, word] = match;
    // Skip fragments of money/decimal figures ("$2 billion", "3.5 million").
    const before = match.index > 0 ? text[match.index - 1] : "";
    if (before === "$" || before === "." || before === ",") continue;
    if (YEAR_LIKE.test(number)) continue;
    if (COUNT_STOPWORDS.has(word.toLowerCase())) continue;
    phrases.push(full);
  }
  return phrases;
}

/**
 * Details corroborated by independent coverage: verbatim phrases (canonical
 * entities plus extracted numeric phrases) that appear in the title +
 * description of articles from at least two DISTINCT independent
 * (non-press-release) domains. Case-insensitive verbatim matching only;
 * same-domain repeats never count as corroboration. Stable order: entities
 * in cluster order first, then numeric phrases by first appearance.
 */
export function corroboratedDetails(
  cluster: Pick<StoryCluster, "articles" | "entities">,
): CorroboratedDetail[] {
  const docs = cluster.articles
    .filter((a) => !isPressReleaseMember(a))
    .map((a) => {
      const text = `${a.title} ${a.description ?? ""}`.replace(/\s+/g, " ").trim();
      return {
        domain: a.sourceDomain,
        source: a.source,
        text,
        lower: text.toLowerCase(),
      };
    });
  if (docs.length < 2) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (phrase: string) => {
    const key = phrase.toLowerCase();
    if (phrase.length < 2 || seen.has(key)) return;
    seen.add(key);
    candidates.push(phrase);
  };
  for (const entity of cluster.entities) push(entity);
  for (const doc of docs) {
    for (const phrase of extractNumericPhrases(doc.text)) push(phrase);
  }

  const details: CorroboratedDetail[] = [];
  for (const phrase of candidates) {
    if (details.length >= MAX_CORROBORATED_DETAILS) break;
    const lower = phrase.toLowerCase();
    const matching = docs.filter((d) => d.lower.includes(lower));
    const domains = new Set(matching.map((d) => d.domain));
    if (domains.size < 2) continue;
    const sources: string[] = [];
    for (const d of matching) {
      if (!sources.includes(d.source)) sources.push(d.source);
    }
    details.push({ phrase, sources });
  }
  return details;
}

/**
 * Human phrasing for a story-update event, shared by the update log and the
 * coverage timeline. Pure string templating over recorded facts.
 */
export function describeUpdateEvent(event: StoryUpdateEvent): string {
  switch (event.kind) {
    case "source_added":
      return `${event.source} joined coverage`;
    case "headline_updated":
      return "Headline updated";
    case "coverage_change":
      return `Coverage went from ${event.from} to ${event.to} sources`;
    case "category_changed":
      return `Reclassified from ${event.from} to ${event.to}`;
  }
}
