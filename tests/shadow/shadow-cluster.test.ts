import { existsSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildClusterContext,
  decidePair,
} from "@/lib/news/clustering/cluster";
import { sharedRareStems } from "@/lib/news/clustering/fingerprint";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import type { Article, RawArticle } from "@/lib/news/types";
import { CLUSTER_PAIRS } from "../fixtures/cluster-pairs";
import { cosine, embedAll, MINILM_MODEL } from "../../scripts/intelligence/minilm";

/**
 * SHADOW-MODE clustering evaluation (Intelligence Layer v2, Phase C).
 *
 * The deterministic engine keeps its verdict for every pair; pairs it
 * REFUSES to merge but that carry deterministic evidence (>=1 shared rare
 * stem — the §41 requirement that semantic-only blind merges are never
 * allowed) enter the ambiguous zone, where embedding cosine similarity
 * proposes same_event. Reports deterministic vs hybrid precision/recall
 * across a threshold sweep. Never touches production behavior.
 *
 * Run: SHADOW_EVAL=1 npx vitest run tests/shadow/shadow-cluster.test.ts
 */

const REPORT_PATH = "data/local/shadow-cluster-report.json";
const enabled = process.env.SHADOW_EVAL === "1" && existsSync("data/local");

const NOW = new Date("2026-08-13T12:00:00Z");

function evalArticle(title: string, index: number): Article {
  const raw: RawArticle = {
    title,
    url: `https://outlet-${index}.example.com/story-${index}`,
    source: `outlet-${index}.example.com`,
    publishedAt: NOW.toISOString(),
    provider: "test",
  };
  const article = normalizeArticle(raw, NOW);
  if (!article) throw new Error(`failed: ${title}`);
  return article;
}

describe.skipIf(!enabled)("shadow: semantic clustering vs 491-pair benchmark", () => {
  it("evaluates hybrid precision/recall on the ambiguous zone", async () => {
    const titles = [...new Set(CLUSTER_PAIRS.flatMap((pair) => [pair.a, pair.b]))];
    const ctx = buildClusterContext(titles.map(evalArticle));
    const index = new Map(titles.map((t, i) => [t, i] as const));

    const started = Date.now();
    const vectors = await embedAll(titles);
    const embedMs = Date.now() - started;

    interface PairEval {
      label: string;
      detMerge: boolean;
      inZone: boolean;
      cosine: number;
    }
    const evals: PairEval[] = CLUSTER_PAIRS.map((pair) => {
      const i = index.get(pair.a)!;
      const j = index.get(pair.b)!;
      const det = decidePair(ctx, i, j).merge;
      // Ambiguous zone: deterministic refusal WITH deterministic evidence.
      const evidence = sharedRareStems(ctx.prints[i], ctx.prints[j], ctx.stats).length >= 1;
      return {
        label: pair.label,
        detMerge: det,
        inZone: !det && evidence,
        cosine: cosine(vectors[i], vectors[j]),
      };
    });

    function metrics(mergeFn: (e: PairEval) => boolean) {
      let tp = 0;
      let fp = 0;
      let fn = 0;
      for (const e of evals) {
        const merged = mergeFn(e);
        const same = e.label === "SAME_EVENT";
        if (merged && same) tp++;
        else if (merged && !same) fp++;
        else if (!merged && same) fn++;
      }
      const precision = tp / Math.max(1, tp + fp);
      const recall = tp / Math.max(1, tp + fn);
      return {
        tp,
        fp,
        fn,
        precision: +precision.toFixed(3),
        recall: +recall.toFixed(3),
        f1: +((2 * precision * recall) / Math.max(1e-9, precision + recall)).toFixed(3),
      };
    }

    const detOnly = metrics((e) => e.detMerge);
    const sweep = [0.7, 0.75, 0.8, 0.82, 0.85, 0.88, 0.9, 0.92].map((threshold) => ({
      threshold,
      zoneMerges: evals.filter((e) => e.inZone && e.cosine >= threshold).length,
      ...metrics((e) => e.detMerge || (e.inZone && e.cosine >= threshold)),
    }));

    // Distribution insight: how separable are the zone's SAME vs non-SAME?
    const zone = evals.filter((e) => e.inZone);
    const dist = (label: string) => {
      const values = zone
        .filter((e) => (label === "SAME_EVENT" ? e.label === label : e.label !== "SAME_EVENT"))
        .map((e) => e.cosine)
        .sort((a, b) => a - b);
      const q = (f: number) => values[Math.min(values.length - 1, Math.floor(f * values.length))];
      return values.length
        ? { n: values.length, p25: +q(0.25).toFixed(3), median: +q(0.5).toFixed(3), p75: +q(0.75).toFixed(3) }
        : { n: 0 };
    };

    const report = {
      generatedAt: new Date().toISOString(),
      provider: "local-minilm",
      model: MINILM_MODEL,
      pairs: CLUSTER_PAIRS.length,
      ambiguousZone: zone.length,
      embedTimeMs: embedMs,
      deterministicOnly: detOnly,
      zoneCosineSameEvent: dist("SAME_EVENT"),
      zoneCosineNotSame: dist("OTHER"),
      hybridSweep: sweep,
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    process.stdout.write(
      `[shadow-cluster] pairs=${report.pairs} zone=${zone.length} embed=${embedMs}ms\n` +
        `[shadow-cluster] deterministic-only: P=${detOnly.precision} R=${detOnly.recall} F1=${detOnly.f1}\n` +
        `[shadow-cluster] zone cosine SAME: ${JSON.stringify(report.zoneCosineSameEvent)}\n` +
        `[shadow-cluster] zone cosine other: ${JSON.stringify(report.zoneCosineNotSame)}\n`,
    );
    for (const row of sweep) {
      process.stdout.write(
        `[shadow-cluster] hybrid@${row.threshold}: P=${row.precision} R=${row.recall} ` +
          `F1=${row.f1} zoneMerges=${row.zoneMerges} (FP=${row.fp})\n`,
      );
    }

    expect(CLUSTER_PAIRS.length).toBeGreaterThan(450);
  }, 600_000);
});
