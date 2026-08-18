import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, isCategoryId } from "@/config/categories";
import { getArchiveBrowse } from "@/lib/database/archive";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, LinkListJsonLd } from "@/lib/seo/structured-data";

// ISR: a past archive day never changes; the current UTC day gains stories
// at most once per 30-minute refresh, so hourly re-renders are plenty.
export const revalidate = 3600;

/**
 * Required for the `revalidate` above to do anything: a dynamic segment with
 * no generateStaticParams is server-rendered on every request. Empty array =
 * nothing prerendered at build, every day page ISR-cached on first visit.
 * See app/story/[slug]/page.tsx for the doc reference.
 */
export async function generateStaticParams(): Promise<{ date: string }[]> {
  return [];
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Start of the requested UTC day, or null when the param is not a real,
 * non-future YYYY-MM-DD date. The toISOString round-trip rejects impossible
 * calendar dates (2026-02-31) alongside malformed strings.
 */
function parseArchiveDay(value: string): Date | null {
  if (!DAY_RE.test(value)) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  if (start.toISOString().slice(0, 10) !== value) return null;
  if (start.getTime() > Date.now()) return null;
  return start;
}

/** "August 17, 2026" for a YYYY-MM-DD UTC day. */
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Display label for a stored category id (old ids fall back verbatim). */
function categoryLabel(category: string): string {
  if (isCategoryId(category)) return CATEGORIES[category].label;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  // notFound() here (before streaming starts) so the response is a real 404.
  if (!parseArchiveDay(date)) notFound();
  const label = dayLabel(date);
  return pageMetadata({
    title: `News Archive — ${label}`,
    description: `Stories CurrentWire first covered on ${label}: permanent links with category and coverage counts.`,
    path: `/archive/${date}`,
  });
}

export default async function ArchiveDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!parseArchiveDay(date)) notFound();
  const stories = await getArchiveBrowse(date);
  // Real 404 status requires notFound() before the response starts
  // streaming. A valid-looking day with no archived stories (before the
  // archive existed, or a local run without a database) is a 404, not an
  // indexable empty page.
  if (stories.length === 0) notFound();
  const label = dayLabel(date);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Archive", path: "/archive" },
          { name: label, path: `/archive/${date}` },
        ]}
      />
      <LinkListJsonLd
        name={`News archive — ${label}`}
        path={`/archive/${date}`}
        items={stories.map((story) => ({
          name: story.title,
          url: `/story/${story.slug}`,
        }))}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          <Link href="/archive" className="hover:underline">
            Archive
          </Link>
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{label}</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          {stories.length} {stories.length === 1 ? "story" : "stories"} first
          covered by CurrentWire this day. Story pages stay online permanently.
        </p>
      </header>

      <ol className="mt-2 divide-y divide-rule">
        {stories.map((story) => (
          <li key={story.slug} className="py-3">
            <Link
              href={`/story/${story.slug}`}
              className="font-display text-base font-bold leading-snug hover:text-brand-ink hover:underline"
            >
              {story.title}
            </Link>
            <p className="mt-1 text-xs text-muted">
              {categoryLabel(story.category)} · {story.sourceCount}{" "}
              {story.sourceCount === 1 ? "publication" : "publications"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
