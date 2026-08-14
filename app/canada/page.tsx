import type { Metadata } from "next";
import { CountryPage } from "@/components/sections/CountryPage";
import { getDataset } from "@/lib/cache/store";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Canada",
  description:
    "Politics, business, society and the developments shaping Canada.",
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
