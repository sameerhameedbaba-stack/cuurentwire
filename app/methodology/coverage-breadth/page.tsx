import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { TIER_WEIGHT, type SourceTier } from "@/config/sources";
import {
  coverageFactor,
  freshnessFactor,
  RANKING_WEIGHTS,
} from "@/lib/news/ranking/score";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ReferencePageJsonLd } from "@/lib/seo/structured-data";

const PATH = "/methodology/coverage-breadth";
const TITLE = "What Coverage Breadth Measures";
const DESCRIPTION =
  "Coverage breadth counts how many independent newsrooms reported an event, not how many article copies exist. What CurrentWire counts, and what it is worth.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

/**
 * Every figure below is COMPUTED from the production scoring functions
 * (lib/news/ranking/score.ts) instead of typed into the copy, so the page
 * cannot drift away from the code it describes. Nothing here is a benchmark
 * or a claim about the world — it is arithmetic on published weights.
 */
const points = (factor: number, weight: number): string =>
  (Math.round(factor * weight * 10) / 10).toFixed(1);

const COVERAGE_STEPS = [1, 2, 3, 4, 6, 8, 10, 12, 20];

/** Sum of only the three signals that differ in the worked example. */
function partialScore(hours: number, tier: SourceTier, sources: number): string {
  const total =
    freshnessFactor(hours) * RANKING_WEIGHTS.freshness +
    TIER_WEIGHT[tier] * RANKING_WEIGHTS.authority +
    coverageFactor(sources) * RANKING_WEIGHTS.coverage;
  return (Math.round(total * 10) / 10).toFixed(1);
}

export default function CoverageBreadthPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Methodology", path: "/methodology" },
          { name: "Coverage breadth", path: PATH },
        ]}
      />
      <ReferencePageJsonLd name={TITLE} description={DESCRIPTION} path={PATH} />
      <ProsePage
        eyebrow="Methodology reference"
        title="What Coverage Breadth Measures"
        intro="Coverage breadth is the CurrentWire ranking signal that asks how many newsrooms independently decided an event was worth reporting. This page defines exactly what gets counted, what does not, and how a count becomes points."
      >
        <p>
          This is a reference page for one of the six signals described on the{" "}
          <Link href="/methodology">methodology page</Link>. It goes into the
          detail that page summarizes in a paragraph.
        </p>

        <h2>The question this signal answers</h2>
        <p>
          Coverage breadth is worth {RANKING_WEIGHTS.coverage} of the 100 points
          in a story score. It stands in for a judgement no ranking system can
          make on its own: how many independent newsrooms looked at an event and
          decided it was worth a reporter&rsquo;s time. One outlet publishing
          first tells you something. Ten outlets publishing separately tells you
          more — and it tells you something freshness cannot.
        </p>

        <h2>What counts as one source</h2>
        <ul>
          <li>
            <strong>The unit is a publisher, not an article.</strong> Sources
            are counted as distinct publisher domains, lower-cased with a
            leading <code>www.</code> removed. A publication that files three
            updates on one event counts once.
          </li>
          <li>
            <strong>Press releases are not counted.</strong> An issuer&rsquo;s
            own announcement is not an independent report of it, so
            press-release members of a story are excluded from the count before
            the score is calculated.
          </li>
          <li>
            <strong>A story made only of press releases counts as one.</strong>{" "}
            However many sites carry the release, the scoring treats it as a
            single source — the issuer. The story page&rsquo;s source-mix line
            reports it honestly as zero independent editorial domains.
          </li>
        </ul>

        <h2>Why syndication does not widen coverage</h2>
        <p>
          A corporate announcement can go out on a newswire, be picked up by a
          financial site and reprinted by a portal within minutes. Three
          domains, one document, no additional reporting. Counting that as three
          sources would let anyone with a distribution budget buy a high
          ranking, so CurrentWire treats a distribution chain as one source.
        </p>
        <p>
          A release that real newsrooms then go and report is a different case:
          those newsrooms are counted normally, and the story becomes eligible
          for the ranked sections it was otherwise kept out of. The full rules
          for labeling and placing press releases are on the{" "}
          <Link href="/editorial-standards">editorial standards</Link> page.
        </p>

        <h2>How the count becomes a score</h2>
        <p>
          Breadth is scored on a logarithmic curve that reaches its maximum at
          twelve independent sources. These are the exact values the ranking
          engine produces:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="py-2 pr-4 font-semibold">Independent sources</th>
                <th className="py-2 font-semibold">
                  Points (of {RANKING_WEIGHTS.coverage})
                </th>
              </tr>
            </thead>
            <tbody>
              {COVERAGE_STEPS.map((count) => (
                <tr key={count} className="border-b border-rule">
                  <td className="py-2 pr-4">{count}</td>
                  <td className="py-2">
                    {points(coverageFactor(count), RANKING_WEIGHTS.coverage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The curve is steep at the start and flat at the end on purpose. Going
          from one source to two is the single most informative step there is:
          it is the difference between an unconfirmed report and a corroborated
          one. Going from eleven sources to twelve tells you almost nothing you
          did not already know, and beyond twelve the score does not move at
          all — a story cannot climb by accumulating pile-on coverage.
        </p>

        <h2>Breadth against freshness: a worked example</h2>
        <p>
          Freshness is the largest single signal at {RANKING_WEIGHTS.freshness}{" "}
          points, so it is fair to ask whether breadth ever actually wins.
          Consider two United States stories, one broadly covered but ten hours
          older, the other brand new and reported by nobody else. Geography is
          identical for both, and holding prominence and velocity equal, only
          three signals differ:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="py-2 pr-4 font-semibold">Signal</th>
                <th className="py-2 pr-4 font-semibold">
                  Story A — 12h old, 10 sources, Tier A present
                </th>
                <th className="py-2 font-semibold">
                  Story B — 2h old, 1 source, best tier B
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule">
                <td className="py-2 pr-4">Freshness</td>
                <td className="py-2 pr-4">
                  {points(freshnessFactor(12), RANKING_WEIGHTS.freshness)}
                </td>
                <td className="py-2">
                  {points(freshnessFactor(2), RANKING_WEIGHTS.freshness)}
                </td>
              </tr>
              <tr className="border-b border-rule">
                <td className="py-2 pr-4">Source authority</td>
                <td className="py-2 pr-4">
                  {points(TIER_WEIGHT.A, RANKING_WEIGHTS.authority)}
                </td>
                <td className="py-2">
                  {points(TIER_WEIGHT.B, RANKING_WEIGHTS.authority)}
                </td>
              </tr>
              <tr className="border-b border-rule">
                <td className="py-2 pr-4">Coverage breadth</td>
                <td className="py-2 pr-4">
                  {points(coverageFactor(10), RANKING_WEIGHTS.coverage)}
                </td>
                <td className="py-2">
                  {points(coverageFactor(1), RANKING_WEIGHTS.coverage)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-semibold">
                  Total of these three
                </td>
                <td className="py-2 pr-4 font-semibold">
                  {partialScore(12, "A", 10)}
                </td>
                <td className="py-2 font-semibold">{partialScore(2, "B", 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Story A is ten hours older and still ranks ahead. That is the intended
          behaviour: a list ordered purely by clock time is a feed, not a
          ranking. It is also why nothing stays on top forever — freshness
          decays continuously, and no story older than 72 hours is ranked at
          all, however broadly it was covered.
        </p>

        <h2>Where the count is visible</h2>
        <ul>
          <li>
            Every story page names each publication covering the event, with the
            time of its report and a link to the original.
          </li>
          <li>
            The automated coverage analysis on a story page breaks the mix down:
            independent editorial domains, press releases, and opinion or
            analysis pieces.
          </li>
          <li>
            Corroborated details only list a phrase when it appears verbatim in
            reports from at least two distinct independent domains. Same-domain
            repetition never corroborates anything.
          </li>
          <li>
            The BREAKING label requires breadth, not just speed: four or more
            independent sources, or three including a Tier A publication, on top
            of a very high score and coverage under 90 minutes old. At most one
            story carries it at a time.
          </li>
        </ul>

        <h2>What coverage breadth is not</h2>
        <ul>
          <li>
            <strong>Not a truth test.</strong> Twenty outlets can carry the same
            wire copy and all be wrong together. Breadth measures how many
            newsrooms judged an event significant, not whether their reporting
            is correct.
          </li>
          <li>
            <strong>Not popularity.</strong> It counts publication decisions,
            never traffic, clicks, shares or comments. CurrentWire does not rank
            on engagement and collects no engagement data to rank on.
          </li>
          <li>
            <strong>Not political balance.</strong> Which newsrooms covered an
            event is an observation. It is not a claim that the coverage was
            balanced, and it is never adjusted for the politics of the outlets
            involved.
          </li>
        </ul>

        <h2>Related references</h2>
        <ul>
          <li>
            <Link href="/methodology">How CurrentWire ranks the news</Link> —
            all six signals and their weights.
          </li>
          <li>
            <Link href="/methodology/publisher-tiers">
              Publisher authority tiers
            </Link>{" "}
            — the other half of the source question: not how many, but who.
          </li>
          <li>
            <Link href="/methodology/duplicate-stories">
              How duplicate stories are merged
            </Link>{" "}
            — how reports of one event are grouped before they are counted.
          </li>
          <li>
            <Link href="/sources">Sources</Link> — the publications currently
            represented in CurrentWire coverage.
          </li>
        </ul>
        <p>
          Think a story&rsquo;s source list is wrong? The{" "}
          <Link href="/corrections">corrections process</Link> explains how to
          report it.
        </p>
      </ProsePage>
    </>
  );
}
