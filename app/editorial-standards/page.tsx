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
        CurrentWire currently indexes news reporting. If opinion content is ever
        supported, it will be clearly labeled as opinion, and source-applied
        opinion designations will be retained.
      </p>
    </ProsePage>
  );
}
