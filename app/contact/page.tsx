import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/** One string for both <meta name="description"> and the ContactPage JSON-LD. */
const DESCRIPTION =
  "Contact CurrentWire: general enquiries, corrections, publishers, partnerships and technical issues.";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: DESCRIPTION,
  path: "/contact",
});

export default function ContactPage() {
  const rows = [
    {
      heading: "General enquiries",
      body: "Questions about CurrentWire, coverage or the platform.",
      email: siteConfig.contactEmail,
    },
    {
      heading: "Corrections",
      body: "Report an inaccuracy in a headline, summary, attribution or classification.",
      email: siteConfig.correctionsEmail,
    },
    {
      heading: "Publisher enquiries",
      body: "You publish news and have questions about how your reporting is indexed, attributed or linked.",
      email: siteConfig.publishersEmail,
    },
    {
      heading: "Partnerships",
      body: "Licensing, data or distribution partnerships.",
      email: siteConfig.publishersEmail,
    },
    {
      heading: "Technical issues",
      body: "Something on the site is broken or behaving unexpectedly.",
      email: siteConfig.contactEmail,
    },
  ];

  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="Contact"
      intro="Use the address that matches your enquiry — it reaches the right inbox fastest."
    >
      <div className="not-prose divide-y divide-rule border-y border-rule">
        {rows.map((row) => (
          <div key={row.heading} className="py-5">
            <h2 className="font-display text-lg font-bold">{row.heading}</h2>
            <p className="mt-1 text-sm text-muted">{row.body}</p>
            <a
              href={`mailto:${row.email}`}
              className="mt-2 inline-block text-sm font-bold text-brand-ink underline underline-offset-2"
            >
              {row.email}
            </a>
          </div>
        ))}
      </div>

      <h2>What to include</h2>
      <p>
        CurrentWire is an automated aggregator, so the more precisely a message
        identifies the page and the problem, the faster it can be acted on.
      </p>
      <ul>
        <li>
          <strong>A correction:</strong> the CurrentWire story URL, the exact
          headline, summary sentence or label that is wrong, and the correct
          information with a source if you have one.
        </li>
        <li>
          <strong>A publisher enquiry:</strong> your publication, the feed URL
          CurrentWire is reading, and what you would like changed.
        </li>
        <li>
          <strong>A technical problem:</strong> the URL, what you were doing,
          what happened instead, and which browser you were using.
        </li>
      </ul>

      <h2>What CurrentWire can and cannot change</h2>
      <p>
        CurrentWire controls its own pages and nothing else. It can fix the
        headline or summary shown on a CurrentWire story page, the attribution
        of a report to a publication, which reports are grouped together as one
        event, and the category or country a story is filed under. The{" "}
        <Link href="/corrections">corrections process</Link> covers all four.
      </p>
      <p>
        It cannot change anything inside a publisher&rsquo;s own article: the
        text, the headline on their site, the photograph and the paywall are
        theirs. Every CurrentWire story page links to the original report, so
        the publisher can be reached directly. Publishers who want their
        reporting indexed, attributed or linked differently — including removal
        — should write to{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>
          {siteConfig.publishersEmail}
        </a>
        , and the <Link href="/copyright">copyright page</Link> sets out the
        position CurrentWire takes on publisher material.
      </p>

      <h2>Answers that already exist</h2>
      <p>
        Several of the most common questions are already documented. How stories
        are ranked is set out in the{" "}
        <Link href="/methodology">methodology</Link>. The accuracy, attribution
        and neutrality rules are in the{" "}
        <Link href="/editorial-standards">editorial standards</Link>. The
        automated byline every story carries is explained on the{" "}
        <Link href="/news-desk">news desk page</Link>. What CurrentWire is, and
        what it deliberately is not, is on the{" "}
        <Link href="/about">about page</Link>.
      </p>

      <h2>How messages are handled</h2>
      <p>
        Email is the only contact channel CurrentWire publishes. No response
        time is promised and none should be inferred from this page, so please
        do not use email for anything time-critical. Addresses and messages are
        used only to answer the enquiry they concern and are never added to a
        mailing list; the <Link href="/privacy">privacy policy</Link> describes
        how contact data is handled.
      </p>

      <TrustPageJsonLd
        path="/contact"
        name="Contact CurrentWire"
        description={DESCRIPTION}
        type="ContactPage"
      />
    </ProsePage>
  );
}
