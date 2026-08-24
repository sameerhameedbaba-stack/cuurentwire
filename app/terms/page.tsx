import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/** One string for <meta name="description"> and the WebPage JSON-LD. */
const DESCRIPTION =
  "Terms governing use of the CurrentWire news discovery service.";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Use",
  description: DESCRIPTION,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of Use"
      intro="These terms govern your use of CurrentWire. Automated boilerplate is no substitute for counsel — have these reviewed professionally before commercial launch."
    >
      <h2>Informational purpose</h2>
      <p>
        CurrentWire is a news discovery and aggregation service provided for
        general information. It is not professional, financial, legal or medical
        advice, and coverage may lag or differ from original reporting.
      </p>

      <h2>Third-party content</h2>
      <p>
        Headlines, summaries and metadata shown on CurrentWire derive from
        third-party publishers, who remain responsible for their reporting and
        retain all rights in it. See our{" "}
        <Link href="/copyright">copyright statement</Link>.
      </p>

      <h2>External links</h2>
      <p>
        Links to publisher websites are provided for attribution and access to
        original reporting. CurrentWire does not control and is not responsible
        for external sites.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The CurrentWire name, design, ranking presentation and software are the
        property of the service operator. Third-party articles, headlines and
        imagery belong to their respective publishers.
      </p>

      <h2>Service availability</h2>
      <p>
        The service is provided “as is” without warranties of availability,
        completeness or fitness for a particular purpose. Feeds refresh
        continuously and content may change or disappear without notice.
      </p>

      <h2>Prohibited use</h2>
      <ul>
        <li>Scraping or republishing the service at scale without permission</li>
        <li>Attempting to disrupt, overload or probe the service</li>
        <li>Misrepresenting CurrentWire content as publisher endorsement</li>
        <li>Any unlawful use</li>
      </ul>

      <h2>Corrections</h2>
      <p>
        We correct material inaccuracies promptly — see{" "}
        <Link href="/corrections">corrections</Link>.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the service operator is not
        liable for indirect or consequential damages arising from use of the
        service or reliance on aggregated content.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
      </p>
      <TrustPageJsonLd
        path="/terms"
        name="Terms of Use"
        description={DESCRIPTION}
      />
    </ProsePage>
  );
}
