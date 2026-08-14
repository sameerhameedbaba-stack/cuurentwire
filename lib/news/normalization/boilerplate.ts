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
 * A sentence is boilerplate when it *starts* with one of these — sentence-
 * anchored so "Officials asked residents to sign up for alerts" (real news
 * that merely contains the words) is never touched.
 */
const BOILERPLATE_SENTENCE = new RegExp(
  "^(?:" +
    [
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
    ].join("|") +
    ")",
  "i",
);

/** Trailing fragments with no sentence punctuation ("Continue reading…"). */
const TRAILING_FRAGMENT = /(?:continue reading|read more|click here)[\s.…]*$/i;

/**
 * Split into sentences on terminal punctuation. Deliberately simple and
 * deterministic — abbreviation edge cases only risk over-splitting, and a
 * split fragment is dropped only if it independently matches a boilerplate
 * opener.
 */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Strip leading/trailing boilerplate sentences from a description. Interior
 * sentences are also dropped when they match — CMS chrome can be injected
 * mid-description by some feeds. Returns "" when everything was boilerplate.
 */
export function cleanDescription(description: string): string {
  const withoutFragment = description.replace(TRAILING_FRAGMENT, "").trim();
  const kept = splitSentences(withoutFragment).filter(
    (sentence) => !BOILERPLATE_SENTENCE.test(sentence.trim()),
  );
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
