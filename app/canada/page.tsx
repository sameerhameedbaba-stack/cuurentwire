import type { Metadata } from "next";
import { CountryPage } from "@/components/sections/CountryPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Canada",
  description:
    "Politics, business, society and the developments shaping Canada.",
  path: "/canada",
});

export default function CanadaPage() {
  return (
    <CountryPage
      country="canada"
      title="Canada"
      subheading="Politics, business, society and the developments shaping Canada."
      path="/canada"
      accent="canada"
    />
  );
}
