#!/usr/bin/env tsx
/**
 * Regenerate data/story-keep-list.json from data/gsc-url-signals.json.
 *
 *   npx tsx scripts/build-keep-list.ts [--min-impressions N] [--min-clicks N]
 *
 * The keep-list is the allowlist of retired-corpus URLs that stay reachable
 * when STORY_RETIREMENT is switched on. Everything not on it answers 410.
 *
 * Re-run this whenever gsc-url-signals.json is refreshed AND before the switch
 * is flipped — a stale keep-list retires URLs that have since started earning.
 * It is committed rather than computed at request time so the middleware needs
 * no I/O.
 *
 * ── IT REFUSES OUTAGE-CONTAMINATED WINDOWS ─────────────────────────────────
 * A URL earns no impressions while the site answers 402, and that is a fact
 * about the outage, not about the URL. Building the keep-list from a window
 * that overlaps a recorded outage would permanently 410 pages purely because
 * production was down while they were measured.
 *
 * This is not hypothetical. On 2026-09-28, 14 days into the Hobby pause, the
 * refreshed 28-day window (Sep 1-28) reported 5 stories and 13 impressions,
 * against 383 stories and 1,166 impressions in the pre-outage window ending
 * Sep 14. Rebuilding from it would have cut the keep-list from 123 URLs to 2.
 *
 * So the script cross-checks the signal window against the outages recorded in
 * data/incidents.json and exits without writing if they overlap. `--force`
 * overrides, and should only be used when you can say why the window is sound.
 * See seo/MEMORY/2026-08-21-an-outage-is-not-a-fact-about-the-world.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_RETIREMENT_POLICY,
  MAX_OUTAGE_FRACTION,
  outageCoverage,
  planRetirement,
  type OutageRecord,
  type UrlSignals,
} from "@/lib/editorial/retirement";

const root = process.cwd();
const SIGNALS = resolve(root, "data/gsc-url-signals.json");
const INCIDENTS = resolve(root, "data/incidents.json");
const OUT = resolve(root, "data/story-keep-list.json");

function readIncidents(): OutageRecord[] {
  try {
    return JSON.parse(readFileSync(INCIDENTS, "utf8")) as OutageRecord[];
  } catch {
    return [];
  }
}

function numberArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function main(): void {
  const raw = JSON.parse(readFileSync(SIGNALS, "utf8")) as {
    generatedAt?: string;
    window?: { startDate: string; endDate: string; days: number };
    stories?: UrlSignals;
  };
  const signals = raw.stories ?? {};

  const policy = {
    minImpressions: numberArg("--min-impressions", DEFAULT_RETIREMENT_POLICY.minImpressions),
    minClicks: numberArg("--min-clicks", DEFAULT_RETIREMENT_POLICY.minClicks),
  };

  // Refuse to turn an outage into a permanent retirement decision.
  const window = raw.window;
  if (window && !process.argv.includes("--force")) {
    const coverage = outageCoverage(window, readIncidents());
    if (coverage.fraction > MAX_OUTAGE_FRACTION) {
      const pct = Math.round(coverage.fraction * 100);
      console.error(
        `REFUSING to rebuild the keep-list.\n\n` +
          `  signal window : ${window.startDate}..${window.endDate} ` +
          `(${coverage.windowDays} days)\n` +
          `  dark days     : ${coverage.darkDays} (${pct}%), limit ` +
          `${Math.round(MAX_OUTAGE_FRACTION * 100)}%\n`,
      );
      for (const outage of coverage.outages) {
        const span = outage.ongoing ? "ongoing" : (outage.end ?? outage.date);
        console.error(`  - ${outage.date} .. ${span}: ${outage.label ?? outage.kind}`);
      }
      console.error(
        `\nA URL earns nothing while production is down; that says nothing about\n` +
          `the URL. Rebuilding from this window would retire pages for being\n` +
          `unreachable. Wait for a window measured while the site was serving.\n` +
          `${OUT} is unchanged.\n` +
          `Override with --force only if you can say why this window is sound.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const plan = planRetirement(signals, policy);

  const output = {
    generatedAt: new Date().toISOString(),
    // Provenance, so a future run can tell whether this list is stale.
    signalsGeneratedAt: raw.generatedAt ?? null,
    signalWindow: raw.window ?? null,
    policy: plan.policy,
    keptCount: plan.keptCount,
    droppedCount: plan.droppedCount,
    impressionsRetained: plan.impressionsRetained,
    impressionsTotal: plan.impressionsTotal,
    keep: plan.keep,
  };

  writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);

  const pct = plan.impressionsTotal
    ? Math.round((100 * plan.impressionsRetained) / plan.impressionsTotal)
    : 0;
  console.log(`Wrote ${OUT}`);
  console.log(`  policy: >=${policy.minImpressions} impressions or >=${policy.minClicks} click(s)`);
  console.log(`  keeping ${plan.keptCount} URLs, dropping ${plan.droppedCount} that earned something`);
  console.log(`  retains ${plan.impressionsRetained}/${plan.impressionsTotal} impressions (${pct}%)`);
  console.log(`  every story with no signal entry at all is retired by omission`);
}

main();
