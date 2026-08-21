import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isGenericEntity } from "@/lib/news/classification/entities";
import {
  buildClusterContext,
  decidePair,
  TIME_WINDOW_HOURS,
} from "@/lib/news/clustering/cluster";
import { sharedRareStems } from "@/lib/news/clustering/fingerprint";
import { runPipeline } from "@/lib/news/pipeline";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * SINGLETON FALSE-SPLIT AUDIT HARNESS (reviewer item 7).
 *
 * Production shows most story clusters as single-publication. Before
 * concluding that publishers simply cover different stories, this harness
 * runs the LIVE pipeline locally (curated RSS feeds, no API keys needed)
 * and emits, for every single-publication cluster, the most similar OTHER
 * clusters — measured with the production pair signals — as candidate
 * false splits for human-style labelling by a separate pass.
 *
 * It never changes clustering and never touches production code: every
 * number comes from the same buildClusterContext / decidePair /
 * sharedRareStems the engine itself uses.
 *
 * Run (needs the network, ~30-60 s for the 98 curated feeds):
 *   SINGLETON_AUDIT=1 npx vitest run tests/shadow/singleton-audit.test.ts
 *   PowerShell: $env:SINGLETON_AUDIT="1"; npx vitest run tests/shadow/singleton-audit.test.ts
 * Writes data/local/singleton-audit/{dataset,candidates,stats}.json
 * (data/local is gitignored).
 */

const enabled = process.env.SINGLETON_AUDIT === "1";
const OUT_DIR = path.join(process.cwd(), "data", "local", "singleton-audit");

/** Candidates kept per singleton before the global cap. */
const TOP_PER_SINGLETON = 2;
/** Global cap on emitted pairs (by score). */
const GLOBAL_CAP = 600;
/** A pair with no shared rare stem / specific entity still qualifies above this. */
const MIN_HEADLINE_SIM = 0.2;
/** Score bonus per shared rare stem. */
const STEM_BONUS = 0.05;

interface Candidate {
  index: number;
  singletonId: string;
  singletonTitle: string;
  singletonSource: string;
  singletonCategory: string;
  singletonPublishedAt: string;
  otherId: string;
  otherTitle: string;
  otherSource: string;
  otherSourceCount: number;
  otherCategory: string;
  otherPublishedAt: string;
  hoursApart: number;
  headlineSim: number;
  fpSim: number;
  strong: boolean;
  sharedStems: string[];
  sharedEntities: string[];
  score: number;
  otherIsSingleton: boolean;
  /**
   * Diagnostic: what the production pair rule says about these two LEAD
   * articles as this harness sees them. Approximate, not a replay: corpus
   * stats here are built over cluster leads (not every article), and the
   * pipeline has already rewritten member categories to the cluster
   * category, so the cross-category margin the engine applied at
   * clustering time may be invisible here. A true value therefore means
   * "would merge on today's labels" — a pointer to look at blocking,
   * validation eviction, category margin or the second pass.
   */
  wouldMerge: boolean;
}

const round = (value: number, places = 4): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** Lowercased entities minus the generic ones (isGenericEntity). */
function specificEntities(article: Article): Set<string> {
  const out = new Set<string>();
  for (const entity of article.entities) {
    const key = entity.trim().toLowerCase();
    if (key && !isGenericEntity(key)) out.add(key);
  }
  return out;
}

function articleRow(article: Article) {
  return {
    title: article.title,
    source: article.source,
    sourceDomain: article.sourceDomain,
    publishedAt: article.publishedAt,
    url: article.url,
  };
}

function clusterRow(cluster: StoryCluster) {
  return {
    id: cluster.id,
    title: cluster.title,
    category: cluster.category,
    country: cluster.country,
    sourceCount: cluster.sourceCount,
    sourceNames: cluster.sourceNames,
    firstPublishedAt: cluster.firstPublishedAt,
    lead: articleRow(cluster.lead),
    articles: cluster.articles.map((a) => ({
      ...articleRow(a),
      entities: a.entities,
    })),
  };
}

/** Deterministic order: best score first, then ids. */
function byScore(a: Candidate, b: Candidate): number {
  return (
    b.score - a.score ||
    a.singletonId.localeCompare(b.singletonId) ||
    a.otherId.localeCompare(b.otherId)
  );
}

function explainFailure(dataset: NewsDataset): string {
  const providers = dataset.ingestion.providers.map((p) => ({
    provider: p.provider,
    ok: p.ok,
    articleCount: p.articleCount,
    error: p.error,
    feedsOk: p.feeds?.filter((f) => f.ok).length,
    feedsFailed: p.feeds?.filter((f) => !f.ok).length,
    feedErrorSamples: p.feeds
      ?.filter((f) => !f.ok)
      .slice(0, 5)
      .map((f) => `${f.url}: ${f.error}`),
  }));
  return JSON.stringify(
    {
      dataMode: dataset.dataMode,
      NEWS_DATA_MODE: process.env.NEWS_DATA_MODE,
      RSS_CURATED_FEEDS: process.env.RSS_CURATED_FEEDS,
      articleCount: dataset.articles.length,
      mockArticles: dataset.articles.filter((a) => a.isMock).length,
      providers,
    },
    null,
    2,
  );
}

describe.skipIf(!enabled)("singleton false-split audit (live pipeline)", () => {
  it("runs the live pipeline and emits candidate false-split pairs", async () => {
    // Env getters are lazy (lib/env.ts, config/feeds.ts), so setting these
    // here is enough. Curated feeds default ON only when RSS_FEEDS is set
    // (config/feeds.ts curatedFeedsEnabled); locally nothing is set, so
    // switch them on explicitly unless the owner chose otherwise.
    process.env.NEWS_DATA_MODE = "live";
    if (!process.env.RSS_CURATED_FEEDS) process.env.RSS_CURATED_FEEDS = "on";

    const started = Date.now();
    const dataset = await runPipeline();
    const pipelineMs = Date.now() - started;

    if (dataset.dataMode !== "live") {
      throw new Error(`Pipeline did not run in live mode:\n${explainFailure(dataset)}`);
    }
    const mockArticles = dataset.articles.filter((a) => a.isMock).length;
    if (dataset.articles.length === 0 || mockArticles > 0) {
      throw new Error(
        `Live pipeline produced no live articles (mock fallback or every provider failed):\n${explainFailure(dataset)}`,
      );
    }
    expect(dataset.dataMode).toBe("live");
    expect(dataset.clusters.length).toBeGreaterThan(0);

    const clusters = dataset.clusters;
    const n = clusters.length;
    const leads = clusters.map((c) => c.lead);
    const ctx = buildClusterContext(leads);
    const times = leads.map((l) => new Date(l.publishedAt).getTime());
    const specific = leads.map(specificEntities);
    const windowMs = TIME_WINDOW_HOURS * 3_600_000;

    const isSingleton = (c: StoryCluster) => c.sourceCount === 1;
    const singletonCount = clusters.filter(isSingleton).length;
    let excludedPressRelease = 0;
    let excludedMock = 0;
    const audited: number[] = [];
    clusters.forEach((c, i) => {
      if (!isSingleton(c)) return;
      if (c.isMock) {
        excludedMock++;
        return;
      }
      if (c.contentType === "press_release") {
        excludedPressRelease++;
        return;
      }
      audited.push(i);
    });

    // Per-singleton candidate generation over cluster LEAD articles.
    const perSingletonKept: Candidate[] = [];
    let singletonsWithCandidates = 0;
    let rawCandidatePairs = 0;
    for (const i of audited) {
      const s = clusters[i];
      const found: Candidate[] = [];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (leads[j].sourceDomain === leads[i].sourceDomain) continue;
        const deltaMs = Math.abs(times[i] - times[j]);
        if (deltaMs > windowMs) continue;

        const decision = decidePair(ctx, i, j);
        const stems = sharedRareStems(ctx.prints[i], ctx.prints[j], ctx.stats);
        const ents = [...specific[i]].filter((e) => specific[j].has(e)).sort();
        const headlineSim = decision.headlineSimilarity;
        if (stems.length < 1 && ents.length < 1 && headlineSim < MIN_HEADLINE_SIM) {
          continue;
        }
        rawCandidatePairs++;
        const o = clusters[j];
        const score =
          Math.max(headlineSim, decision.fingerprintSimilarity) +
          STEM_BONUS * stems.length;
        found.push({
          index: -1,
          singletonId: s.id,
          singletonTitle: s.lead.title,
          singletonSource: s.lead.source,
          singletonCategory: s.category,
          singletonPublishedAt: s.lead.publishedAt,
          otherId: o.id,
          otherTitle: o.lead.title,
          otherSource: o.lead.source,
          otherSourceCount: o.sourceCount,
          otherCategory: o.category,
          otherPublishedAt: o.lead.publishedAt,
          hoursApart: round(deltaMs / 3_600_000, 2),
          headlineSim: round(headlineSim),
          fpSim: round(decision.fingerprintSimilarity),
          strong: decision.strongFingerprint,
          sharedStems: [...stems].sort(),
          sharedEntities: ents,
          score: round(score),
          otherIsSingleton: isSingleton(o),
          wouldMerge: decision.merge,
        });
      }
      if (found.length > 0) singletonsWithCandidates++;
      found.sort(byScore);
      perSingletonKept.push(...found.slice(0, TOP_PER_SINGLETON));
    }

    // Two singletons can surface the same unordered pair from both sides;
    // labelling it twice is wasted effort, so keep it once (best score).
    perSingletonKept.sort(byScore);
    const seenPairs = new Set<string>();
    const deduped: Candidate[] = [];
    for (const c of perSingletonKept) {
      const key = [c.singletonId, c.otherId].sort().join("|");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      deduped.push(c);
    }
    const mirrorPairsDeduped = perSingletonKept.length - deduped.length;
    const candidates = deduped.slice(0, GLOBAL_CAP);
    const droppedByCap = deduped.length - candidates.length;
    candidates.forEach((c, index) => {
      c.index = index;
    });

    const byCategorySingletons: Record<string, number> = {};
    for (const c of clusters) {
      if (!isSingleton(c)) continue;
      byCategorySingletons[c.category] = (byCategorySingletons[c.category] ?? 0) + 1;
    }
    const candidateScoreHistogram: Record<string, number> = {};
    for (const c of candidates) {
      const lo = Math.floor(c.score * 10) / 10;
      const key = `${lo.toFixed(1)}-${(lo + 0.1).toFixed(1)}`;
      candidateScoreHistogram[key] = (candidateScoreHistogram[key] ?? 0) + 1;
    }
    const singletonsRepresentedAfterCap = new Set(
      candidates.flatMap((c) =>
        c.otherIsSingleton ? [c.singletonId, c.otherId] : [c.singletonId],
      ),
    ).size;

    const rss = dataset.ingestion.providers.find((p) => p.provider === "rss");
    const stats = {
      datasetVersion: dataset.datasetVersion,
      articleCount: dataset.articles.length,
      clusterCount: n,
      singletonCount,
      singletonPct: round((singletonCount / Math.max(1, n)) * 100, 1),
      singletonsWithCandidates,
      candidateCount: candidates.length,
      droppedByCap,
      byCategorySingletons,
      candidateScoreHistogram,
      // Extra context for whoever reads the file.
      singletonsAudited: audited.length,
      singletonsExcludedPressRelease: excludedPressRelease,
      singletonsExcludedMock: excludedMock,
      rawCandidatePairs,
      keptBeforeDedupe: perSingletonKept.length,
      mirrorPairsDeduped,
      candidateCountBeforeCap: deduped.length,
      singletonsRepresentedAfterCap,
      wouldMergeCandidates: candidates.filter((c) => c.wouldMerge).length,
      strongCandidates: candidates.filter((c) => c.strong).length,
      pipelineMs,
      providers: dataset.ingestion.providers.map((p) => ({
        provider: p.provider,
        ok: p.ok,
        articleCount: p.articleCount,
        error: p.error,
      })),
      feedsOk: rss?.feeds?.filter((f) => f.ok).length ?? 0,
      feedsFailed: rss?.feeds?.filter((f) => !f.ok).length ?? 0,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUT_DIR, "dataset.json"),
      JSON.stringify(
        {
          generatedAt: dataset.generatedAt,
          datasetVersion: dataset.datasetVersion,
          articleCount: dataset.articles.length,
          clusterCount: n,
          singletonCount,
          clusters: clusters.map(clusterRow),
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(OUT_DIR, "candidates.json"),
      JSON.stringify(candidates, null, 2),
    );
    writeFileSync(path.join(OUT_DIR, "stats.json"), JSON.stringify(stats, null, 2));

    process.stdout.write(
      `[singleton-audit] wrote ${OUT_DIR}\n` +
        `[singleton-audit] ${JSON.stringify(stats, null, 2)}\n`,
    );
    for (const c of candidates.slice(0, 5)) {
      process.stdout.write(
        `[singleton-audit] #${c.index} score=${c.score} hs=${c.headlineSim} fp=${c.fpSim} ` +
          `strong=${c.strong} stems=[${c.sharedStems.join(",")}] ` +
          `| ${c.singletonSource}: "${c.singletonTitle}" ` +
          `<> ${c.otherSource} (${c.otherSourceCount}): "${c.otherTitle}"\n`,
      );
    }

    expect(singletonCount).toBeGreaterThanOrEqual(0);
  }, 180_000);
});
