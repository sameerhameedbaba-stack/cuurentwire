import type { Metadata } from "next";
import { CountryPage } from "@/components/sections/CountryPage";
import { getDataset } from "@/lib/cache/store";
import { pageMetadata } from "@/lib/seo/metadata";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
// COST floor, not a freshness choice: every ISR re-render is billed
// (Vercel Hobby-tier blowout, 2026-08-24 — ISR Writes 238%, CPU 307%).
// Do not lower this to chase TTFB; the cron's targeted revalidation
// keeps content fresh. Quota math lives in seo/PLAYBOOK.md.
export const revalidate = 900;

export const metadata: Metadata = pageMetadata({
  // Search-phrased: "Canada news today" is the query; "Canada" is only the
  // nav label (the on-page h1 keeps it).
  title: "Canada News Today",
  description:
    "Top Canada news today: politics, business and the developments shaping Canada — ranked, updated all day, and tracked across the publications covering each story.",
  path: "/canada",
  rssPath: "/rss/canada",
});

export default async function CanadaPage() {
  // Same per-request snapshot CountryPage renders from (getDataset dedupes).
  const dataset = await getDataset();
  return (
    <>
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <CountryPage
        country="canada"
        title="Canada"
        subheading="Politics, business, society and the developments shaping Canada."
        path="/canada"
        accent="canada"
      />
    </>
  );
}
