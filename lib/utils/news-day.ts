/**
 * The site's editorial "news day" is the US Eastern calendar date — the
 * rhythm of the US/Canada news cycle (and the Analytics property's
 * reporting time zone). A story ingested at 03:00 UTC belongs to the
 * previous evening's news day, not the next morning's.
 */
const ET_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in America/New_York for the given instant (default: now). */
export function newsDayET(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD already.
  return ET_DAY.format(now);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Is `value` a real YYYY-MM-DD calendar date? The toISOString round-trip
 * rejects impossible dates (2026-02-31) alongside malformed strings.
 */
export function isValidDayString(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
