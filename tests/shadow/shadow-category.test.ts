import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, type CategoryId } from "@/config/categories";
import { classifyCategory } from "@/lib/news/classification/category";
import {
  needsSemanticCategory,
  resolveCategory,
  semanticConfig,
  type SemanticCategoryResult,
} from "@/lib/intelligence/semantic";
import { categoryFixtures } from "../fixtures/classification-fixtures";
import { cosine, embedAll, MINILM_MODEL } from "../../scripts/intelligence/minilm";

/**
 * SHADOW-MODE category evaluation (Intelligence Layer v2, Phase B).
 *
 * Runs the semantic fallback (local MiniLM embeddings + kNN over labeled
 * references) on the ambiguous slice of the manually validated
 * real-production benchmark and reports deterministic-only vs hybrid
 * accuracy. Never touches production behavior.
 *
 * Auto-skips when the local benchmark data (data/local/, gitignored — real
 * headlines stay out of the public repo) is absent, e.g. in CI.
 *
 * Run: npx vitest run tests/shadow/shadow-category.test.ts
 */

const STORIES_PATH = "data/local/real-stories.json";
const TRUTH_PATH = "data/local/truth.tsv";
const REPORT_PATH = "data/local/shadow-category-report.json";
const enabled =
  process.env.SHADOW_EVAL === "1" &&
  existsSync(STORIES_PATH) &&
  existsSync(TRUTH_PATH);

interface RealStory {
  title: string;
  description: string;
}

describe.skipIf(!enabled)("shadow: semantic category vs real benchmark", () => {
  it("evaluates hybrid accuracy against the manually validated truth set", async () => {
    const stories = JSON.parse(readFileSync(STORIES_PATH, "utf-8")) as RealStory[];
    const truth = new Map<number, string>();
    for (const line of readFileSync(TRUTH_PATH, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      const [n, label] = line.split("\t");
      truth.set(Number(n), label.trim());
    }

    // Deterministic predictions + ambiguity gate.
    const det = stories.map((s) =>
      classifyCategory({ title: s.title, description: s.description || undefined }),
    );
    const gated = det.map((d) => needsSemanticCategory(d));

    // Reference set for kNN: labeled fixtures + the real benchmark rows
    // themselves (leave-one-out below prevents self-matching leakage).
    const refTexts = [
      ...categoryFixtures.map((f) => `${f.title} ${f.description ?? ""}`.trim()),
      ...stories.map((s) => `${s.title} ${s.description}`.trim()),
    ];
    const refLabels: string[] = [
      ...categoryFixtures.map((f) => f.expectedCategory as string),
      ...stories.map((_, i) => truth.get(i + 1) ?? "general"),
    ];
    const fixtureCount = categoryFixtures.length;

    const started = Date.now();
    const vectors = await embedAll(refTexts);
    const embedMs = Date.now() - started;
    const storyVec = (i: number) => vectors[fixtureCount + i];

    const K = 8;
    function knn(i: number): SemanticCategoryResult {
      const me = storyVec(i);
      const neighbors: { label: string; sim: number }[] = [];
      for (let r = 0; r < vectors.length; r++) {
        if (r === fixtureCount + i) continue; // leave-one-out
        neighbors.push({ label: refLabels[r], sim: cosine(me, vectors[r]) });
      }
      neighbors.sort((a, b) => b.sim - a.sim);
      const top = neighbors.slice(0, K);
      const votes = new Map<string, number>();
      let total = 0;
      for (const n of top) {
        const w = Math.max(0, n.sim);
        votes.set(n.label, (votes.get(n.label) ?? 0) + w);
        total += w;
      }
      const [label, weight] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        category: (CATEGORY_IDS as readonly string[]).includes(label)
          ? (label as CategoryId)
          : "general",
        confidence: total > 0 ? weight / total : 0,
        reasonCode: "knn_labeled_neighbors",
        provider: "local-minilm",
        model: MINILM_MODEL,
      };
    }

    const semantic = stories.map((_, i) => (gated[i] ? knn(i) : null));

    // Metrics at the configured override rule (§39: general-only override)
    // plus a threshold sweep for calibration.
    const config = semanticConfig();
    function evaluate(threshold: number) {
      let exact = 0;
      let wrongSpecific = 0;
      let generalCount = 0;
      let overrides = 0;
      let overridesCorrect = 0;
      for (let i = 0; i < stories.length; i++) {
        const resolved = resolveCategory(det[i], semantic[i], {
          ...config,
          categoryOverrideThreshold: threshold,
        });
        const label = truth.get(i + 1)!;
        if (resolved.overridden) {
          overrides++;
          if (resolved.category === label) overridesCorrect++;
        }
        if (resolved.category === label) exact++;
        else if (resolved.category !== "general") wrongSpecific++;
        if (resolved.category === "general") generalCount++;
      }
      return {
        threshold,
        exact,
        exactPct: +(100 * exact / stories.length).toFixed(1),
        wrongSpecific,
        wrongSpecificPct: +(100 * wrongSpecific / stories.length).toFixed(1),
        generalCount,
        overrides,
        overridesCorrect,
      };
    }

    const detOnly = (() => {
      let exact = 0;
      let wrongSpecific = 0;
      let general = 0;
      for (let i = 0; i < stories.length; i++) {
        const label = truth.get(i + 1)!;
        if (det[i].primary === label) exact++;
        else if (det[i].primary !== "general") wrongSpecific++;
        if (det[i].primary === "general") general++;
      }
      return { exact, exactPct: +(100 * exact / stories.length).toFixed(1), wrongSpecific, general };
    })();

    const sweep = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85].map(evaluate);

    const report = {
      generatedAt: new Date().toISOString(),
      provider: "local-minilm",
      model: MINILM_MODEL,
      stories: stories.length,
      gatedForSemantic: gated.filter(Boolean).length,
      embedTimeMs: embedMs,
      deterministicOnly: detOnly,
      hybridSweep: sweep,
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    process.stdout.write(
      `[shadow-category] stories=${report.stories} gated=${report.gatedForSemantic} ` +
        `embed=${embedMs}ms\n` +
        `[shadow-category] deterministic-only: ${detOnly.exactPct}% exact, ` +
        `${detOnly.wrongSpecific} wrong-specific, ${detOnly.general} general\n`,
    );
    for (const row of sweep) {
      process.stdout.write(
        `[shadow-category] hybrid@${row.threshold}: ${row.exactPct}% exact, ` +
          `${row.wrongSpecific} wrong-specific, ${row.generalCount} general, ` +
          `overrides=${row.overrides} (correct=${row.overridesCorrect})\n`,
      );
    }

    expect(stories.length).toBeGreaterThan(300);
  }, 600_000);
});
