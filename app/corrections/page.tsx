import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/** One string for both <meta name="description"> and the WebPage JSON-LD. */
const DESCRIPTION =
  "How to report an error in CurrentWire coverage, and how we handle it.";

export const metadata: Metadata = pageMetadata({
  title: "Corrections",
  description: DESCRIPTION,
  path: "/corrections",
});

export default function CorrectionsPage() {
  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="Corrections"
      intro="Accuracy matters more than speed. When CurrentWire gets something wrong, we correct it on the page and say what changed."
    >
      <h2>What we correct</h2>
      <p>
        CurrentWire publishes original articles written by our news desk from
        reporting by two or more independent publications. When one of those
        articles is wrong, the error is ours and we fix it on the page.
      </p>
      <ul>
        <li>Factual errors in a CurrentWire article — names, numbers, dates, places, sequence of events</li>
        <li>A claim attributed to the wrong publication, or not attributed at all</li>
        <li>A headline or standfirst that overstates what the reporting supports</li>
        <li>Broken or wrong links to the publications an article draws on</li>
        <li>Incorrect category classification</li>
      </ul>
      <p>
        Errors inside a publisher’s own reporting should be reported to that
        publisher; we link to every publication an article draws on so you can
        reach them directly. If their correction changes our article, we update
        ours too and log it.
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
        We check the report against the publications the article was built
        from. If it is right, we correct the article and note the change on the
        article itself — we do not quietly edit a page and leave no trace.
        Where an error came from an automated step, the fix goes into that step
        as well, so the same mistake cannot recur: the{" "}
        <Link href="/news-desk">news desk page</Link> describes what those
        systems do, and the <Link href="/methodology">methodology</Link>{" "}
        documents the signals they use. Our sourcing and attribution rules are
        published in the{" "}
        <Link href="/editorial-standards">editorial standards</Link>.
      </p>

      <h2>How a correction appears</h2>
      <p>
        Every correction is published on the article it applies to, dated,
        saying what was wrong and what it now says. The original claim is
        described rather than silently deleted, so a reader who saw the
        mistake can tell what changed. Fixing a typo or a dead link is not a
        correction and is not logged; changing what an article asserts always
        is.
      </p>

      <h2>AI assistance</h2>
      <p>
        Our articles are written with AI assistance and every one says so. That
        is not a disclaimer that shifts responsibility: an error in a
        CurrentWire article is CurrentWire’s error regardless of how the
        article was drafted, and it is corrected the same way. We do not
        publish articles under invented human bylines.
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
      <TrustPageJsonLd
        path="/corrections"
        name="Corrections"
        description={DESCRIPTION}
      />
    </ProsePage>
  );
}
