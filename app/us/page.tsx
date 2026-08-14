import type { Metadata } from "next";
import { CountryPage } from "@/components/sections/CountryPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "United States",
  description:
    "Politics, business, technology, society and the stories shaping America.",
  path: "/us",
  rssPath: "/rss/us",
});

export default function UnitedStatesPage() {
  return (
    <CountryPage
      country="us"
      title="United States"
      subheading="Politics, business, technology, society and the stories shaping America."
      path="/us"
      accent="us"
    />
  );
}
