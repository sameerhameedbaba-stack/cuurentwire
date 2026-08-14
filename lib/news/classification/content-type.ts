import type { ContentType } from "@/lib/news/types";

/**
 * Deterministic editorial content-type detection.
 *
 * Conservative by design: an article is only labeled opinion / analysis /
 * press_release / live when an unambiguous signal fires — everything else
 * stays "news". All patterns are word-boundary anchored; no LLM involved.
 *
 * Runs on the RAW title (before display cleaning) because the "| Author"
 * byline pipe that boilerplate cleaning strips IS an opinion signal.
 */

export interface ContentTypeInput {
  title: string;
  description?: string;
  /** Publisher domain — wire-distributor domains are a feed-origin signal. */
  sourceDomain?: string;
}

/**
 * Press-release distribution platforms: everything published ON these
 * domains is issuer communication by definition — a feed-origin signal that
 * needs no headline evidence at all.
 */
const DISTRIBUTOR_DOMAINS = new Set([
  "globenewswire.com",
  "prnewswire.com",
  "businesswire.com",
  "newsfilecorp.com",
  "accesswire.com",
  "newswire.ca",
  "einpresswire.com",
  "openpr.com",
  "prweb.com",
]);

/** True when a domain (or its subdomain) is a press-release distributor. */
export function isDistributorDomain(domain: string | undefined): boolean {
  if (!domain) return false;
  const clean = domain.toLowerCase().replace(/^www\./, "");
  if (DISTRIBUTOR_DOMAINS.has(clean)) return true;
  for (const d of DISTRIBUTOR_DOMAINS) {
    if (clean.endsWith(`.${d}`)) return true;
  }
  return false;
}

/**
 * Wire-service distribution markers. These strings appear in the dek of
 * syndicated corporate press releases ("VANCOUVER (GLOBE NEWSWIRE) — …")
 * and essentially never in journalism about a company.
 */
const WIRE_MARKERS = [
  /\bGLOBE\s*NEWSWIRE\b/i,
  /\bPR\s*Newswire\b/i,
  /\bBusiness\s*Wire\b/i,
  /\bNewsfile\b/i,
  /\bACCESSWIRE\b/i,
  /\bCNW\s*Group\b/i,
  /\bfor\s+immediate\s+release\b/i,
];

/** Stock-ticker parentheticals: "(TSX: ABC)", "(NYSE: XYZ)", "(NASDAQ: QQQ)". */
const TICKER_PATTERN =
  /\((?:TSX|TSXV|TSX-V|NYSE|NASDAQ|CSE|OTCQB|OTCQX|FSE)\s*:\s*[A-Z0-9.]{1,8}\)/;

/**
 * Unambiguous corporate-announcement headline patterns — boilerplate verbs
 * that only appear in issuer communications, strong enough on their own.
 */
const PR_HEADLINE_VERBS = [
  /\bannounces?\s+(?:q[1-4]|first|second|third|fourth)[\s-]*(?:quarter|\d{4})/i,
  /\breports?\s+(?:q[1-4]|first|second|third|fourth)[\s-]*(?:quarter\s+)?(?:\d{4}\s+)?(?:results|earnings|financial)/i,
  /\bgrants?\s+(?:of\s+)?(?:stock\s+options|incentive\s+(?:stock\s+)?(?:options|units)|RSUs|DSUs)\b/i,
  /\b(?:normal\s+course\s+)?issuer\s+bid\b/i,
  /\bcompletes?\s+(?:its\s+)?(?:private\s+placement|offering|bought[\s-]deal)/i,
  /\bcloses?\s+(?:private\s+placement|offering|bought[\s-]deal)/i,
  /\bdeclares?\s+(?:quarterly\s+|monthly\s+|annual\s+)?(?:cash\s+)?di(?:vidend|stribution)\b/i,
  /\bannounces?\s+(?:pricing|closing|upsizing)\s+of\b/i,
  // Securities-lawsuit spam: "XYZ Shareholder Alert", "Investor Notice",
  // "law firm reminds investors of the lead plaintiff deadline". Kept to
  // law-firm boilerplate phrasings — plain "class action" or "urges
  // investors" also appear in real journalism and must NOT fire.
  /\b(?:shareholder|investor)s?\s+(?:alert|notice|reminder)\b/i,
  /\b(?:encourages?|reminds?)\s+(?:investors|shareholders|stockholders)\b/i,
  /\blead\s+plaintiff\s+deadline\b/i,
];

/**
 * Weak announce-style verbs — common in real journalism ("Apple announces
 * new iPhone"), so they only count WITH a ticker or wire marker present.
 */
const PR_WEAK_VERBS =
  /\b(?:announces?|reports?|completes?|declares?|grants?|appoints?|provides?|enters\s+into)\b/i;

/** "Opinion:" / "Comment:" / "Editorial:" prefixes. */
const OPINION_PREFIX = /^(?:opinion|comment|editorial|op-ed|letters?)\s*[:|—–-]\s/i;

/**
 * Guardian-style "Headline | Author Name" byline pipe: a trailing pipe
 * segment of 2–4 capitalized words with no digits reads as a person's name.
 * Section-name suffixes ("| Premier League", "| CBS News") are excluded via
 * NOT_A_NAME below — those are navigation labels, not bylines.
 */
const BYLINE_PIPE =
  /\|\s*((?:[A-Z][\p{L}'’.-]+)(?:\s+(?:[A-Z][\p{L}'’.-]+|and|&)){1,4})\s*$/u;

/** Words that mark a pipe suffix as a section label rather than a person. */
const NOT_A_NAME =
  /\b(?:news|sport|sports|league|cup|live|update|updates|video|photos|pictures|podcast|review|analysis|explained|football|soccer|hockey|briefing|newsletter|times|post|daily|weekly|series|open|editorial)\b/i;

/** First-person openers: "I'm a …", "Why I …" essays. */
const FIRST_PERSON_OPENER =
  /^(?:i['’]m\s|i\s+(?:am|was|have|spent|survived)\b|why\s+i\b|how\s+i\b|my\s+(?:life|year|family|battle)\b)/i;

const ANALYSIS_PREFIX = /^(?:analysis|explainer|in\s+depth|deep\s+dive)\s*[:|—–-]\s/i;
const ANALYSIS_PHRASE = /\bwhat\s+to\s+know\s+about\b/i;

/** Live-blog markers: "Live:" prefix or "live updates" phrasing. */
const LIVE_PREFIX = /^(?:live|watch\s+live)\s*[:|—–-]\s/i;
const LIVE_PHRASE = /\blive\s+updates\b|\blive\s+blog\b/i;

/** True when the title carries a "| Person Name" byline-pipe suffix. */
export function hasBylinePipe(title: string): boolean {
  const match = title.match(BYLINE_PIPE);
  return match !== null && !NOT_A_NAME.test(match[1]);
}

/**
 * Classify an article's editorial content type from its title/description.
 * Precedence: press_release → live → opinion → analysis → news. A release
 * headline can contain "announces" AND look like a label, so wire evidence
 * is checked first. When unsure → "news".
 */
export function classifyContentType(input: ContentTypeInput): ContentType {
  const title = input.title.trim();
  const text = `${title} ${input.description ?? ""}`;

  // Feed origin beats all headline analysis: content ON a distribution
  // platform is a release by definition.
  if (isDistributorDomain(input.sourceDomain)) return "press_release";

  const hasWireMarker = WIRE_MARKERS.some((p) => p.test(text));
  const hasTicker = TICKER_PATTERN.test(text);
  const hasStrongVerb = PR_HEADLINE_VERBS.some((p) => p.test(title));
  if (hasWireMarker || hasStrongVerb || (hasTicker && PR_WEAK_VERBS.test(title))) {
    return "press_release";
  }

  if (LIVE_PREFIX.test(title) || LIVE_PHRASE.test(title)) return "live";

  if (OPINION_PREFIX.test(title)) return "opinion";
  if (FIRST_PERSON_OPENER.test(title)) return "opinion";
  if (hasBylinePipe(title)) return "opinion";

  if (ANALYSIS_PREFIX.test(title) || ANALYSIS_PHRASE.test(title)) return "analysis";

  return "news";
}
