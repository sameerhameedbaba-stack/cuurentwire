import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { IS_STATIC_SITE } from "@/lib/site-mode";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/** One string for <meta name="description"> and the WebPage JSON-LD. */
const DESCRIPTION = IS_STATIC_SITE
  ? "Who owns what on CurrentWire, and how the reporting our articles draw on is respected."
  : "CurrentWire’s role as an aggregator and how publisher copyright is respected.";

export const metadata: Metadata = pageMetadata({
  title: "Copyright",
  description: DESCRIPTION,
  path: "/copyright",
});

export default function CopyrightPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Copyright"
      intro={
        IS_STATIC_SITE
          ? "CurrentWire writes original articles from the facts other publications report. It does not reproduce their articles or claim ownership of them."
          : "CurrentWire aggregates and summarizes reporting. It does not claim ownership of third-party articles."
      }
    >
      <h2>Publisher content</h2>
      {IS_STATIC_SITE ? (
        <p>
          Copyright in other publications&rsquo; articles, headlines,
          photographs and other material belongs to those publishers.
          CurrentWire articles are our own writing, built from facts those
          publications report — facts themselves are not anyone&rsquo;s
          property, but a publication&rsquo;s way of expressing them is, and we
          do not reproduce it. Every article names and links the publications it
          draws on. The text of CurrentWire articles is copyright CurrentWire.
        </p>
      ) : (
        <p>
          Copyright in original articles, headlines, photographs and other
          publisher material belongs to the respective publishers. CurrentWire
          displays headlines, brief summaries and metadata for discovery, and
          links every story to the original reporting.
        </p>
      )}

      <h2>What CurrentWire does not do</h2>
      <ul>
        <li>Store or display full publisher articles without licensing</li>
        <li>Remove or obscure attribution</li>
        <li>Bypass paywalls or access controls</li>
        <li>Present publisher content as CurrentWire’s own reporting</li>
      </ul>

      <h2>CurrentWire material</h2>
      <p>
        The CurrentWire name, wordmark, site design and software are ©{" "}
        {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
      </p>

      <h2>Publishers</h2>
      <p>
        If you publish news and have questions or requests about how your
        content is indexed, attributed or linked — including removal requests —
        contact{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>
          {siteConfig.publishersEmail}
        </a>
        . See also our <Link href="/editorial-standards">editorial standards</Link>.
      </p>
      <TrustPageJsonLd
        path="/copyright"
        name="Copyright"
        description={DESCRIPTION}
      />
    </ProsePage>
  );
}
