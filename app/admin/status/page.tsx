import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheInfo, getDataset } from "@/lib/cache/store";
import { isDatabaseConfigured } from "@/lib/database/client";
import { env, getDataMode } from "@/lib/env";
import { LIVE_PROVIDERS } from "@/lib/news/providers";
import { relativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System status",
  robots: { index: false, follow: false },
};

/**
 * Protected diagnostics view.
 * Production access requires ?key=<ADMIN_SECRET>; without ADMIN_SECRET set,
 * the route does not exist in production. Development access is open.
 * Never renders provider secrets — only whether they are configured.
 */
export default async function AdminStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  if (env.isProduction) {
    if (!env.adminSecret || key !== env.adminSecret) notFound();
  }

  const dataset = await getDataset();
  const cache = cacheInfo();
  const stats = dataset.ingestion;

  const rows: [string, string | number][] = [
    ["Data mode", getDataMode()],
    ["Generated", `${relativeTime(dataset.generatedAt)} (${dataset.generatedAt})`],
    ["Cache holds data", String(cache.hasData)],
    ["Background refresh running", String(cache.refreshing)],
    ["Refresh interval", `${env.refreshIntervalMs / 60000} min`],
    ["Database configured", String(isDatabaseConfigured())],
    ["Ingestion duration", `${stats.durationMs} ms`],
    ["Articles received", stats.articlesReceived],
    ["Articles accepted", stats.articlesAccepted],
    ["Articles rejected", stats.articlesRejected],
    ["Exact duplicates removed", stats.duplicatesRemoved],
    ["Story clusters", stats.clusterCount],
    ["Trending topics", dataset.trending.length],
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
