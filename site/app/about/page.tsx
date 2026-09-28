import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { DAILY_TARGET } from "@/lib/editorial/selection";
import { MIN_FREE_SOURCES, MIN_INDEPENDENT_DOMAINS } from "@/lib/editorial/eligibility";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/**
 * STATIC-SITE OVERLAY for /about.
 *
 * The Vercel app's /about describes an aggregator that "employs no
 * journalists and publishes no AI-generated reporting". On the static site
 * that sentence would be false: CurrentWire now writes original articles with
 * AI assistance. A trust page that misdescribes how the site works is worse
 * than no trust page, so this version replaces it wholesale.
 *
 * The numbers below are imported from the code that enforces them, so the
 * page cannot drift from the rules it describes.
 *
 * STANDING RULE: the operator line ("Operator details: to be published.") is
 * reproduced verbatim from the original and must not be changed here either.
 * tests/unit/static-site.test.ts asserts both copies carry it.
 */

const DESCRIPTION =
  "CurrentWire publishes original news articles, each built from reporting by more than one independent publication.";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: DESCRIPTION,
  path: "/about",
});

export default function AboutPage() {
  return (
    <ProsePage eyebrow="CurrentWire" title="About CurrentWire" intro={DESCRIPTION}>
      <p>
        Each day CurrentWire picks a small number of stories — no more than{" "}
        {DAILY_TARGET} — that several newsrooms have reported independently. We
        read that coverage, keep the facts the reports agree on, and write an
        original article from them. Every article links to the publications it
        draws on, so you can check the account yourself.
      </p>

      <h2>What makes a story eligible</h2>
      <ul>
        <li>
          <strong>More than one newsroom.</strong> At least{" "}
          {MIN_INDEPENDENT_DOMAINS} independent publications must have reported
          it. A story only one outlet has is not ours to retell.
        </li>
        <li>
          <strong>Reporting you can open.</strong> At least {MIN_FREE_SOURCES} of
          those publications must be free to read, so no article asks you to
          trust claims you cannot check.
        </li>
        <li>
          <strong>Reporting, not announcements.</strong> Press releases never
          count as independent coverage, and a story carried mostly by opinion
          pieces has no agreed facts to write from.
        </li>
      </ul>
      <p>
        We cover technology, business and science. The full rules are in our{" "}
        <Link href="/editorial-standards">editorial standards</Link>, and{" "}
        <Link href="/methodology">our methodology</Link> explains how reports of
        the same event are grouped and ranked.
      </p>

      <h2>How articles are written</h2>
      <p>
        Articles are written with AI assistance by the{" "}
        <Link href="/news-desk">CurrentWire News Desk</Link>, and every article
        says so. The writing step is given the facts the reports agree on and a
        list of the publications — not their article text — so what it produces
        is our own account, not a rewording of someone else&rsquo;s. We do not
        invent bylines.
      </p>
      <p>
        Stories involving crime or the courts, health, or personal finance are
        held for human review before they can be published.
      </p>

      <h2>What changed in September 2026</h2>
      <p>
        CurrentWire used to publish automated summaries of thousands of stories
        a day. We retired that deliberately in favour of fewer, original,
        better-sourced articles. If you followed a link to an old story page, it
        will no longer be found.
      </p>

      <h2>When we get it wrong</h2>
      <p>
        Errors are corrected on the article itself, dated, with a note of what
        changed. See the <Link href="/corrections">corrections policy</Link>.
      </p>

      <h2>Who runs CurrentWire</h2>
      <p>
        CurrentWire ({siteConfig.domain}) is an independently operated news
        publication. General enquiries:{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        Corrections:{" "}
        <a href={`mailto:${siteConfig.correctionsEmail}`}>
          {siteConfig.correctionsEmail}
        </a>
        . Publishers:{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>
          {siteConfig.publishersEmail}
        </a>
        .
      </p>
      <p>
        <em>Operator details: to be published.</em>
      </p>

      <h2>Contact</h2>
      <p>
        Questions, corrections and publisher enquiries:{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>{" "}
        — or see the <Link href="/contact">contact page</Link>.
      </p>
      <TrustPageJsonLd
        path="/about"
        name="About CurrentWire"
        description={DESCRIPTION}
        type="AboutPage"
      />
    </ProsePage>
  );
}
