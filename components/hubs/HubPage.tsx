import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/config/categories";
import { HUBS, HUB_IDS, type HubId } from "@/config/hubs";
import { TRACKED_PUBLISHER_COUNT } from "@/config/sources";
import { LastUpdated } from "@/components/news/LastUpdated";
import { RankedStory } from "@/components/news/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDataset } from "@/lib/cache/store";
import { hubStats, hubStories } from "@/lib/news/hubs";
import { NOINDEX_FOLLOW, shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

/** Ranks 1–4 render above the fold: their thumbnails load eagerly. */
const EAGER_THUMBNAILS = 4;

/** "AI News — Today's Top…" → "AI News" for the on-page h1. */
function heading(title: string): string {
  return title.split(" — ")[0] ?? title;
}

/**
 * Builds the route exports for one topic hub. Each app/<hub>/page.tsx is a
 * three-line file re-exporting these, so the 15 hubs share one renderer
 * while keeping clean root-level URLs (/ai, /immigration, /elections).
 */
export function createHubPage(id: HubId) {
  const hub = HUBS[id];
  const path = `/${id}`;

  async function generateMetadata(): Promise<Metadata> {
    const dataset = await getDataset();
    const stories = hubStories(dataset, id);
    const metadata = pageMetadata({
      title: hub.title,
      description: hub.description,
      path,
    });
    // Thin hubs stay crawlable (follow) but out of the index until the
    // topic has enough real stories — same bar as topic and source hubs.
    if (!shouldIndexCollection(stories.length)) {
      metadata.robots = NOINDEX_FOLLOW;
    }
    return metadata;
  }

  async function Page() {
    const dataset = await getDataset();
    const stories = hubStories(dataset, id);
    const stats = hubStats(dataset, id);
    const h1 = heading(hub.title);
    const chip =
      "block whitespace-nowrap rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink";

    return (
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <meta name="cw-dataset-version" content={dataset.datasetVersion} />
        <BreadcrumbJsonLd
          items={[
            { name: "Home", path: "/" },
            { name: "Topics", path: "/topics" },
            { name: hub.label, path },
          ]}
        />
        <ItemListJsonLd clusters={stories} path={path} name={h1} />

        <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
            <Link href="/topics" className="hover:underline">
              Topic hub
            </Link>
          </p>
          <h1 className="headline mt-1 text-3xl sm:text-4xl">{h1}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            {hub.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <LastUpdated generatedAt={dataset.generatedAt} />
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {hub.sections.map((section) => (
                <Link
                  key={section}
                  href={CATEGORIES[section].path}
                  className="text-muted underline-offset-2 hover:text-brand-ink hover:underline"
                >
                  All {CATEGORIES[section].label} &rarr;
                </Link>
              ))}
            </div>
          </div>
        </header>

        <nav
          aria-label="Other topic hubs"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto border-b border-rule px-4 py-3 sm:-mx-6 sm:px-6"
        >
          {HUB_IDS.filter((other) => other !== id).map((other) => (
            <Link key={other} href={`/${other}`} className={chip}>
              {HUBS[other].label}
            </Link>
          ))}
        </nav>

        {/* Coverage snapshot — the one thing on this page that is ours.
            Added 2026-08-25 after the first URL-Inspection sweep found all 15
            hubs "Discovered — currently not indexed" while being in the
            sitemap, index,follow and internally linked: nothing was broken,
            Google was declining index budget on pages that only re-list other
            publishers' headlines (seo/BACKLOG.md, STRATEGY BET 2). Counts come
            from hubStats() over the hub's full story set — no new IO. */}
        {stats.total > 0 ? (
          <p className="mt-5 border-l-2 border-brand pl-4 text-sm text-muted">
            In the current snapshot, {stats.total}{" "}
            {stats.total === 1 ? "story" : "stories"} in {hub.label} from{" "}
            {/* The pipeline also admits publishers outside config/sources.ts,
                so the tracked subset is named separately — the bare publisher
                count could otherwise exceed the denominator it cites. */}
            {stats.publishers === stats.trackedPublishers ? (
              <>
                {stats.publishers} of the {TRACKED_PUBLISHER_COUNT} publications
                CurrentWire tiers by authority.
              </>
            ) : (
              <>
                {stats.publishers} publications, {stats.trackedPublishers} of
                them among the {TRACKED_PUBLISHER_COUNT} CurrentWire tiers by
                authority.
              </>
            )}{" "}
            {stats.broadest ? (
              <>
                {stats.total === 1 ? "It is" : "The most widely reported is"}{" "}
                <Link
                  href={`/story/${stats.broadest.slug}`}
                  className="underline hover:text-brand-ink"
                >
                  {stats.broadest.title}
                </Link>
                , carried by {stats.broadest.sourceCount} of them.
                {stats.total > 1 ? (
                  <>
                    {" "}
                    {stats.multiSource} of the {stats.total} are carried by two
                    or more.
                  </>
                ) : null}
              </>
            ) : (
              <>
                {stats.total === 1
                  ? "It is carried by a single publication."
                  : "None is carried by more than one of those publications."}
              </>
            )}
            {/* Cap honesty: the count above covers the whole hub, the list
                below is capped — say so whenever they differ. */}
            {stats.total > stories.length ? (
              <> Showing the top {stories.length} below.</>
            ) : null}
          </p>
        ) : null}

        {stories.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              message={`No ${hub.label} stories are in the current ranking. The list refreshes every few minutes.`}
              actionLabel="Browse the latest headlines"
              actionHref="/latest"
            />
          </div>
        ) : (
          <ol className="mt-2" aria-label={`${hub.label} stories`}>
            {stories.map((cluster, index) => (
              <li key={cluster.id}>
                <RankedStory
                  cluster={cluster}
                  rank={index + 1}
                  eagerThumbnail={index < EAGER_THUMBNAILS}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return { generateMetadata, Page };
}
