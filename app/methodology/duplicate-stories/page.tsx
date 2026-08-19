import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import {
  CONFLICTING_ACTION_MARGIN,
  CROSS_CATEGORY_MARGIN,
  FINGERPRINT_CONTAINMENT_NO_ACTION,
  FINGERPRINT_CONTAINMENT_SHARED_ACTION,
  FINGERPRINT_CONTAINMENT_WIDE_ANCHOR,
  FINGERPRINT_SIMILARITY_THRESHOLD,
  MIN_LEAD_SIMILARITY,
  SIMILARITY_THRESHOLD,
  TIME_WINDOW_HOURS,
  WIDE_ANCHOR_MIN_RARE_STEMS,
} from "@/lib/news/clustering/cluster";
import { MIN_SHARED_RARE_STEMS } from "@/lib/news/clustering/fingerprint";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ReferencePageJsonLd } from "@/lib/seo/structured-data";

const PATH = "/methodology/duplicate-stories";
const TITLE = "How Duplicate Stories Are Merged";
const DESCRIPTION =
  "How CurrentWire decides that several publications are reporting the same event, merges their reports into one story page, and how accurate that decision is.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

/** Thresholds render from the production constants, at a fixed 2 decimals. */
const bar = (value: number): string =>
  (Math.round(value * 100) / 100).toFixed(2);

/**
 * NO accuracy figure is published on this page, deliberately.
 *
 * The clustering eval runs on tests/fixtures/cluster-pairs.ts, whose own
 * header states that every pair is SYNTHETIC — invented towns, companies,
 * teams and people. A score on invented headlines is not a measurement of how
 * this system performs on real news, and the SEO playbook's rule is explicit:
 * real-headline accuracy is the only accuracy we quote. So the page states the
 * CI CONTRACT (the gates asserted in tests/unit/cluster-eval.test.ts), says
 * plainly where those pairs come from, and quotes no measured precision or
 * recall. Do not reintroduce one from data/benchmark-history.json.
 */
const PRECISION_GATE = "0.98";
const RECALL_GATE = "0.8";

export default function DuplicateStoriesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Methodology", path: "/methodology" },
          { name: "Duplicate stories", path: PATH },
        ]}
      />
      <ReferencePageJsonLd name={TITLE} description={DESCRIPTION} path={PATH} />
      <ProsePage
        eyebrow="Methodology reference"
        title="How Duplicate Stories Are Merged"
        intro="When ten newsrooms report one event, CurrentWire shows one story with ten sources instead of ten near-identical headlines. This page explains the rules that decide whether two reports describe the same event — and how often they get it right."
      >
        <p>
          The <Link href="/methodology">methodology page</Link> describes this
          step in a paragraph. This is the detail behind it.
        </p>

        <h2>The fixed limits</h2>
        <ul>
          <li>
            Only reports published within {TIME_WINDOW_HOURS} hours of each
            other are ever treated as the same event.
          </li>
          <li>
            Two reports from the same publisher domain are never merged on the
            strength of their resemblance to each other. A publication cannot
            corroborate itself — and because breadth counts domains rather than
            articles, a publication filing three updates still counts once.
          </li>
          <li>
            Nothing here uses a language model. The rules are lexical and
            deterministic: the same set of headlines always produces the same
            grouping.
          </li>
          <li>
            Merging never hides anything. Every report in a grouped story keeps
            its own headline, publication name, timestamp and link to the
            original.
          </li>
        </ul>

        <h2>Step 1 — do the words agree?</h2>
        <p>
          Two headlines are first compared on surface wording. Three overlaps
          are measured, each as a share of what the two headlines have between
          them:
        </p>
        <ul>
          <li>
            <strong>Significant words</strong> — half the weight. Filler such as
            the, said, will and new is discarded first.
          </li>
          <li>
            <strong>Adjacent word pairs</strong> — three tenths. This is what
            separates &ldquo;Ontario bans the drug&rdquo; from &ldquo;drug ban
            hits Ontario&rdquo;, where the words match but the phrasing does
            not.
          </li>
          <li>
            <strong>Named entities</strong> — two tenths. The people, places and
            organizations extracted from each headline.
          </li>
        </ul>
        <p>
          The combined figure merges a pair at {bar(SIMILARITY_THRESHOLD)}. Two
          surcharges apply on this route: a pair whose categories disagree must
          reach {bar(SIMILARITY_THRESHOLD + CROSS_CATEGORY_MARGIN)}, and a pair
          whose verbs actively contradict each other must reach{" "}
          {bar(SIMILARITY_THRESHOLD + CONFLICTING_ACTION_MARGIN)}.
        </p>

        <h2>Step 2 — does the event agree?</h2>
        <p>
          Word overlap alone cannot carry heavily reworded coverage. &ldquo;US
          missionary kidnapped in Niger is released&rdquo; and &ldquo;American
          aid worker freed after months in captivity&rdquo; are one event and
          share almost no words. So each headline also gets an event
          fingerprint:
        </p>
        <ul>
          <li>
            <strong>Words are reduced to a common stem</strong> for matching
            only, never for display — kidnap, kidnapped and kidnapping become
            one key.
          </li>
          <li>
            <strong>News verbs are collapsed into synonym groups</strong>:
            released and freed describe the same act, as do arrested and
            detained, or dies and dead.
          </li>
          <li>
            <strong>Words are weighted by rarity</strong> within the batch of
            headlines being processed, so a distinctive word carries far more
            weight than a common one.
          </li>
          <li>
            <strong>Calendar words, nationalities and attribution boilerplate
            are ignored</strong> — Tuesday, American, police say, officials
            said. They describe when something happened, who was involved in
            general terms, and how it was sourced. They do not identify the
            event.
          </li>
        </ul>
        <p>
          A pair may only take this relaxed route on strong evidence: at least{" "}
          {MIN_SHARED_RARE_STEMS} shared rare words, at least one of them a
          proper noun anchoring a place or an actor, and no contradicting verbs.
          It then merges at a fingerprint agreement of{" "}
          {bar(FINGERPRINT_SIMILARITY_THRESHOLD)}.
        </p>

        <h2>Step 3 — is one headline contained in the other?</h2>
        <p>
          Rewordings are often lopsided. One outlet writes a long headline
          carrying the person&rsquo;s full name and how long the ordeal lasted;
          another writes a short one. Measured as a share of everything both
          headlines contain, the pair looks weak — measured against the shorter
          headline alone, it is nearly total. So a strong-fingerprint pair can
          also merge on containment, at a bar that depends on how much the verbs
          confirm:
        </p>
        <ul>
          <li>
            {bar(FINGERPRINT_CONTAINMENT_SHARED_ACTION)} when both headlines
            name the same act;
          </li>
          <li>
            {bar(FINGERPRINT_CONTAINMENT_NO_ACTION)} when only one names it, or
            neither does — near-total containment is then required;
          </li>
          <li>
            {bar(FINGERPRINT_CONTAINMENT_WIDE_ANCHOR)} when the pair shares{" "}
            {WIDE_ANCHOR_MIN_RARE_STEMS} or more rare anchors — place, subject
            and object, not just a name — and names the same act.
          </li>
        </ul>

        <h2>Step 4 — obituaries</h2>
        <p>
          One person&rsquo;s death is reported as &ldquo;dies at 82&rdquo;,
          &ldquo;dead at 82&rdquo; and &ldquo;Obituary: remembered as&rdquo;,
          and the only material those headlines share is the name. Left to the
          general rules they split into several pages. A dedicated rule merges
          them when all of the following hold: both headlines carry an explicit
          death signal, they share a personal-name anchor, and they do not
          disagree about any other act. Two different people dying on the same
          day share none of that.
        </p>

        <h2>What stops a story swallowing its neighbours</h2>
        <ul>
          <li>
            <strong>Contradicting verbs veto.</strong> When both headlines name
            an act and share none, they describe different events however much
            their nouns overlap — a volcano erupting and flights resuming as the
            ash clears are not the same story.
          </li>
          <li>
            <strong>Chains are broken up.</strong> Grouping can otherwise link A
            to C through B. After grouping, each member must still resemble the
            story&rsquo;s lead report at {bar(MIN_LEAD_SIMILARITY)} or support a
            majority of the other members. Members that do neither are pushed
            back out into stories of their own.
          </li>
          <li>
            <strong>The same publisher never counts twice</strong>, on any
            route.
          </li>
        </ul>

        <h2>How the merge rules are tested</h2>
        <p>
          Every change to these rules is run against a labeled set of headline
          pairs, each pair marked by hand as the same event, a related but
          different event, or unrelated. The set is weighted toward deep
          paraphrases and near-miss traps, because those are where automated
          grouping fails.
        </p>
        <p>
          Those pairs are <strong>written for the test</strong> — invented
          towns, companies, teams and people — not sampled from live coverage.
          A score on invented headlines says whether a change made the rules
          better or worse; it does not say how often CurrentWire gets real news
          right. So no accuracy percentage is published here, and none should be
          read into the gates below.
        </p>
        <p>
          What the test does enforce is a contract, and the contract is
          deliberately lopsided. A wrong merge corrupts a story page by
          attaching reporting that does not belong to it; a missed merge only
          leaves two pages where there should be one. Precision is therefore
          held far above recall: on that labeled set, the build fails if
          precision falls below {PRECISION_GATE} or recall below {RECALL_GATE}.
          The real check on the rules is the{" "}
          <Link href="/corrections">corrections process</Link> — reports about
          actual stories, on actual headlines.
        </p>

        <h2>When it gets it wrong</h2>
        <p>
          Both failure modes happen: two pages for one event, or a report in a
          source list that does not belong there. Automated grouping without
          human review cannot avoid that entirely, and the honest position is to
          say so and fix what is reported. The{" "}
          <Link href="/corrections">corrections process</Link> explains how.
        </p>
        <p>
          Fixing it does not break links. A story keeps its identity across
          refreshes, but its address can still change: the address is built
          from the headline the page leads with, and a higher-tier publication
          joining the coverage can take that lead. When that happens the old
          address keeps working and redirects to the current one. When two
          pages turn out to cover one event, the older address permanently
          redirects to the surviving page. Either way, a published story URL
          never breaks — CurrentWire does not delete story URLs.
        </p>

        <h2>Related references</h2>
        <ul>
          <li>
            <Link href="/methodology">How CurrentWire ranks the news</Link> —
            all six signals and their weights.
          </li>
          <li>
            <Link href="/methodology/coverage-breadth">
              What coverage breadth measures
            </Link>{" "}
            — what the grouped sources are then worth.
          </li>
          <li>
            <Link href="/methodology/publisher-tiers">
              Publisher authority tiers
            </Link>{" "}
            — which grouped report becomes the one you read.
          </li>
          <li>
            <Link href="/editorial-standards">Editorial standards</Link> — the
            accuracy, attribution and labeling rules around all of this.
          </li>
        </ul>
      </ProsePage>
    </>
  );
}
