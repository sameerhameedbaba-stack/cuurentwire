#!/usr/bin/env tsx
/**
 * Dry-run the slim-relaunch editorial pipeline and print what it WOULD do.
 *
 * Writes nothing, publishes nothing, needs no network and no keys. It exists
 * so the selection gate and the brief can be inspected on real data before
 * anything goes live — which matters doubly right now, because production is
 * paused and nothing can be verified on the live site until it returns.
 *
 *   npx tsx scripts/editorial-preview.ts [--limit N] [--brief SLUG]
 *
 * Source data: whichever dataset the repo has to hand (data/*.json), plus the
 * real Search Console queries in data/gsc-queries.json for keyword targeting.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildBrief, renderBrief } from "@/lib/editorial/brief";
import type { GscQueryRow } from "@/lib/editorial/keywords";
import { reasonTally, selectDaily } from "@/lib/editorial/selection";
import { clusterArticles } from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import { generateMockArticles } from "@/lib/news/providers/mock";
import type { Article, StoryCluster } from "@/lib/news/types";

const root = process.cwd();

function readJson<T>(relativePath: string): T | undefined {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** Pull clusters out of whichever dataset shape the repo currently stores. */
function loadClusters(): { clusters: StoryCluster[]; from: string } {
  const candidates = ["data/dataset.json", "data/news.json", "data/compact.json"];
  for (const candidate of candidates) {
    const raw = readJson<Record<string, unknown>>(candidate);
    if (!raw) continue;
    const clusters = (raw.clusters ?? raw.stories) as StoryCluster[] | undefined;
    if (Array.isArray(clusters) && clusters.length > 0) {
      return { clusters, from: candidate };
    }
  }
  // No stored dataset (the live one is fetched at runtime, so a fresh clone
  // has none). Fall back to the mock provider and run the REAL clustering
  // over it, so the gate is still demonstrated end to end rather than
  // described. Mock outlets are clearly labelled and never published.
  const now = new Date();
  const normalized = generateMockArticles(now)
    .map((raw) => normalizeArticle(raw, now))
    .filter((a): a is Article => a !== null);
  return { clusters: clusterArticles(normalized, now), from: "mock provider (synthetic demo data)" };
}

function loadQueries(): { web: GscQueryRow[]; striking: GscQueryRow[] } {
  const raw = readJson<{ webQueries?: GscQueryRow[]; strikingDistance?: GscQueryRow[] }>(
    "data/gsc-queries.json",
  );
  return { web: raw?.webQueries ?? [], striking: raw?.strikingDistance ?? [] };
}

function main(): void {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf("--limit");
  const briefArg = args.indexOf("--brief");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : undefined;
  const briefSlug = briefArg >= 0 ? args[briefArg + 1] : undefined;

  const { clusters, from } = loadClusters();
  const { web, striking } = loadQueries();

  console.log("CurrentWire — editorial dry run (nothing is written or published)");
  console.log(`Clusters: ${clusters.length} from ${from}`);
  console.log(`Search Console keywords: ${web.length} web queries, ${striking.length} striking-distance`);
  console.log("");

  if (clusters.length === 0) {
    console.log("No dataset in the repo to run against.");
    console.log("This is expected on a fresh clone — the pipeline's own tests cover the logic.");
    return;
  }

  const selection = selectDaily(clusters, limit ? { target: limit } : {});

  console.log(`WOULD PUBLISH (${selection.publish.length}):`);
  for (const [i, story] of selection.publish.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}. [${story.cluster.category}] ${story.cluster.title}`,
    );
    console.log(
      `      ${story.verdict.independentDomains} independent, ` +
        `${story.verdict.freeSources} free to read: ${story.verdict.freeSourceNames.join(", ")}`,
    );
  }
  if (selection.shortfall) console.log(`  (${selection.shortfall})`);
  console.log("");

  console.log(`HELD FOR OWNER (${selection.review.length}):`);
  for (const story of selection.review.slice(0, 10)) {
    console.log(`  - [${story.cluster.category}] ${story.cluster.title}`);
    console.log(`      ${story.verdict.reasons.join(", ")}`);
  }
  if (selection.review.length > 10) {
    console.log(`  … and ${selection.review.length - 10} more`);
  }
  console.log("");

  console.log(`REJECTED ON SOURCING (${selection.rejected.length})`);
  const tally = reasonTally(selection);
  for (const [reason, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${reason}`);
  }
  console.log("");

  const sample =
    selection.publish.find((s) => s.cluster.slug === briefSlug) ??
    selection.review.find((s) => s.cluster.slug === briefSlug) ??
    selection.publish[0] ??
    selection.review[0];

  if (sample) {
    console.log("─".repeat(72));
    console.log("SAMPLE BRIEF — this is what the writing step receives:");
    console.log("─".repeat(72));
    console.log(
      renderBrief(
        buildBrief(sample.cluster, sample.verdict, {
          webQueries: web,
          strikingDistance: striking,
        }),
      ),
    );
  }
}

main();
