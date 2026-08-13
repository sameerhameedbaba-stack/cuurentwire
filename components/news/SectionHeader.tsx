import Link from "next/link";

/**
 * Editorial section header: bold rule, display type, optional "See all" link
 * and an optional country accent tick (US/Canada sections only).
 */
export function SectionHeader({
  title,
  href,
  accent,
  description,
}: {
  title: string;
  href?: string;
  accent?: "us" | "canada";
  description?: string;
}) {
  const accentClass =
    accent === "canada" ? "bg-canada" : accent === "us" ? "bg-usa" : "bg-brand";
  return (
    <div className="border-t-2 border-ink pb-4 pt-2 dark:border-rule-strong">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="headline flex items-center gap-2.5 text-2xl sm:text-[1.75rem]">
          <span aria-hidden className={`h-5 w-1 ${accentClass}`} />
          {href ? (
            <Link href={href} className="hover:text-brand-ink">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {href ? (
          <Link
            href={href}
            className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-muted transition-colors hover:text-brand-ink"
          >
            See all
          </Link>
        ) : null}
      </div>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
    </div>
  );
}
