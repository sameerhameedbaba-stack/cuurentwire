import { hasBylinePipe } from "@/lib/news/classification/content-type";

/**
 * Publisher boilerplate cleaning for DISPLAY text.
 *
 * RSS descriptions routinely carry calls-to-action appended by the CMS
 * ("Sign up for the Breaking News US email", "Continue reading...") and
 * Guardian-style titles carry a "| Author Name" byline suffix. Both are
 * navigation chrome, not content — they must never reach summaries,
 * JSON-LD descriptions, or ranking prominence.
 *
 * Decision (documented per Stage C): the CLEANED title is the one stored on
 * Article and used everywhere — display, slugs, clustering and search. The
 * byline suffix is an author name, which is noise for headline matching, so
 * a single cleaned title is both simpler and better than keeping two.
 * Content-type detection runs on the RAW title BEFORE this cleaning (the
 * byline pipe itself is an opinion signal — see content-type.ts).
 */

/**
 * Newsletter-digest greetings (The Hill "Welcome to The Hill's Defense &
 * NatSec newsletter", "Click in for more news from The Hill"). Kept as a
 * named list because matching one as the FIRST fragment also switches on
 * leading-chrome mode (see cleanDescription). Keyword-guarded: "Welcome to
 * the new era of flight" has no newsletter keyword and never matches.
 */
const GREETING_OPENERS = [
  "welcome to\\b[^.!?\\n]{0,80}?\\b(?:newsletter|briefing|email)\\b",
  "click in for\\b",
  "you['’]re reading\\b[^.!?\\n]{0,80}?\\b(?:newsletter|briefing)\\b",
];

const GREETING_OPENER = new RegExp("^(?:" + GREETING_OPENERS.join("|") + ")", "i");

/**
 * A sentence is boilerplate when it *starts* with one of these — sentence-
 * anchored so "Officials asked residents to sign up for alerts" (real news
 * that merely contains the words) is never touched.
 */
const BOILERPLATE_SENTENCE = new RegExp(
  "^(?:" +
    [
      ...GREETING_OPENERS,
      "sign up (?:for|to|here)\\b",
      "subscribe to\\b",
      "get (?:our|the|all)\\b[^.!?]*\\b(?:newsletter|email|briefing|updates|headlines)",
      "for (?:more|the latest)\\b[^.!?]*\\b(?:sign up|subscribe|newsletter)",
      "continue reading\\b",
      "read more\\b",
      "read the full (?:story|article)\\b",
      "click here\\b",
      "follow (?:our|the)?\\s*live (?:blog|updates|coverage)\\b",
      "follow live updates\\b",
      "follow us on\\b",
      "download (?:our|the) app\\b",
      "listen to (?:our|the)\\b[^.!?]*\\bpodcast",
      // Guardian image credits leak into RSS descriptions.
      "photograph:",
      "composite:",
      "illustration:",
      // The Hill digest image credit — literal placeholder text, optionally
      // preceded by the © the template renders.
      "(?:©\\s*)?photo credit\\b",
    ].join("|") +
    ")",
  "i",
);

/** Trailing fragments with no sentence punctuation ("Continue reading…"). */
const TRAILING_FRAGMENT = /(?:continue reading|read more|click here)[\s.…]*$/i;

/**
 * Unexpanded email-template tokens ("{beacon}") in newsletter digests piped
 * into RSS. Lowercase identifier only, so JSON-ish prose braces (spaces,
 * quotes, capitals inside) never match. Replaced with a newline: removes the
 * token AND leaves a block boundary the sentence splitter can anchor on.
 */
const PLACEHOLDER_TOKEN = /\{[a-z][a-z0-9_-]{1,23}\}/g;

/**
 * Newsletter templates separate layout sections with typographic spaces —
 * figure/punctuation/thin/hair (U+2007–U+200A) and zero-width (U+200B) —
 * that are invisible to ASCII whitespace handling, so chrome and content
 * fuse into one "sentence". Any whitespace run containing one is a layout
 * boundary. U+200B is not matched by \s, hence the explicit class below.
 */
const EXOTIC_SPACE = /[\u2007\u2008\u2009\u200A\u200B]/;
const WHITESPACE_RUN = /[\s\u200B]+/g;

/**
 * Section-header echo left at the start of the first real fragment after a
 * newsletter greeting ("The Big Story  Amid reports…"). Seeded from observed
 * The Hill fixtures only; applied solely in leading-chrome mode.
 */
const LEADING_HEADER_PREFIX = /^the big (?:story|picture)\b[\s:–—-]*/i;

/**
 * Leading-chrome mode drops short unpunctuated header echoes ("Defense
 * &National Security") only this deep into the fragment list — real body
 * text further in is never at risk.
 */
const LEADING_CHROME_MAX_FRAGMENTS = 4;
const LEADING_CHROME_MAX_LENGTH = 60;

/**
 * Publisher-specific chrome that can arrive WITHOUT block markup (flat text
 * in plain feeds and pre-fix archived summaries), where no boundary exists
 * for the sentence-anchored rules to anchor on. Guardian only — the breadth
 * scan found zero live hits for other publishers; no speculative patterns.
 */
const DOMAIN_BOILERPLATE: ReadonlyArray<{ domain: RegExp; pattern: RegExp }> = [
  {
    domain: /(?:^|\.)theguardian\.com$/,
    pattern: /sign up for (?:the )?[^.!?\n]{0,60}?(?:email|newsletter)\b[.!]?/gi,
  },
];

/**
 * Split into sentences on terminal punctuation and on newlines — stripHtml
 * preserves HTML block boundaries as newlines, and a block boundary IS a
 * sentence boundary even without punctuation (live-blog standfirsts and
 * <li> chrome rarely carry any). Deliberately simple and deterministic —
 * abbreviation edge cases only risk over-splitting, and a split fragment is
 * dropped only if it independently matches a boilerplate opener.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\s*\n\s*/)
    .filter((s) => s.trim().length > 0);
}

/**
 * Strip leading/trailing boilerplate sentences from a description. Interior
 * sentences are also dropped when they match — CMS chrome can be injected
 * mid-description by some feeds. Returns "" when everything was boilerplate.
 * When the article's sourceDomain is known, that publisher's DOMAIN_BOILERPLATE
 * patterns are additionally stripped anywhere in the text (chrome without
 * block markup). Idempotent: safe to re-apply to already-clean text.
 *
 * Newsletter digests (The Hill) arrive as flat CDATA: no block markup, no
 * terminal punctuation, sections separated only by template tokens and
 * typographic spaces. Those separators are converted to newline boundaries
 * first, so the sentence-anchored rules can see the chrome; a matched
 * greeting opener as the FIRST fragment then enables leading-chrome mode,
 * which additionally drops the short unpunctuated section-header echoes that
 * follow it. Normal descriptions never enter this mode.
 */
export function cleanDescription(description: string, sourceDomain?: string): string {
  let text = description;
  const domain = sourceDomain?.toLowerCase().replace(/^www\./, "");
  if (domain) {
    for (const rule of DOMAIN_BOILERPLATE) {
      if (rule.domain.test(domain)) {
        text = text.replace(rule.pattern, " ").replace(/[ \t]{2,}/g, " ");
      }
    }
  }
  text = text.replace(PLACEHOLDER_TOKEN, "\n").replace(WHITESPACE_RUN, (run) =>
    // A whitespace run is a layout boundary when it contains a typographic
    // space, or an nbsp NEXT TO other whitespace — a lone nbsp inside a
    // sentence ("10 000") is real content and stays.
    EXOTIC_SPACE.test(run) || (run.length > 1 && run.includes("\u00A0"))
      ? "\n"
      : run,
  );
  const withoutFragment = text.replace(TRAILING_FRAGMENT, "").trim();
  const fragments = splitSentences(withoutFragment);
  let leadingChrome =
    fragments.length > 0 && GREETING_OPENER.test(fragments[0].trim());
  const kept: string[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i].trim();
    if (BOILERPLATE_SENTENCE.test(fragment)) continue;
    if (leadingChrome) {
      if (
        i < LEADING_CHROME_MAX_FRAGMENTS &&
        fragment.length <= LEADING_CHROME_MAX_LENGTH &&
        !/[.!?…]/.test(fragment)
      ) {
        continue; // section-header echo between greeting and body
      }
      const unprefixed = fragment.replace(LEADING_HEADER_PREFIX, "").trim();
      if (!unprefixed) continue;
      leadingChrome = false;
      kept.push(unprefixed);
      continue;
    }
    kept.push(fragment);
  }
  return kept.join(" ").trim();
}

/**
 * Strip a trailing "| Author Name" byline-pipe suffix from a title for
 * display. Only fires when the suffix reads as a person's name (see
 * hasBylinePipe) — section labels like "| Premier League" are preserved.
 * Falls back to the original title if stripping would leave a stub.
 */
export function cleanDisplayTitle(title: string): string {
  if (!hasBylinePipe(title)) return title.trim();
  const stripped = title.replace(/\s*\|[^|]*$/, "").trim();
  return stripped.length >= 8 ? stripped : title.trim();
}
