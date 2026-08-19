import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Editorial Standards",
  description:
    "The principles governing accuracy, attribution, neutrality, transparency and corrections at CurrentWire.",
  path: "/editorial-standards",
});

export default function EditorialStandardsPage() {
  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="Editorial Standards"
      intro="CurrentWire is a news discovery platform. These principles govern how we select, summarize and present reporting."
    >
      <h2>Automated compilation</h2>
      <p>
        CurrentWire is an aggregator, not a newsroom. Stories are collected
        from publisher feeds and APIs and compiled algorithmically — no human
        journalists, no AI-generated reporting. Summaries derive from
        publisher-provided metadata, and every story links out to the original
        reporting; CurrentWire does not host article bodies. The{" "}
        <Link href="/methodology">methodology</Link> describes the process.
      </p>

      <h2>Accuracy</h2>
      <p>
        CurrentWire should never knowingly present fabricated information.
        Summaries derive only from source material; when reliable information is
        limited, we display less rather than fill space. Automated systems must
        never invent quotations, numbers, allegations or outcomes.
      </p>

      <h2>Attribution</h2>
      <p>
        Original publishers must be clearly identified. Every story shows its
        sources and links to the original reporting. Attribution is never
        hidden, and CurrentWire never presents third-party reporting as its own.
      </p>

      <h2>Neutrality</h2>
      <p>
        Headlines and summaries should describe events rather than advocate
        political positions. No political party receives special visual
        treatment, and source authority reflects journalistic standing — not
        ideology.
      </p>

      <h2>Transparency</h2>
      <p>
        Readers should be able to understand where information originated and
        why a story is ranked where it is. Our{" "}
        <Link href="/methodology">methodology</Link> is public.
      </p>

      <h2>Corrections</h2>
      <p>
        Material inaccuracies should be corrected promptly. See the{" "}
        <Link href="/corrections">corrections process</Link> for how to report
        an error.
      </p>

      <h2>Separation of reporting and opinion</h2>
      <p>
        CurrentWire indexes opinion and analysis pieces where publisher feeds
        carry them, and labels them visibly (&ldquo;Opinion&rdquo;,
        &ldquo;Analysis&rdquo;) so they are never mistaken for straight news.
        Source-applied opinion designations are retained. Opinion pieces are
        never eligible for the BREAKING label, which is reserved for reported
        news events.
      </p>

      <h2>Press releases</h2>
      <p>
        Corporate press releases and wire-distributed announcements are
        detected and labeled &ldquo;Press release&rdquo;. They are excluded
        from every curated selection — the homepage lead, section bands and
        Most Covered, the Top 100, the top sections of country and category
        pages, trending topics, and the BREAKING label — unless the story has
        independent editorial coverage, and syndicated copies of one release
        are never counted as independent sources. The counting rule is set out
        in{" "}
        <Link href="/methodology/coverage-breadth">
          what coverage breadth measures
        </Link>
        .
      </p>
      <p>
        A release that real newsrooms have picked up is a story, so it remains
        eligible everywhere. A release nobody covered stays reachable and
        labeled in <Link href="/latest">Latest</Link>, on the publisher&rsquo;s
        source page and in search — it is simply never presented as a top
        story. Curated sections show fewer items rather than filling the gap
        with unreported announcements.
      </p>
    </ProsePage>
  );
}
