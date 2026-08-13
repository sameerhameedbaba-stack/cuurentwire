import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "Contact CurrentWire: general enquiries, corrections, publishers, partnerships and technical issues.",
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
      intro="The fastest way to reach the right person is to use the address matching your enquiry."
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
    </ProsePage>
  );
}
