import Link from "next/link";

/** Tasteful empty state for feeds and filters with no matching stories. */
export function EmptyState({
  title = "No recent stories found",
  message = "Try another category, or check Latest for newly published coverage.",
  actionLabel = "Go to Latest",
  actionHref = "/latest",
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="border border-rule bg-surface px-6 py-14 text-center">
      <h2 className="headline text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-block bg-ink px-5 py-2.5 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
