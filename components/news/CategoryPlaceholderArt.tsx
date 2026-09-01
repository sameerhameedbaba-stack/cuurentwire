/**
 * The placeholder artwork itself, taking a resolved label rather than a
 * CategoryId.
 *
 * It lives in its own module, away from the `CATEGORIES` lookup, because
 * `RemoteImage` is a Client Component and imports it: anything this file
 * touches is pulled into the client bundle, and `config/categories.ts` is
 * ~26 KB of classifier keyword dictionaries that has no business being
 * shipped to a browser. The caller resolves `category -> label` on the
 * server and passes the short string down.
 *
 * Why a string and not a rendered node: every prop a Server Component hands
 * to a Client Component is serialized into the RSC flight payload embedded in
 * the HTML. `RemoteImage` used to take this art pre-rendered as a `ReactNode`
 * `fallback`, so a ~1,045-byte element tree shipped with EVERY image on the
 * page — measured live on 2026-09-02 as 25 copies on `/` (of which exactly
 * one was ever rendered), 25 on `/top-100` and `/most-covered`, 31 on
 * `/topic/artificial-intelligence`: 6.6% of all document bytes across nine
 * sampled pages, parsed on the main thread during hydration. As a label the
 * same prop costs ~26 bytes and the art is in the JS bundle exactly once.
 */
export function CategoryPlaceholderArt({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-end bg-wash p-4 dark:bg-[#1a1a19]"
    >
      <svg
        className="absolute inset-0 h-full w-full text-rule dark:text-[#2a2a28]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 225"
        fill="none"
      >
        <line x1="0" y1="225" x2="400" y2="25" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="185" x2="400" y2="-15" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="265" x2="400" y2="65" stroke="currentColor" strokeWidth="1" />
        <circle cx="330" cy="60" r="34" stroke="currentColor" strokeWidth="1" />
        <rect x="24" y="36" width="10" height="26" fill="#c91920" opacity="0.85" />
        <rect x="40" y="48" width="10" height="14" fill="#c91920" opacity="0.5" />
      </svg>
      <span className="relative font-display text-xs font-bold uppercase tracking-[0.2em] text-faint">
        {label}
      </span>
    </div>
  );
}
