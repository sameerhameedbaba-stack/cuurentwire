import { describe, expect, it } from "vitest";
import {
  buildClusterContext,
  clusterArticles,
  decidePair,
} from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import type { Article, RawArticle } from "@/lib/news/types";
import {
  CLUSTER_PAIRS,
  MISSIONARY_TRIO,
  type ClusterPair,
} from "../fixtures/cluster-pairs";

/**
 * Clustering evaluation at the PRODUCTION decision rule.
 *
 * Every pair is judged by decidePair — the exact function clusterArticles
 * uses — over a corpus built from ALL fixture headlines, so IDF token
 * rarity behaves like a real ingestion run. Precision, recall and F1 for
 * SAME_EVENT detection are printed every run and asserted:
 *   precision >= 0.95  (never merge different stories)
 *   recall    >= 0.85  (reworded coverage of one event must merge)
 *
 * A handful of fixture pairs are deliberately outside what headline-level
 * evidence can decide (e.g. treaty signing vs ratification debate); the
 * aggregate bars, not per-pair perfection, are the contract. The missionary
 * trio is the exception: those three pairs are individual MUST-MERGE
 * acceptance cases (the audit's live failure).
 */

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
  if (!article) throw new Error(`fixture headline failed to normalize: ${title}`);
  return article;
}

// Corpus = every unique fixture headline (headlines reused across pairs
// count once, like a deduped ingestion run).
const titles = [...new Set(CLUSTER_PAIRS.flatMap((pair) => [pair.a, pair.b]))];
const ctx = buildClusterContext(titles.map(evalArticle));
const titleIndex = new Map(titles.map((title, i) => [title, i] as const));

interface Prediction {
  pair: ClusterPair;
  merge: boolean;
}

const predictions: Prediction[] = CLUSTER_PAIRS.map((pair) => ({
  pair,
  merge: decidePair(ctx, titleIndex.get(pair.a)!, titleIndex.get(pair.b)!).merge,
}));

describe("cluster-pairs fixture set", () => {
  it("has 200+ pairs with meaningful coverage of all three labels", () => {
    expect(CLUSTER_PAIRS.length).toBeGreaterThanOrEqual(200);
    const count = (label: ClusterPair["label"]) =>
      CLUSTER_PAIRS.filter((pair) => pair.label === label).length;
    // Heavy on reworded same-event pairs, per the audit.
    expect(count("SAME_EVENT")).toBeGreaterThanOrEqual(80);
    expect(count("RELATED_EVENT")).toBeGreaterThanOrEqual(50);
    expect(count("DIFFERENT_EVENT")).toBeGreaterThanOrEqual(50);
  });
});

describe("SAME_EVENT detection at the production decision rule", () => {
  it("reaches precision >= 0.95 and recall >= 0.85", () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    const misses: string[] = [];
    for (const { pair, merge } of predictions) {
      const actual = pair.label === "SAME_EVENT";
      if (merge && actual) tp++;
      else if (merge && !actual) {
        fp++;
        misses.push(`  FP [${pair.label}] "${pair.a}" | "${pair.b}"`);
      } else if (!merge && actual) {
        fn++;
        misses.push(`  FN [${pair.label}] "${pair.a}" | "${pair.b}"`);
      }
    }
    const precision = tp / Math.max(1, tp + fp);
    const recall = tp / Math.max(1, tp + fn);
    const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);

    // process.stdout.write so precision/recall/F1 show on EVERY run (vitest
    // hides console.log from passing tests) — future threshold changes stay
    // measurable against the same fixtures.
    process.stdout.write(
      `[cluster-eval] pairs=${CLUSTER_PAIRS.length} precision=${precision.toFixed(3)} ` +
        `recall=${recall.toFixed(3)} f1=${f1.toFixed(3)} (TP=${tp} FP=${fp} FN=${fn})\n`,
    );
    for (const miss of misses) process.stdout.write(`${miss}\n`);

    expect(precision).toBeGreaterThanOrEqual(0.95);
    expect(recall).toBeGreaterThanOrEqual(0.85);
  });

  it("merges every MUST-MERGE acceptance pair (the missionary trio)", () => {
    const mustMerge = predictions.filter(({ pair }) => pair.mustMerge);
    expect(mustMerge.length).toBeGreaterThanOrEqual(3);
    for (const { pair, merge } of mustMerge) {
      expect(merge, `must merge: "${pair.a}" | "${pair.b}"`).toBe(true);
    }
  });
});

describe("clusterArticles end-to-end on the audit trio", () => {
  const make = (
    title: string,
    description: string,
    domain: string,
    minutesAgo: number,
  ): Article => {
    const raw: RawArticle = {
      title,
      description,
      url: `https://${domain}/story-${minutesAgo}`,
      source: domain,
      publishedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
      provider: "test",
    };
    const article = normalizeArticle(raw, NOW);
    if (!article) throw new Error(`failed to normalize: ${title}`);
    return article;
  };

  const articles = [
    make(
      MISSIONARY_TRIO[0],
      "An American missionary abducted in Niger last year has been released, according to the organization he works with.",
      "npr.org",
      30,
    ),
    make(
      MISSIONARY_TRIO[1],
      "A Christian organization says a US missionary has been freed after being kidnapped in Niger.",
      "bbc.com",
      25,
    ),
    make(
      MISSIONARY_TRIO[2],
      "The missionary organization said the American who was kidnapped in Niger in October has been freed.",
      "cbsnews.com",
      20,
    ),
    // Clearly different stories that must remain apart — including
    // same-entity near-misses (one team two matches, one governor two bills).
    make(
      "Riverton Rangers beat Harbor City Falcons in season opener",
      "The Rangers opened their season with a home win over the Falcons.",
      "outlet-d.com",
      60,
    ),
    make(
      "Riverton Rangers beat Lakeside Comets in overtime",
      "The Rangers needed overtime to get past the Comets on the road.",
      "outlet-e.com",
      40,
    ),
    make(
      "Governor Hale vetoes school funding bill after weeks of debate",
      "The governor rejected the school funding measure passed by lawmakers.",
      "outlet-f.com",
      90,
    ),
    make(
      "Governor Hale vetoes housing construction bill",
      "The governor turned back a housing construction measure on Friday.",
      "outlet-g.com",
      45,
    ),
    make(
      "Stock markets close mixed as investors weigh earnings reports",
      "Markets ended the day mixed.",
      "outlet-h.com",
      100,
    ),
  ];

  it("forms ONE cluster from the trio with sourceCount 3, everything else apart", () => {
    const clusters = clusterArticles(articles, NOW);
    const missionary = clusters.filter((c) =>
      c.articles.some((a) => a.title.toLowerCase().includes("missionary")),
    );
    expect(missionary).toHaveLength(1);
    expect(missionary[0].articles).toHaveLength(3);
    expect(missionary[0].sourceCount).toBe(3);

    // 8 articles -> 1 trio cluster + 5 singletons.
    expect(clusters).toHaveLength(6);
    for (const cluster of clusters) {
      if (cluster !== missionary[0]) expect(cluster.articles).toHaveLength(1);
    }
  });
});
