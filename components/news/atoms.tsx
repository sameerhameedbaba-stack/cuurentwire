import Link from "next/link";
import { CATEGORIES, type CategoryId } from "@/config/categories";
import type { ClusterStatus, Country } from "@/lib/news/types";
import { COUNTRY_LABELS } from "@/lib/news/types";
import { relativeTime } from "@/lib/utils/time";

/** Small red uppercase category label linking to the section page. */
export function CategoryLabel({
  category,
  className = "",
}: {
  category: CategoryId;
  className?: string;
}) {
  const def = CATEGORIES[category];
  return (
    <Link
      href={def.path}
      className={`text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-brand-ink hover:underline ${className}`}
    >
      {def.label}
    </Link>
  );
}

/** Geographic relevance badge. Country colors assist scanning only. */
export function CountryBadge({ country }: { country: Country }) {
  if (country === "GLOBAL") return null;
  const label = COUNTRY_LABELS[country];
  const dotClass =
    country === "CA"
      ? "bg-canada"
      : country === "US"
        ? "bg-usa"
        : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

/** Semantic timestamp with relative display text. */
export function Timestamp({
  iso,
  className = "",
}: {
  iso: string;
  className?: string;
}) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}

/** "Source • 14 min ago" attribution line, with DEMO chip for mock stories. */
export function SourceLine({
  source,
  publishedAt,
  isMock = false,
  sourceCount,
  className = "",
}: {
  source: string;
  publishedAt: string;
  isMock?: boolean;
  sourceCount?: number;
  className?: string;
}) {
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-xs text-muted ${className}`}>
      <span className="font-semibold text-ink/80 dark:text-ink/90">{source}</span>
      <span aria-hidden>•</span>
      <Timestamp iso={publishedAt} />
      {sourceCount !== undefined && sourceCount > 1 ? (
        <>
          <span aria-hidden>•</span>
          <span>
            {sourceCount} sources
          </span>
        </>
      ) : null}
      {isMock ? (
        <span className="rounded-news border border-rule px-1 py-px text-[0.625rem] font-bold uppercase tracking-wider text-faint">
          Demo
        </span>
      ) : null}
    </p>
  );
}

/** LIVE / DEVELOPING / UPDATED status badge. */
export function StatusBadge({ status }: { status: ClusterStatus }) {
  if (!status) return null;
  const label = status === "live" ? "Live" : status === "developing" ? "Developing" : "Updated";
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-brand-ink">
      {status !== "updated" && (
        <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
      )}
      {label}
    </span>
  );
}

/** BREAKING label used by the breaking banner and hero treatments. */
export function BreakingLabel() {
  return (
    <span className="inline-flex items-center bg-brand px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-white">
      Breaking
    </span>
  );
}
