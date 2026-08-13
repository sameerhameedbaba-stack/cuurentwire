/** Time helpers. All internal storage is UTC ISO strings. */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** "4 min ago", "2 hr ago", "Yesterday", "Aug. 10" style relative timestamp. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  if (Number.isNaN(then)) return "";
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hr ago`;
  }
  if (diff < 2 * DAY) return "Yesterday";
  const date = new Date(then);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Published Aug. 13, 2026 at 8:32 AM ET" for article detail pages. */
export function fullTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${datePart} at ${timePart} ET`;
}

/** "Thursday, August 13, 2026" masthead date. */
export function mastheadDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/** Hours elapsed since an ISO timestamp. */
export function hoursSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / HOUR;
}

/** Minutes elapsed since an ISO timestamp. */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / MINUTE;
}
