/**
 * CurrentWire wordmark: "Current" in ink, "Wire" in editorial red, with a
 * vertical signal bar. Original text treatment — no borrowed media marks.
 */
export function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="flex h-full items-stretch gap-[3px]">
        <span className="w-[4px] bg-brand" />
        <span className="w-[4px] self-end bg-brand" style={{ height: "62%" }} />
      </span>
      <span className="font-display text-[1.6em] font-extrabold leading-none tracking-tighter text-ink-deep">
        Current<span className="text-brand">Wire</span>
      </span>
    </span>
  );
}
