import Link from "next/link";
import { buildStoryContext } from "@/lib/news/story-context";
import type { StoryCluster } from "@/lib/news/types";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * CurrentWire's own record of this story — the original, CurrentWire-authored
 * content on a story page.
 *
 * Backlog item 3: 300 of 313 news-sitemap URLs (censused 2026-08-19) carry a
 * single report, so the page body was a publisher dek plus labels. Every value
 * below is stated from data the page already loaded: the lead publisher's
 * identity and authority tier, the timestamps already in the byline,
 * CurrentWire's own ranking breakdown, the classification, and the live topic
 * counts the page built for its chips. No claim about the NEWS is made here.
 *
 * DELIBERATELY TINY. The obvious version of this module carried ~218 words of
 * standing explanation ("CurrentWire scores every story from 0 to 100 and
 * orders every ranked page by that score", "the geography label describes what
 * the story is about…") that would render byte-identical on all 2,199
 * permanent story URLs. On a site already fighting duplicate content that is a
 * liability, not substance, so every such sentence was cut and replaced with a
 * link to the reference page that owns it: /methodology,
 * /methodology/publisher-tiers. What is left changes from story to story.
 *
 * The ranking block is dropped entirely for archive-rebuilt clusters, whose
 * breakdown is all zeros with a stale total (see buildStoryContext).
 */
export function StoryContext({
  cluster,
  publishedByUsAt,
  topicCounts,
  isArchived = false,
}: {
  cluster: StoryCluster;
  publishedByUsAt?: string;
  /** Live cluster counts keyed by `topicKey` — built by the story page. */
  topicCounts?: ReadonlyMap<string, number>;
  isArchived?: boolean;
}) {
  const facts = buildStoryContext(cluster, {
    publishedByUsAt,
    topicCounts,
    isArchived,
  });

  return (
    <section aria-labelledby="story-context-heading" className="mt-10">
      <h2
        id="story-context-heading"
        className="headline border-t-2 border-ink pb-1 pt-3 text-xl dark:border-rule-strong"
      >
        How CurrentWire compiled this story
      </h2>

      <p className="mt-3 text-sm leading-relaxed">
        {facts.leadSource} ({facts.leadDomain}), a{" "}
        <Link
          href="/methodology/publisher-tiers"
          className="underline underline-offset-2 hover:text-brand-ink"
        >
          Tier {facts.leadTier}
        </Link>{" "}
        publisher, filed this report on{" "}
        <time dateTime={facts.leadPublishedAt}>
          {fullTimestamp(facts.leadPublishedAt)}
        </time>
        {facts.author ? <>, bylined {facts.author}</> : null}.
        {facts.publishedByUsAt ? (
          <>
            {" "}
            CurrentWire published this page
            {facts.pickupDelay ? ` ${facts.pickupDelay} later` : ""}, on{" "}
            <time dateTime={facts.publishedByUsAt}>
              {fullTimestamp(facts.publishedByUsAt)}
            </time>
            .
          </>
        ) : null}
      </p>

      {facts.signals.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Signal breakdown
          </h3>
          <p className="mt-1 text-sm leading-relaxed">
            CurrentWire ranked this story {facts.score} of 100 in the snapshot
            this page was rendered from.
          </p>
          <dl className="mt-2 text-sm sm:grid sm:grid-cols-2 sm:gap-x-8">
            {facts.signals.map((signal) => (
              <div
                key={signal.key}
                className="flex justify-between gap-4 border-b border-rule py-1"
              >
                <dt>{signal.label}</dt>
                <dd className="tabular-nums text-muted">
                  {signal.points} of {signal.max}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm leading-relaxed">
            {facts.strongest ? (
              <>
                Strongest signal: {facts.strongest.label.toLowerCase()},{" "}
                {facts.strongest.points} of {facts.strongest.max}.{" "}
              </>
            ) : null}
            <Link
              href="/methodology"
              className="underline underline-offset-2 hover:text-brand-ink"
            >
              How each signal is calculated
            </Link>
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed">
        Filed under{" "}
        <Link
          href={facts.categoryPath}
          className="underline underline-offset-2 hover:text-brand-ink"
        >
          {facts.categoryLabel}
        </Link>{" "}
        · {facts.countryLabel} · {facts.contentTypeLabel}.
        {facts.topics.length > 0 ? (
          <>
            {" "}
            Topics extracted from this report, with other live CurrentWire
            stories mentioning each:{" "}
            {facts.topics.map((topic, index) => (
              <span key={topic.name}>
                {index > 0 ? ", " : ""}
                {topic.name}
                {topic.others === undefined
                  ? ""
                  : topic.others === 0
                    ? " (none)"
                    : ` (${topic.others})`}
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
    </section>
  );
}
