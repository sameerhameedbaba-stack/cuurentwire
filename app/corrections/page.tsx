import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Corrections",
  description: "How to report an error in CurrentWire coverage, and how we handle it.",
  path: "/corrections",
});

export default function CorrectionsPage() {
  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="Corrections"
      intro="Accuracy matters more than speed. When CurrentWire gets something wrong, we want to fix it quickly."
    >
      <h2>What we correct</h2>
      <ul>
        <li>Inaccurate headlines or summaries on CurrentWire story pages</li>
        <li>Misattributed sources or incorrect publication details</li>
        <li>Stories grouped together that describe different events</li>
        <li>Incorrect geographic or category classification</li>
      </ul>
      <p>
        Errors within a publisher’s original article should be reported to that
        publisher; we link to original reporting on every story page so you can
        reach them directly.
      </p>

      <h2>How to report an error</h2>
      <p>
        Email{" "}
        <a href={`mailto:${siteConfig.correctionsEmail}`}>
          {siteConfig.correctionsEmail}
        </a>{" "}
        with the story link and a short description of the problem. Include the
        correct information and a supporting source if you can.
      </p>

      <h2>What happens next</h2>
      <p>
        We review reports promptly. Material inaccuracies are corrected as soon
        as they are verified; classification and clustering fixes also feed
        improvements to the automated systems that caused them. Our
        summarization and attribution rules are published in the{" "}
        <Link href="/editorial-standards">editorial standards</Link>.
      </p>

      <h2>Corrections log</h2>
      <p>
        Corrections that materially change what a story page says will be
        listed here with the date and what changed. Routine classification and
        grouping fixes are applied continuously by the automated systems and
        are not individually logged.
      </p>

      <p>
        <a
          href={`mailto:${siteConfig.correctionsEmail}?subject=Correction%20report`}
          className="inline-block bg-ink px-5 py-3 font-bold text-paper no-underline transition-colors hover:bg-brand hover:text-white"
        >
          Report an error
        </a>
      </p>
      <p>
        For anything else, see the <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}
