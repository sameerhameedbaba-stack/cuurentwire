import { describe, expect, it } from "vitest";
import {
  articleSimilarity,
  SIMILARITY_THRESHOLD,
  type ArticleFeatures,
} from "@/lib/news/clustering/cluster";
import { extractEntities } from "@/lib/news/classification/entities";
import { bigrams, significantTokens } from "@/lib/utils/text";
import { CLUSTER_PAIRS } from "../fixtures/cluster-pairs";

/**
 * Clustering evaluation over synthetic labeled headline pairs.
 * Merge is predicted when similarity >= SIMILARITY_THRESHOLD; only
 * same_event pairs should merge. Precision/recall are printed so future
 * threshold tuning is measurable against the same fixtures.
 */

function headlineFeatures(title: string): ArticleFeatures {
  const tokens = significantTokens(title);
  return {
    tokens: new Set(tokens),
    pairs: bigrams(tokens),
    entities: new Set(extractEntities(title).map((e) => e.toLowerCase())),
    time: 0,
  };
}

interface EvalStats {
  correct: number;
  total: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

function evaluate(threshold: number): EvalStats {
  const stats: EvalStats = {
    correct: 0,
    total: CLUSTER_PAIRS.length,
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
  };
  for (const pair of CLUSTER_PAIRS) {
    const similarity = articleSimilarity(
      headlineFeatures(pair.a),
      headlineFeatures(pair.b),
    );
    const predictedMerge = similarity >= threshold;
    const actualMerge = pair.label === "same_event";
    if (predictedMerge === actualMerge) stats.correct++;
    if (predictedMerge && actualMerge) stats.truePositives++;
    if (predictedMerge && !actualMerge) stats.falsePositives++;
    if (!predictedMerge && actualMerge) stats.falseNegatives++;
  }
  return stats;
}

describe("clustering evaluation fixtures", () => {
  it("has a meaningful fixture set across all three labels", () => {
    expect(CLUSTER_PAIRS.length).toBeGreaterThanOrEqual(40);
    for (const label of [
      "same_event",
      "related_but_different_event",
      "completely_different",
    ] as const) {
      expect(
        CLUSTER_PAIRS.filter((p) => p.label === label).length,
      ).toBeGreaterThanOrEqual(10);
    }
  });

  it(`reaches >= 0.85 accuracy at the current threshold (${SIMILARITY_THRESHOLD})`, () => {
    const stats = evaluate(SIMILARITY_THRESHOLD);
    const accuracy = stats.correct / stats.total;
    const precision =
      stats.truePositives / Math.max(1, stats.truePositives + stats.falsePositives);
    const recall =
      stats.truePositives / Math.max(1, stats.truePositives + stats.falseNegatives);

    // Recorded so threshold tuning stays measurable run to run.
    console.info(
      `[cluster-eval] threshold=${SIMILARITY_THRESHOLD} ` +
        `accuracy=${accuracy.toFixed(3)} precision=${precision.toFixed(3)} ` +
        `recall=${recall.toFixed(3)} (${stats.correct}/${stats.total} correct)`,
    );

    expect(accuracy).toBeGreaterThanOrEqual(0.85);
    // Never merge unrelated stories: precision matters more than recall here.
    expect(precision).toBeGreaterThanOrEqual(0.85);
  });
});
