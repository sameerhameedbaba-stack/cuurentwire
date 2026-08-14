import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/admin/auth";
import { cacheInfo, datasetAgeMs, getDataset } from "@/lib/cache/store";
import { getArchiveStats } from "@/lib/database/archive";
import { isDatabaseConfigured } from "@/lib/database/client";
import { env, getDataMode } from "@/lib/env";
import { classifyCategory } from "@/lib/news/classification/category";
import { LIVE_PROVIDERS } from "@/lib/news/providers";
import {
  detectPossibleFalseSplits,
  summarizeClassificationQuality,
} from "@/lib/news/quality";
import { INTELLIGENCE_VERSIONS, semanticConfig } from "@/lib/intelligence/semantic";
import benchmarkHistory from "@/data/benchmark-history.json";
import { secureCompare, sha256Hex } from "@/lib/utils/secure-compare";
import { relativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System status",
  robots: { index: false, follow: false },
};

/**
 * Protected diagnostics view.
 * Production access requires the httpOnly cookie set by /admin/auth?key=
 * (visited once per browser) or an `x-admin-key: <ADMIN_SECRET>` header;
 * without ADMIN_SECRET set, the route does not exist in production.
 * Development access is open. A legacy ?key= query param is bounced to
 * /admin/auth so the secret leaves the address bar (and logs/history).
 * Never renders provider secrets — only whether they are configured.
 */
export default async function AdminStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  if (key) redirect(`/admin/auth?key=${encodeURIComponent(key)}`);
  if (env.isProduction) {
    const secret = env.adminSecret;
    if (!secret) notFound();
    const cookieValue = (await cookies()).get(ADMIN_COOKIE)?.value;
    const headerKey = (await headers()).get("x-admin-key");
    const authorized =
      secureCompare(cookieValue, sha256Hex(secret)) ||
      secureCompare(headerKey, secret);
    if (!authorized) notFound();
  }

  const dataset = await getDataset();
  const cache = cacheInfo();
  const stats = dataset.ingestion;
  const archiveStats = await getArchiveStats();
  const quality = summarizeClassificationQuality(dataset.articles);
  const falseSplits = detectPossibleFalseSplits(dataset.clusters);

  const rssFeedHealth =
    stats.providers.find((p) => p.provider === "rss")?.feeds ?? [];

  const rows: [string, string | number][] = [
    ["Data mode", getDataMode()],
    ["Dataset version", dataset.datasetVersion],
    ["Generated", `${relativeTime(dataset.generatedAt)} (${dataset.generatedAt})`],
    ["Dataset age", `${Math.round(datasetAgeMs(dataset) / 1000)} s`],
    ["Cache holds data", String(cache.hasData)],
    ["Background refresh running", String(cache.refreshing)],
    ["Dataset/RSS refresh interval", `${env.rssRefreshMinutes} min`],
    ["GNews refresh interval", `${env.gnewsRefreshMinutes} min`],
    ["Database configured", String(isDatabaseConfigured())],
    ["Ingestion duration", `${stats.durationMs} ms`],
    ["Articles received", stats.articlesReceived],
    ["Articles accepted", stats.articlesAccepted],
    ["Articles rejected", stats.articlesRejected],
    ["Exact duplicates removed", stats.duplicatesRemoved],
    ["Story clusters", stats.clusterCount],
    ["Trending topics", dataset.trending.length],
    [
      "Coverage age at ingest (median)",
      `${Math.round(stats.articleAgeAtIngestMedianMs / 60_000)} min`,
    ],
    [
      "Coverage age at ingest (p90)",
      `${Math.round(stats.articleAgeAtIngestP90Ms / 60_000)} min`,
    ],
    ["Highest ranking score", stats.highestRankingScore],
    ["Breaking clusters", stats.breakingCount],
    ["Near-breaking clusters (score ≥ 75)", stats.nearBreakingCount],
    ["Classification warnings", stats.classificationWarnings],
    ["General (low-confidence) articles", quality.generalCount],
    ["Low-confidence specific categories", quality.lowConfidenceCount],
    ...(archiveStats
      ? ([
          ["Archived stories (permanent URLs)", archiveStats.archived],
          ["Merge redirects recorded", archiveStats.merged],
        ] as [string, number][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          Diagnostics
        </p>
        <h1 className="headline mt-1 text-3xl">System status</h1>
      </header>

      <section aria-label="Pipeline" className="mt-8">
        <h2 className="headline text-xl">Last ingestion</h2>
        <dl className="mt-3 divide-y divide-rule border-y border-rule text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="font-semibold">{label}</dt>
              <dd className="text-right text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Providers" className="mt-8">
        <h2 className="headline text-xl">Providers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-y border-rule text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Configured</th>
                <th className="py-2 pr-4">Last run</th>
                <th className="py-2 pr-4">Articles</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {["mock", ...LIVE_PROVIDERS.map((p) => p.name)].map((name) => {
                const run = stats.providers.find((p) => p.provider === name);
                const provider = LIVE_PROVIDERS.find((p) => p.name === name);
                return (
                  <tr key={name}>
                    <td className="py-2 pr-4 font-semibold">{name}</td>
                    <td className="py-2 pr-4">
                      {name === "mock" ? "always" : provider?.isConfigured() ? "yes" : "no"}
                    </td>
                    <td className="py-2 pr-4">
                      {run ? (run.ok ? "ok" : "failed") : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{run?.articleCount ?? "—"}</td>
                    <td className="py-2 text-muted">{run?.error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {rssFeedHealth.length > 0 && (
        <section aria-label="RSS feed health" className="mt-8">
          <h2 className="headline text-xl">RSS feed health (last run)</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-y border-rule text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4">Feed</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Items</th>
                  <th className="py-2 pr-4">Skipped</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rssFeedHealth.map((feed) => (
                  <tr key={feed.url}>
                    <td className="max-w-80 truncate py-2 pr-4">{feed.url}</td>
                    <td className="py-2 pr-4">{feed.ok ? "ok" : "failed"}</td>
                    <td className="py-2 pr-4 tabular-nums">{feed.itemsParsed}</td>
                    <td className="py-2 pr-4 tabular-nums">{feed.itemsSkipped}</td>
                    <td className="py-2 pr-4 tabular-nums">{feed.durationMs} ms</td>
                    <td className="py-2 text-muted">{feed.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {stats.classificationWarnings > 0 && (
        <section aria-label="Classification warnings" className="mt-8">
          <h2 className="headline text-xl">
            Classification warnings ({stats.classificationWarnings})
          </h2>
          <p className="mt-1 text-xs text-muted">
            Suspicious patterns spotted during the last ingestion — diagnostics
            only, ingestion is never blocked. Showing the first{" "}
            {stats.classificationWarningSamples.length}.
          </p>
          <ul className="mt-3 divide-y divide-rule border-y border-rule text-sm">
            {stats.classificationWarningSamples.map((warning) => (
              <li key={warning} className="py-2 text-muted">
                {warning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Intelligence quality" className="mt-8">
        <h2 className="headline text-xl">Intelligence quality</h2>
        <p className="mt-1 text-xs text-muted">
          Real-production accuracy (manually validated benchmark) and fixture
          accuracy are DIFFERENT metrics and are never combined. Semantic
          layer mode: <strong>{semanticConfig().mode}</strong> · versions:{" "}
          {INTELLIGENCE_VERSIONS.classifierVersion} /{" "}
          {INTELLIGENCE_VERSIONS.clusteringVersion} /{" "}
          {INTELLIGENCE_VERSIONS.gateVersion}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-y border-rule text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Real accuracy</th>
                <th className="py-2 pr-4">Wrong-specific</th>
                <th className="py-2 pr-4">Fixture (regression)</th>
                <th className="py-2 pr-4">Cluster P / R</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {benchmarkHistory.map((entry, i) => (
                <tr key={`${entry.date}-${i}`}>
                  <td className="py-2 pr-4 tabular-nums">{entry.date}</td>
                  <td className="py-2 pr-4 font-semibold tabular-nums">
                    {entry.realCategoryExactPct}%
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{entry.realWrongSpecificPct}%</td>
                  <td className="py-2 pr-4 tabular-nums">{entry.fixtureCategoryHighConfPct}%</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {entry.clusteringPrecision} / {entry.clusteringRecall}
                  </td>
                  <td className="max-w-80 py-2 text-xs text-muted">{entry.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Semantic telemetry (calls, cache hits, failures, cost) reports here
          once SEMANTIC_MODE leaves &ldquo;off&rdquo;; current estimated
          semantic cost: $0 (local embeddings, shadow evaluations only).
        </p>
      </section>

      <section aria-label="Category distribution" className="mt-8">
        <h2 className="headline text-xl">Category distribution</h2>
        <dl className="mt-3 divide-y divide-rule border-y border-rule text-sm">
          {quality.distribution.map((entry) => (
            <div key={entry.category} className="flex justify-between gap-4 py-2">
              <dt className="font-semibold">{entry.category}</dt>
              <dd className="text-right tabular-nums text-muted">{entry.count}</dd>
            </div>
          ))}
        </dl>
      </section>

      {falseSplits.length > 0 && (
        <section aria-label="Possible false splits" className="mt-8">
          <h2 className="headline text-xl">
            Possible false splits ({falseSplits.length})
          </h2>
          <p className="mt-1 text-xs text-muted">
            Different clusters sharing a rare multi-word entity within a few
            hours — flagged for inspection only, never auto-merged.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-y border-rule text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Cluster A</th>
                  <th className="py-2 pr-4">Cluster B</th>
                  <th className="py-2">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {falseSplits.map((split) => (
                  <tr key={`${split.aId}-${split.bId}-${split.entity}`}>
                    <td className="py-2 pr-4 font-semibold">{split.entity}</td>
                    <td className="max-w-60 truncate py-2 pr-4">{split.aTitle}</td>
                    <td className="max-w-60 truncate py-2 pr-4">{split.bTitle}</td>
                    <td className="py-2 tabular-nums">{split.gapHours} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Classification debug" className="mt-8">
        <h2 className="headline text-xl">Top 10 classification debug</h2>
        <p className="mt-1 text-xs text-muted">
          Confidence and scores recomputed from the lead headline (provider
          category is not retained on stored articles).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-y border-rule text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Story</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2">Top scores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {dataset.clusters.slice(0, 10).map((cluster, index) => {
                const debug = classifyCategory({
                  title: cluster.lead.title,
                  description: cluster.lead.description,
                });
                const topScores = Object.entries(debug.scores)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([id, score]) => `${id} ${score}`)
                  .join(" · ");
                return (
                  <tr key={cluster.id}>
                    <td className="py-2 pr-3 tabular-nums">{index + 1}</td>
                    <td className="max-w-72 truncate py-2 pr-3">{cluster.title}</td>
                    <td className="py-2 pr-3 font-semibold">{cluster.category}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {debug.confidence.toFixed(2)}
                    </td>
                    <td className="py-2 text-muted">{topScores || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Top ranked" className="mt-8">
        <h2 className="headline text-xl">Top 10 with ranking breakdown</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-y border-rule text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Story</th>
                <th className="py-2 pr-3">Fresh</th>
                <th className="py-2 pr-3">Auth</th>
                <th className="py-2 pr-3">Cov</th>
                <th className="py-2 pr-3">Geo</th>
                <th className="py-2 pr-3">Prom</th>
                <th className="py-2 pr-3">Vel</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {dataset.clusters.slice(0, 10).map((cluster, index) => (
                <tr key={cluster.id}>
                  <td className="py-2 pr-3 tabular-nums">{index + 1}</td>
                  <td className="max-w-72 truncate py-2 pr-3">{cluster.title}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.freshness}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.authority}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.coverage}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.geography}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.prominence}</td>
                  <td className="py-2 pr-3 tabular-nums">{cluster.rankingBreakdown.velocity}</td>
                  <td className="py-2 font-bold tabular-nums">{cluster.rankingScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
