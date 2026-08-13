"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Global error boundary — graceful UI, no stack traces or internals exposed. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest only — never render internals to the reader.
    console.error("page_error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[700px] flex-col items-start px-4 py-24 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-ink">Error</p>
      <h1 className="headline mt-2 text-3xl sm:text-4xl">
        Something went wrong loading this page.
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        The news feed itself is likely fine — this page hit a temporary problem.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-ink px-5 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand-ink dark:border-rule-strong"
        >
          Go to Top Stories
        </Link>
      </div>
    </div>
  );
}
