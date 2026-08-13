import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/ProsePage";
import { RANKING_WEIGHTS } from "@/lib/news/ranking/score";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Methodology",
  description:
    "How CurrentWire ranks the news: freshness, source authority, coverage breadth, geographic relevance and story velocity.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <ProsePage
      eyebrow="Transparency"
      title="How CurrentWire Ranks the News"
      intro="CurrentWire uses a combination of freshness, source authority, breadth of coverage, geographic relevance and the speed at which a story is developing to identify major current-affairs stories."
    >
      <p>
        No single signal determines placement. The ranking system is designed to
        distinguish between something that is merely <em>new</em> and something
        that is genuinely <em>important</em>. Every story receives a score from
        0 to 100 built from the weighted signals below.
      </p>

      <h2>Freshness — {RANKING_WEIGHTS.freshness} points</h2>
      <p>
        Recent coverage scores highest, decaying smoothly over time. Stories
        published in the past 24 hours dominate; major developing stories can
        remain prominent for 48–72 hours; nothing older than 72 hours is ranked.
        Time decay means an old story never stays on top purely because it once
        mattered.
      </p>

      <h2>Source authority — {RANKING_WEIGHTS.authority} points</h2>
      <p>
        Publications are grouped into configurable authority tiers reflecting
        journalistic reputation and reach: major wire services, public-service
        broadcasters and national publications; strong regional and specialist
        outlets; and smaller credible publications. Authority measures
        journalistic standing — never political orientation.
      </p>

      <h2>Coverage breadth — {RANKING_WEIGHTS.coverage} points</h2>
      <p>
        A story independently reported by ten credible publications generally
        matters more than one reported by a single outlet two minutes later.
        Duplicate reports of the same event are clustered into one story, and
        the number of distinct publications covering it feeds this signal.
      </p>

      <h2>Geographic relevance — {RANKING_WEIGHTS.geography} points</h2>
      <p>
        CurrentWire focuses on the United States and Canada. Classification is
        based on what a story is about — its institutions, places and topics —
        not on where the publisher happens to be headquartered. A wire-service
        story about the Canadian government is a Canada story.
      </p>

      <h2>Story prominence — {RANKING_WEIGHTS.prominence} points</h2>
      <p>
        Completeness signals — a usable summary, imagery, identifiable
        institutions and places — indicate substantive reporting and improve a
        story’s presentation score.
      </p>

      <h2>Velocity — {RANKING_WEIGHTS.velocity} points</h2>
      <p>
        How quickly new reports are accumulating. A story attracting several new
        reports within a few hours is developing; one that stopped attracting
        coverage is settling.
      </p>

      <h2>Duplicate clustering</h2>
      <p>
        Multiple publications reporting the same event are grouped into a single
        canonical story using headline similarity, shared entities and
        publication timing. The story page lists every publication’s report with
        a link to the original.
      </p>

      <h2>Breaking and developing labels</h2>
      <p>
        <strong>Breaking</strong> is reserved for at most one story at a time:
        the top-ranked story, only while it is very fresh and broadly covered.
        <strong> Developing</strong> and <strong>Updated</strong> reflect
        observable coverage patterns — never editorial dramatization.
      </p>

      <p>
        Ranking systems can make mistakes. CurrentWire continuously evaluates
        and improves its methodology.
      </p>
    </ProsePage>
  );
}
