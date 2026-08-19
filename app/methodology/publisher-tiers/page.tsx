import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { SOURCES, TIER_WEIGHT, type SourceTier } from "@/config/sources";
import {
  PRESS_RELEASE_AUTHORITY_MULTIPLIER,
  RANKING_WEIGHTS,
} from "@/lib/news/ranking/score";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ReferencePageJsonLd } from "@/lib/seo/structured-data";

const PATH = "/methodology/publisher-tiers";
const TITLE = "Publisher Authority Tiers";
const DESCRIPTION =
  "CurrentWire groups publications into three authority tiers. What each tier means, what it is worth in ranking, and how unlisted publishers are handled.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

/**
 * Weights, points and counts are read from the live configuration
 * (config/sources.ts) and the live weights (lib/news/ranking/score.ts), never
 * typed into the copy — a tier change or a new publication updates this page
 * automatically. Demo outlets exist only for development mock mode and are
 * excluded from the counts.
 */
const points = (factor: number, weight: number): string =>
  (Math.round(factor * weight * 10) / 10).toFixed(1);

const configuredCount = (tier: SourceTier): number =>
  SOURCES.filter((source) => source.tier === tier && !source.demo).length;

const TIER_ROWS: { tier: SourceTier; what: string }[] = [
  {
    tier: "A",
    what: "Major wire services, public-service broadcasters and national publications.",
  },
  { tier: "B", what: "Strong regional and specialist publications." },
  {
    tier: "C",
    what: "Smaller credible publications — and any publisher CurrentWire holds no tier for.",
  },
];

export default function PublisherTiersPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Methodology", path: "/methodology" },
          { name: "Publisher tiers", path: PATH },
        ]}
      />
      <ReferencePageJsonLd name={TITLE} description={DESCRIPTION} path={PATH} />
      <ProsePage
        eyebrow="Methodology reference"
        title="Publisher Authority Tiers"
        intro="Every publication CurrentWire reads sits in one of three authority tiers. Tiers describe journalistic standing and reach — never political orientation. This page is the reference for what they mean, what they are worth, and what they deliberately do not do."
      >
        <p>
          Source authority is one of the six signals described on the{" "}
          <Link href="/methodology">methodology page</Link>. This page covers
          the tier system behind it. For the publications currently appearing in
          CurrentWire coverage, see <Link href="/sources">Sources</Link>.
        </p>

        <h2>The three tiers</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="py-2 pr-4 font-semibold">Tier</th>
                <th className="py-2 pr-4 font-semibold">Weight</th>
                <th className="py-2 pr-4 font-semibold">
                  Authority points (of {RANKING_WEIGHTS.authority})
                </th>
                <th className="py-2 font-semibold">Publications configured</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ROWS.map((row) => (
                <tr key={row.tier} className="border-b border-rule">
                  <td className="py-2 pr-4 font-semibold">Tier {row.tier}</td>
                  <td className="py-2 pr-4">
                    {TIER_WEIGHT[row.tier].toFixed(2)}
                  </td>
                  <td className="py-2 pr-4">
                    {points(TIER_WEIGHT[row.tier], RANKING_WEIGHTS.authority)}
                  </td>
                  <td className="py-2">{configuredCount(row.tier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {TIER_ROWS.map((row) => (
            <li key={row.tier}>
              <strong>Tier {row.tier}</strong> — {row.what}
            </li>
          ))}
        </ul>
        <p>
          The configured count is the number of publications with a tier on
          file. It is not the number of publications CurrentWire will show: any
          publisher appearing in a feed is read and indexed, whether or not it
          is on the list.
        </p>

        <h2>Only the strongest publication in a story counts</h2>
        <p>
          A story&rsquo;s authority score is set by the single highest tier
          among the publications covering it. If one Tier A wire service is in
          the list, the story takes the full{" "}
          {points(TIER_WEIGHT.A, RANKING_WEIGHTS.authority)} authority points;
          a second and a third Tier A do not raise it further.
        </p>
        <p>
          That is deliberate. <em>How many</em> publications covered a story is
          a separate signal with its own {RANKING_WEIGHTS.coverage} points —
          see{" "}
          <Link href="/methodology/coverage-breadth">
            what coverage breadth measures
          </Link>
          . Letting tier count breadth as well would pay large outlets twice and
          let a handful of them outweigh everything else.
        </p>

        <h2>Tier also decides whose headline you read</h2>
        <p>
          A story page shows one headline and one summary, chosen from the
          reports it groups. That choice is made by tier first, then by
          completeness — a report carrying both a summary and an image — and
          then by recency. Every other report stays listed underneath with its
          own headline, timestamp and link. Tier never removes a report from a
          story; it only decides which one represents it.
        </p>

        <h2>How a publication is matched to a tier</h2>
        <ul>
          <li>
            <strong>By domain first.</strong> Leading subdomain labels are
            stripped one at a time until a match is found, so{" "}
            <code>feeds.npr.org</code>, <code>edition.cnn.com</code> and{" "}
            <code>www.bbc.co.uk</code> resolve to the same publications as their
            bare domains.
          </li>
          <li>
            <strong>Publishers serving several domains are one publication.</strong>{" "}
            BBC News is matched on bbc.com, bbc.co.uk and bbci.co.uk; ABC News
            on abcnews.go.com and abcnews.com. One publication, one tier, one
            display name — this is also what stops a feed&rsquo;s channel title
            appearing in the interface as though it were a separate outlet.
          </li>
          <li>
            <strong>Then by name.</strong> If no domain matches, the publication
            name from the feed is tried.
          </li>
          <li>
            <strong>Otherwise Tier C.</strong> Unlisted does not mean untrusted.
            It means CurrentWire holds no assessment of that publisher&rsquo;s
            standing, so it receives the smallest of the three weights rather
            than being excluded from the site.
          </li>
        </ul>

        <h2>Press releases keep the domain but lose the credit</h2>
        <p>
          A press release published on a Tier A outlet&rsquo;s site is still the
          issuer&rsquo;s own communication. The outlet&rsquo;s tier says nothing
          about the editorial scrutiny the text received, because it received
          none. So when a story is classified as a press release, its authority
          input is multiplied by {PRESS_RELEASE_AUTHORITY_MULTIPLIER}: a Tier A
          release scores{" "}
          {points(
            TIER_WEIGHT.A * PRESS_RELEASE_AUTHORITY_MULTIPLIER,
            RANKING_WEIGHTS.authority,
          )}{" "}
          instead of {points(TIER_WEIGHT.A, RANKING_WEIGHTS.authority)}.
        </p>
        <p>
          Press-release stories are also kept out of every curated selection
          unless real newsrooms picked the story up, and can never carry the
          BREAKING label. Those rules are set out in the{" "}
          <Link href="/editorial-standards">editorial standards</Link>.
        </p>

        <h2>What tiers are not</h2>
        <ul>
          <li>
            <strong>Not a bias rating.</strong> Tiers describe reach and
            journalistic standing. CurrentWire publishes no ideology or bias
            score for any publication and uses none in ranking.
          </li>
          <li>
            <strong>Not an accuracy score.</strong> A tier is not a claim that a
            publication is right, and a lower tier is not a claim that one is
            wrong. Nothing on this site rates the correctness of a
            publisher&rsquo;s reporting.
          </li>
          <li>
            <strong>Not a partnership.</strong> Reading a publisher&rsquo;s
            public feed is aggregation. It implies no relationship, endorsement
            or agreement in either direction.
          </li>
          <li>
            <strong>Not a filter.</strong> Tier C reports appear in{" "}
            <Link href="/latest">Latest</Link>, in search, on their
            publisher&rsquo;s own page and in the sitemaps exactly like any
            other. Tier affects one of six signals, worth at most{" "}
            {RANKING_WEIGHTS.authority} of 100 points.
          </li>
        </ul>

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
            — the other half of the source question: not who, but how many.
          </li>
          <li>
            <Link href="/methodology/duplicate-stories">
              How duplicate stories are merged
            </Link>{" "}
            — how one event&rsquo;s reports become one story.
          </li>
          <li>
            <Link href="/sources">Sources</Link> — publications currently
            represented, grouped by tier.
          </li>
        </ul>
        <p>
          A publication placed in the wrong tier, or named incorrectly? The{" "}
          <Link href="/corrections">corrections process</Link> explains how to
          tell us.
        </p>
      </ProsePage>
    </>
  );
}
