/**
 * CurrentWire wordmark: the Pulse mark — three signal bars on a shared
 * baseline with a rising red terminal — plus "Current" in ink and "Wire" in
 * editorial red. Mark geometry from the 2026-08 logo kit: 100u grid, 20u
 * bars, 13u gutters, 87u baseline, heights 74/46/60 (the original
 * full-plus-62% pair with a 60u terminal).
 * The two-tone split is aria-hidden behind a single-token accessible name
 * (mirroring public/logo.svg) so assistive tech and text extractors read
 * "CurrentWire", never "Current Wire".
 */
export function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="CurrentWire"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <svg
        aria-hidden
        viewBox="13 13 86 74"
        className="h-full w-auto flex-none"
      >
        <rect x="13" y="13" width="20" height="74" className="fill-ink-deep" />
        <rect x="46" y="41" width="20" height="46" className="fill-ink-deep" />
        <rect x="79" y="27" width="20" height="60" className="fill-brand" />
      </svg>
      <span
        aria-hidden
        className="font-display text-[1.6em] font-extrabold leading-none tracking-tighter text-ink-deep"
      >
        Current<span className="text-brand">Wire</span>
      </span>
    </span>
  );
}
