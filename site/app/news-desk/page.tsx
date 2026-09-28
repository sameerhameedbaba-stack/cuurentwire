import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { MIN_FREE_SOURCES, MIN_INDEPENDENT_DOMAINS } from "@/lib/editorial/eligibility";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/**
 * STATIC-SITE OVERLAY for /news-desk.
 *
 * The Vercel version says the News Desk "does not generate article text" and
 * that "nobody at CurrentWire writes news stories". On the static site the
 * News Desk writes original articles with AI assistance, so that page would be
 * false. This is the page NewsMediaOrganization.masthead points at — the one
 * a reader or a quality rater reads to learn who wrote what they just read.
 */

const DESCRIPTION =
  "What the CurrentWire News Desk byline means: original articles written with AI assistance from reporting by several independent publications.";

export const metadata: Metadata = pageMetadata({
  title: "CurrentWire News Desk",
  description: DESCRIPTION,
  path: "/news-desk",
});

export default function NewsDeskPage() {
  return (
    <ProsePage
      eyebrow="Transparency"
      title="The CurrentWire News Desk"
      intro="Every CurrentWire article carries the byline “CurrentWire News Desk”. This page explains exactly what that byline means — and what it does not."
    >
      <h2>What the News Desk is</h2>
      <p>
        The News Desk is how CurrentWire produces its articles: a process that
        finds stories several newsrooms have reported, checks that the coverage
        meets our sourcing rules, and writes an original article{" "}
        <strong>with AI assistance</strong> from the facts those reports agree
        on. It is not a person, and we do not present it as one.
      </p>

      <h2>What it does</h2>
      <ul>
        <li>
          Groups reports of the same event from different publications — see{" "}
          <Link href="/methodology/duplicate-stories">how duplicate stories are merged</Link>.
        </li>
        <li>
          Accepts a story only when at least {MIN_INDEPENDENT_DOMAINS} independent
          publications reported it and at least {MIN_FREE_SOURCES} of them are
          free to read.
        </li>
        <li>
          Writes from the facts those publications agree on, and attributes
          anything disputed or alleged to the publication that reported it.
        </li>
        <li>Links every publication it draws on, at the foot of every article.</li>
        <li>
          Holds stories about crime or the courts, health, or personal finance
          for human review before they can be published.
        </li>
      </ul>

      <h2>What it does not do</h2>
      <ul>
        <li>
          <strong>No copied reporting.</strong> The writing step is given facts
          and a list of publications, not their article text, so it cannot
          reproduce another outlet&rsquo;s wording.
        </li>
        <li>
          <strong>No invented detail.</strong> Quotes, numbers and dates come
          from the reporting or they do not appear.
        </li>
        <li>
          <strong>No fake people.</strong> We do not put invented human names on
          AI-assisted work.
        </li>
        <li>
          <strong>No single-source stories.</strong> If only one outlet has it,
          we do not write it.
        </li>
      </ul>

      <h2>Corrections</h2>
      <p>
        An error in a News Desk article is CurrentWire&rsquo;s error, however
        the article was drafted. It is corrected on the article, dated, with a
        note of what changed — see the{" "}
        <Link href="/corrections">corrections policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about the News Desk? Use the <Link href="/contact">contact page</Link>{" "}
        or write to{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        Publishers with attribution questions can reach{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>{siteConfig.publishersEmail}</a>.
      </p>
      <TrustPageJsonLd path="/news-desk" name="The CurrentWire News Desk" description={DESCRIPTION} />
    </ProsePage>
  );
}
