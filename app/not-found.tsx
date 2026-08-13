import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[700px] flex-col items-start px-4 py-24 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-ink">404</p>
      <h1 className="headline mt-2 text-3xl sm:text-5xl">
        This story couldn’t be found.
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        It may have moved, expired, or been removed from the CurrentWire index.
        News moves fast — the story you’re looking for may simply have aged out
        of the current window.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
        >
          Go to Top Stories
        </Link>
        <Link
          href="/search"
          className="border border-ink px-5 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand-ink dark:border-rule-strong"
        >
          Search CurrentWire
        </Link>
      </div>
    </div>
  );
}
