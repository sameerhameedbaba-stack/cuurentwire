import Link from "next/link";
import type { Article, StoryCluster } from "@/lib/news/types";
import { CategoryLabel, ContentTypeBadge, CountryBadge, SourceLine, StatusBadge, Timestamp } from "./atoms";
import { StoryImage } from "./StoryImage";

function storyHref(cluster: StoryCluster): string {
  return `/story/${cluster.slug}`;
}

/** Dominant lead story — homepage hero. */
export function HeroStory({
  cluster,
  headingLevel = "h1",
  optimize = false,
}: {
  cluster: StoryCluster;
  /** Pages that render their own h1 (country/category) demote the hero to h2. */
  headingLevel?: "h1" | "h2";
  /**
   * Route the hero through the image optimizer (allowlisted hosts only).
   * ONLY the homepage passes this: the optimizer quota (5,000/month) is
   * budgeted for one hero — see next.config.ts. Section/country heroes and
   * story pages keep the raw publisher image.
   */
  optimize?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <article className="group">
      <Link href={storyHref(cluster)} className="block">
        <StoryImage
          src={cluster.imageUrl}
          alt={cluster.title}
          category={cluster.category}
          aspect="16/9"
          sizes="(max-width: 1024px) 100vw, 58vw"
          priority
          optimize={optimize}
        />
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <CategoryLabel category={cluster.category} />
        <CountryBadge country={cluster.country} />
        <StatusBadge status={cluster.status} />
        <ContentTypeBadge contentType={cluster.contentType} />
      </div>
      <Heading className="headline mt-2 text-[2rem] leading-[1.08] sm:text-[2.5rem] lg:text-[3.25rem]">
        <Link href={storyHref(cluster)} className="hover:text-brand-ink">
          <span className="story-link">{cluster.title}</span>
        </Link>
      </Heading>
      {cluster.summary ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          {cluster.summary}
        </p>
      ) : null}
      <SourceLine
        source={cluster.lead.source}
        publishedAt={cluster.lastPublishedAt}
        isMock={cluster.isMock}
        sourceCount={cluster.sourceCount}
        className="mt-3"
      />
    </article>
  );
}

/** Major story — section leads. */
export function MajorStory({ cluster }: { cluster: StoryCluster }) {
  return (
    <article className="group">
      <Link href={storyHref(cluster)} className="block">
        <StoryImage
          src={cluster.imageUrl}
          alt={cluster.title}
          category={cluster.category}
          aspect="3/2"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <CategoryLabel category={cluster.category} />
        <StatusBadge status={cluster.status} />
        <ContentTypeBadge contentType={cluster.contentType} />
      </div>
      <h3 className="headline mt-1.5 text-xl sm:text-2xl">
        <Link href={storyHref(cluster)} className="hover:text-brand-ink">
          <span className="story-link">{cluster.title}</span>
        </Link>
      </h3>
      {cluster.summary ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
          {cluster.summary}
        </p>
      ) : null}
      <SourceLine
        source={cluster.lead.source}
        publishedAt={cluster.lastPublishedAt}
        isMock={cluster.isMock}
        sourceCount={cluster.sourceCount}
        className="mt-2"
      />
    </article>
  );
}

/** Standard story card — grids and side rails, optional thumbnail. */
export function StandardStory({
  cluster,
  showImage = false,
}: {
  cluster: StoryCluster;
  showImage?: boolean;
}) {
  return (
    <article className="group">
      {showImage ? (
        <Link href={storyHref(cluster)} className="mb-2.5 block">
          <StoryImage
            src={cluster.imageUrl}
            alt={cluster.title}
            category={cluster.category}
            aspect="3/2"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        </Link>
      ) : null}
      <div className="flex items-center gap-2.5">
        <CategoryLabel category={cluster.category} />
        <StatusBadge status={cluster.status} />
        <ContentTypeBadge contentType={cluster.contentType} />
      </div>
      <h3 className="headline mt-1 text-lg leading-snug">
        <Link href={storyHref(cluster)} className="hover:text-brand-ink">
          <span className="story-link">{cluster.title}</span>
        </Link>
      </h3>
      <SourceLine
        source={cluster.lead.source}
        publishedAt={cluster.lastPublishedAt}
        isMock={cluster.isMock}
        className="mt-1.5"
      />
    </article>
  );
}

/** Compact story — dense rows with small thumbnail. */
export function CompactStory({
  cluster,
  eagerThumbnail = false,
}: {
  cluster: StoryCluster;
  /** Above the fold (homepage top-stories rail) — skip lazy loading for these. */
  eagerThumbnail?: boolean;
}) {
  return (
    <article className="group flex gap-3">
      <div className="w-24 shrink-0 sm:w-28">
        <Link href={storyHref(cluster)} className="block">
          <StoryImage
            src={cluster.imageUrl}
            alt=""
            category={cluster.category}
            aspect="1/1"
            sizes="112px"
            eager={eagerThumbnail}
          />
        </Link>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <CategoryLabel category={cluster.category} />
          <ContentTypeBadge contentType={cluster.contentType} />
        </div>
        <h3 className="headline mt-0.5 text-base leading-snug">
          <Link href={storyHref(cluster)} className="hover:text-brand-ink">
            <span className="story-link">{cluster.title}</span>
          </Link>
        </h3>
        <SourceLine
          source={cluster.lead.source}
          publishedAt={cluster.lastPublishedAt}
          isMock={cluster.isMock}
          className="mt-1"
        />
      </div>
    </article>
  );
}

/** Headline-only link row for dense lists. */
export function HeadlineStory({ cluster }: { cluster: StoryCluster }) {
  return (
    <article>
      <h3 className="text-[0.9375rem] font-semibold leading-snug">
        <Link
          href={storyHref(cluster)}
          className="group inline-block py-1 hover:text-brand-ink"
        >
          <span className="story-link">{cluster.title}</span>
        </Link>
      </h3>
      <p className="text-xs text-muted">
        {cluster.lead.source} · <Timestamp iso={cluster.lastPublishedAt} />
      </p>
    </article>
  );
}

/** Live / developing stream row. */
export function LiveStory({ cluster }: { cluster: StoryCluster }) {
  return (
    <article className="flex gap-3 border-b border-rule py-3 last:border-b-0">
      <Timestamp
        iso={cluster.lastPublishedAt}
        className="w-20 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-muted"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <StatusBadge status={cluster.status ?? "updated"} />
          <CategoryLabel category={cluster.category} />
        </div>
        <h3 className="mt-1 text-[0.9375rem] font-semibold leading-snug">
          <Link href={storyHref(cluster)} className="hover:text-brand-ink">
            <span className="story-link">{cluster.title}</span>
          </Link>
        </h3>
      </div>
    </article>
  );
}

/** Ranked row for the Top 100. */
export function RankedStory({
  cluster,
  rank,
  showThumbnail = true,
  eagerThumbnail = false,
}: {
  cluster: StoryCluster;
  rank: number;
  showThumbnail?: boolean;
  /** Above the fold on the ranked list — skip lazy loading for these. */
  eagerThumbnail?: boolean;
}) {
  return (
    <article className="group flex gap-4 border-b border-rule py-4 last:border-b-0">
      <span
        aria-label={`Rank ${rank}`}
        className="w-10 shrink-0 pt-0.5 font-display text-2xl font-extrabold tabular-nums leading-none text-rule-strong dark:text-faint"
      >
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <CategoryLabel category={cluster.category} />
          <CountryBadge country={cluster.country} />
          <StatusBadge status={cluster.status} />
          <ContentTypeBadge contentType={cluster.contentType} />
        </div>
        <h3 className="headline mt-1 text-lg leading-snug">
          <Link href={storyHref(cluster)} className="hover:text-brand-ink">
            <span className="story-link">{cluster.title}</span>
          </Link>
        </h3>
        {cluster.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
            {cluster.summary}
          </p>
        ) : null}
        <SourceLine
          source={cluster.lead.source}
          publishedAt={cluster.lastPublishedAt}
          isMock={cluster.isMock}
          sourceCount={cluster.sourceCount}
          className="mt-1.5"
        />
      </div>
      {showThumbnail ? (
        <div className="hidden w-28 shrink-0 sm:block">
          <Link href={storyHref(cluster)} tabIndex={-1} aria-hidden className="block">
            <StoryImage
              src={cluster.imageUrl}
              alt=""
              category={cluster.category}
              aspect="4/3"
              sizes="112px"
              eager={eagerThumbnail}
            />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/** Article-level row for chronological feeds (/latest, source pages). */
export function ArticleRow({ article }: { article: Article }) {
  return (
    <article className="flex gap-3 border-b border-rule py-3 last:border-b-0">
      <Timestamp
        iso={article.publishedAt}
        className="w-20 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-muted"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <CategoryLabel category={article.category} />
          <CountryBadge country={article.country} />
          <ContentTypeBadge contentType={article.contentType} />
        </div>
        <h3 className="mt-1 text-[0.9375rem] font-semibold leading-snug">
          {article.clusterSlug || article.clusterId ? (
            <Link
              href={`/story/${article.clusterSlug ?? article.clusterId}`}
              className="hover:text-brand-ink"
            >
              <span className="story-link">{article.title}</span>
            </Link>
          ) : (
            <a
              href={article.url}
              rel="noopener noreferrer"
              target="_blank"
              className="hover:text-brand-ink"
            >
              <span className="story-link">{article.title}</span>
            </a>
          )}
        </h3>
        <SourceLine
          source={article.source}
          publishedAt={article.publishedAt}
          isMock={article.isMock}
          className="mt-1"
        />
      </div>
    </article>
  );
}
