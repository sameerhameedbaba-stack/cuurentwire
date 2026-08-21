import type { Metadata } from "next";
import { CountryPage } from "@/components/sections/CountryPage";
import { getDataset } from "@/lib/cache/store";
import { pageMetadata } from "@/lib/seo/metadata";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  // Search-phrased: "US news today" is the query; "United States" is only
  // the nav label (the on-page h1 keeps it).
  title: "US News Today — United States",
  description:
    "Top US news today: politics, business, technology, society and the stories shaping America, ranked and updated all day.",
  path: "/us",
  rssPath: "/rss/us",
});

export default async function UnitedStatesPage() {
  // Same per-request snapshot CountryPage renders from (getDataset dedupes).
  const dataset = await getDataset();
  return (
    <>
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <CountryPage
        country="us"
        title="United States"
        subheading="Politics, business, technology, society and the stories shaping America."
        path="/us"
        accent="us"
      />
    </>
  );
}
