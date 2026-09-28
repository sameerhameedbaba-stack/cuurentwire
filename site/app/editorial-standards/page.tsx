import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { MIN_FREE_SOURCES, MIN_INDEPENDENT_DOMAINS } from "@/lib/editorial/eligibility";
import { DAILY_TARGET } from "@/lib/editorial/selection";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/**
 * STATIC-SITE OVERLAY for /editorial-standards.
 *
 * The Vercel version opens "CurrentWire is an aggregator, not a newsroom … no
 * AI-generated reporting". The static site publishes original, AI-assisted
 * articles, so this replaces it. Each standard here is one the code enforces:
 * the thresholds are imported from lib/editorial/, and the sourcing rules are
 * also enforced by the article schema (lib/editorial/article.ts), so an article
 * that breaks them cannot be built.
 */

const DESCRIPTION =
  "The rules every CurrentWire article follows: how stories are chosen, how they are sourced and written, and how errors are corrected.";

export const metadata: Metadata = pageMetadata({
  title: "Editorial Standards",
  description: DESCRIPTION,
  path: "/editorial-standards",
});

export default function EditorialStandardsPage() {
  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="Editorial Standards"
      intro="CurrentWire writes original articles from reporting by several independent publications. These are the rules every article follows."
    >
      <h2>Sourcing</h2>
      <p>
        A story is eligible only when at least {MIN_INDEPENDENT_DOMAINS}{" "}
        independent publications have reported it, and at least{" "}
        {MIN_FREE_SOURCES} of them are free to read. Two reports from the same
        publication count once. Press releases and wire-distributed
        announcements never count as independent coverage. These rules are
        enforced by our publishing system: an article that does not meet them
        cannot be published.
      </p>

      <h2>Accuracy</h2>
      <p>
        Articles are written from the facts the publications agree on. We do
        not invent quotes, numbers, dates or outcomes; if a detail is not in the
        reporting, it is not in the article. Where reports disagree, we say so
        rather than choose the tidier version.
      </p>

      <h2>Attribution</h2>
      <p>
        Accusations, allegations and disputed claims are attributed, in the
        sentence, to the publication that reported them. Every article lists
        and links the publications it draws on, and marks any that need a
        subscription.
      </p>

      <h2>Originality</h2>
      <p>
        We write our own account of events. The writing step works from a list
        of facts and publications, not from other outlets&rsquo; article text,
        so it does not reproduce their wording. We link to their reporting; we
        do not republish it.
      </p>

      <h2>AI assistance</h2>
      <p>
        Articles are written with AI assistance and every article says so. The
        byline is the <Link href="/news-desk">CurrentWire News Desk</Link>, not
        an invented person. Using AI does not change who is responsible: an
        error in a CurrentWire article is ours.
      </p>

      <h2>Human review</h2>
      <p>
        Stories involving crime or the courts, health, or personal finance are
        held for human review before they can be published. We do not attempt
        to decide automatically whether someone named in a crime story is a
        public figure; any such story waits for a person.
      </p>

      <h2>Volume</h2>
      <p>
        We publish at most {DAILY_TARGET} articles a day. That is a ceiling, not
        a quota: on a day when fewer stories meet these standards, we publish
        fewer.
      </p>

      <h2>Neutrality</h2>
      <p>
        Headlines describe events rather than argue positions. Publication
        authority reflects journalistic standing, never political orientation —
        see <Link href="/methodology/publisher-tiers">publisher authority tiers</Link>.
      </p>

      <h2>Keywords and headlines</h2>
      <p>
        We use search data to understand what readers are looking for, but a
        headline must describe the story truthfully first. We never bend a
        headline around a search phrase the story does not support.
      </p>

      <h2>Corrections</h2>
      <p>
        Errors are corrected on the article, dated, with a note of what was
        wrong and what it now says. See the{" "}
        <Link href="/corrections">corrections policy</Link>.
      </p>

      <h2>Questions about these standards</h2>
      <p>
        Standards nobody can question are not standards. Questions and
        disagreements are welcome through the <Link href="/contact">contact page</Link>.
      </p>
      <TrustPageJsonLd path="/editorial-standards" name="Editorial Standards" description={DESCRIPTION} />
    </ProsePage>
  );
}
