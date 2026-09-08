/**
 * Pure aggregation for the classifier orphan-rate instrument
 * (scripts/general-orphan-rate.mjs). Kept separate so the parsing and the
 * arithmetic are unit-testable without fetching production —
 * tests/unit/general-orphan-rate.test.ts.
 *
 * WHAT IS BEING MEASURED, and why it is not the benchmark number.
 *
 * `general` is the classifier's abstention bucket. `/general` is
 * `noindex, nofollow` on purpose (config/categories.ts keeps it out of
 * NAV_CATEGORIES), so a story routed there appears on NO indexable
 * category page at all: it loses the category listing, the category's
 * internal-link path, and the topical grouping `articleSection` is supposed
 * to give it. That is the ORPHAN in the name — seo/BACKLOG.md item 6.
 *
 * Two different quantities have been reported as "the general rate" in this
 * repo, and conflating them cost a run:
 *
 *  - The BENCHMARK rate — 109 of 313 (34.8%) in data/benchmark-history.json.
 *    That is `classifyCategory` re-run over a frozen, manually validated
 *    corpus. It is deterministic, it is the DESIGNED precision-over-recall
 *    abstention rate, and it does not move unless the classifier changes.
 *  - The LIVE rate — the share of stories currently published on the site
 *    whose `articleSection` is General. That is what actually costs
 *    indexable placement, and it moves with the news mix every day.
 *
 * On 2026-08-25 the live rate read 3 of 22 (14%); on 2026-08-26 it read
 * 9 of 40 (23%) and had to be checked against the benchmark's 34.8% before
 * anyone could say whether either was a regression. Neither reading could
 * settle it, because at n=22 a 14% reading and a 34.8% truth are about one
 * standard error apart. This instrument exists to end that: it reads the
 * WHOLE live news-sitemap corpus rather than a sample, so the live figure
 * carries no sampling error at all, and it appends one row per run so the
 * next classifier change is judged against a series instead of one day.
 *
 * It is an INSTRUMENT, not a gate. It has no threshold and never fails on a
 * high rate — a gate that fires on the designed value hides the bug it was
 * built to find (seo/MEMORY/2026-08-31-a-gate-that-fails-on-design-hides-the-bug.md).
 * The only failure it reports is a failure to MEASURE.
 */

/** Section id the classifier assigns when it declines to pick one. */
export const ORPHAN_SECTION = "general";

/**
 * How many of the sampled pages must yield a readable `articleSection`
 * before the run's numbers mean anything. Below this the corpus was not
 * measured, and reporting a percentage over whatever did answer would be a
 * rate over an unknown denominator.
 */
export const MIN_READ_RATIO = 0.9;

/** `<loc>` values from a sitemap, in document order, deduplicated. */
export function sitemapLocs(xml) {
  const seen = new Set();
  for (const match of String(xml ?? "").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    seen.add(match[1].trim());
  }
  return [...seen];
}

/**
 * `articleSection` from a story page's NewsArticle JSON-LD, or null.
 *
 * Every block is JSON.parse'd; the field is never pulled out with a regex.
 * On 2026-09-08 a regex written to read a `content="..."` attribute ran
 * past the closing quote and reported two section descriptions as over the
 * meta-description ceiling when they were inside it. A greedy match on
 * structured data is the same mistake with a worse blast radius, because
 * this figure is meant to decide whether the classifier gets changed.
 *
 * A page may carry several blocks (NewsArticle + BreadcrumbList), and a
 * block may be an array or a @graph. Unparseable blocks are skipped, not
 * fatal: one malformed block on one page must not decide the corpus.
 */
export function articleSectionFrom(html) {
  const blocks = String(html ?? "").matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );
  for (const [, raw] of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const type = node["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes("NewsArticle")) continue;
      const section = node.articleSection;
      if (typeof section === "string" && section.trim()) return section.trim();
    }
  }
  return null;
}

/**
 * Fold the per-URL readings into one run row.
 *
 * `readings` are `{ url, section }`, where `section` is null for a page that
 * could not be read. `attempted` is how many URLs the corpus held, so a run
 * that dropped pages cannot silently shrink its own denominator.
 *
 * `orphanPct` is a share of the pages that WERE read, and `readPct` is
 * published beside it so the two are never separated. Sections are compared
 * case-insensitively — the JSON-LD carries "General" and the config id is
 * "general" — and reported under the config's lowercase id.
 *
 * @param {{ url?: string, section: string | null }[]} readings
 * @param {number} [attempted]
 */
export function summarizeSections(readings, attempted = readings.length) {
  const counts = new Map();
  let read = 0;
  for (const reading of readings) {
    if (!reading?.section) continue;
    read += 1;
    const id = reading.section.toLowerCase();
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const orphans = counts.get(ORPHAN_SECTION) ?? 0;
  const sections = [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    // Ties broken by id so two runs over one corpus can never disagree on
    // the printed order.
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return {
    attempted,
    read,
    unread: attempted - read,
    readPct: attempted > 0 ? round1((read / attempted) * 100) : 0,
    orphans,
    // A percentage over zero readable pages is not 0%, it is unknown. Null
    // says so; a caller that prints it must print "unknown", not "0.0".
    generalOrphanPct: read > 0 ? round1((orphans / read) * 100) : null,
    sections,
    measured: attempted > 0 && read / attempted >= MIN_READ_RATIO,
  };
}

/** One decimal place, the precision the corpus size can actually support. */
function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Append one run to the history series.
 *
 * Keyed on `measuredAt` so a re-run at a different time on the same day
 * adds a row rather than overwriting one: the live rate moves with the news
 * mix through the day, and two readings hours apart are two facts, not a
 * correction of one. An unmeasured run is NOT appended — a row whose
 * denominator is unknown would pollute every future comparison, which is
 * exactly how a proxy gets into a series and stays there.
 *
 * @param {Record<string, unknown>[] | null | undefined} history
 * @param {Record<string, unknown> & { measuredAt?: string, measured?: boolean }} row
 */
export function appendHistory(history, row) {
  const rows = Array.isArray(history) ? [...history] : [];
  if (!row?.measured) return rows;
  const index = rows.findIndex((existing) => existing?.measuredAt === row.measuredAt);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  return rows.sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)));
}

/**
 * The previous measured row, for a run-over-run delta. Returns null when
 * there is no prior row — the first run reports a level, not a change, and
 * inventing a delta against nothing is how a series starts lying.
 *
 * @param {{ measuredAt?: string, generalOrphanPct?: number | null, measured?: boolean }[] | null | undefined} history
 * @param {string} measuredAt
 */
export function previousRow(history, measuredAt) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((row) => row?.measured && String(row.measuredAt) < String(measuredAt))
    .sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)));
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

/**
 * Human report. Prints the denominator on every line that carries a rate.
 *
 * `outcomes` is an optional tally of what the unread pages actually did
 * (`{ "http 500": 4, "TimeoutError": 12 }`). It is printed only on the
 * NOT MEASURED path, and it is there because the first live run of this
 * instrument reported "153 of 727" with no way to tell a cold ISR cache
 * from a rate limit from a broken parser — three causes with three
 * different responses. A vague error is a hiding place
 * (seo/MEMORY/2026-08-26-a-vague-error-is-a-hiding-place.md).
 *
 * @param {ReturnType<typeof summarizeSections>} summary
 * @param {{ measuredAt?: string, generalOrphanPct?: number | null, measured?: boolean } | null} [previous]
 * @param {Record<string, number> | null} [outcomes]
 */
export function formatOrphanReport(summary, previous = null, outcomes = null) {
  const lines = [];
  if (!summary.measured) {
    lines.push(
      `NOT MEASURED: only ${summary.read} of ${summary.attempted} story pages ` +
        `yielded an articleSection (${summary.readPct}%, floor ${MIN_READ_RATIO * 100}%).`,
    );
    const tally = Object.entries(outcomes ?? {}).sort((a, b) => b[1] - a[1]);
    if (tally.length > 0) {
      lines.push("what the unread pages did:");
      for (const [outcome, count] of tally) lines.push(`  ${outcome}: ${count}`);
    }
    lines.push("No rate is reported and no history row was written.");
    return lines.join("\n");
  }
  lines.push(
    `generalOrphanPct: ${summary.generalOrphanPct}% ` +
      `— ${summary.orphans} general of ${summary.read} story pages read ` +
      `(${summary.unread} unread of ${summary.attempted} in the corpus)`,
  );
  if (previous?.generalOrphanPct != null) {
    const delta = round1(summary.generalOrphanPct - previous.generalOrphanPct);
    const sign = delta > 0 ? "+" : "";
    lines.push(
      `previous: ${previous.generalOrphanPct}% at ${previous.measuredAt} ` +
        `(${sign}${delta} pts)`,
    );
  } else {
    lines.push("previous: none — this is the first measured row in the series.");
  }
  lines.push("");
  lines.push("sections, most-filed first:");
  for (const section of summary.sections) {
    const pct = round1((section.count / summary.read) * 100);
    const mark = section.id === ORPHAN_SECTION ? " <- orphan bucket, noindex" : "";
    lines.push(`  ${section.id.padEnd(14)} ${String(section.count).padStart(4)}  ${pct}%${mark}`);
  }
  return lines.join("\n");
}
