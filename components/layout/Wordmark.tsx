/**
 * CurrentWire wordmark: "Current" in ink, "Wire" in editorial red, with a
 * vertical signal bar. Original text treatment — no borrowed media marks.
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
      <span aria-hidden className="flex h-full items-stretch gap-[3px]">
        <span className="w-[4px] bg-brand" />
        <span className="w-[4px] self-end bg-brand" style={{ height: "62%" }} />
      </span>
      <span
        aria-hidden
        className="font-display text-[1.6em] font-extrabold leading-none tracking-tighter text-ink-deep"
      >
        Current<span className="text-brand">Wire</span>
      </span>
    </span>
  );
}
