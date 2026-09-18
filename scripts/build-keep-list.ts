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
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_RETIREMENT_POLICY,
  planRetirement,
  type UrlSignals,
} from "@/lib/editorial/retirement";

const root = process.cwd();
const SIGNALS = resolve(root, "data/gsc-url-signals.json");
const OUT = resolve(root, "data/story-keep-list.json");

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
