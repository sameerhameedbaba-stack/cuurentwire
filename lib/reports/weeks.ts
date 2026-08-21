import { newsDayET } from "@/lib/utils/news-day";

/**
 * ISO-week arithmetic for the weekly Media Coverage Report.
 *
 * TIMEZONE CHOICE: a report week is an ISO week (Monday 00:00 through
 * Sunday 24:00) on the US-Eastern calendar — the same clock newsDayET()
 * gives the daily briefing and the archive's editorial "news day". A story
 * archived at 03:00 UTC on a Monday belongs to the previous evening's
 * (Sunday's) week, exactly as it belongs to Sunday's briefing. Week ids use
 * the ISO form "2026-W34": week 1 is the week containing January 4th, and a
 * week's YEAR is its ISO week-year, so the last days of December can carry
 * next year's W01 (Dec 29, 2025 is in 2026-W01).
 *
 * Everything here is pure calendar math. Calendar days are handled as UTC
 * midnights (no DST inside a day), and only the final conversion of an
 * Eastern midnight to a UTC instant asks Intl about the zone offset.
 */

/**
 * The archive began ~2026-08-14 (a Friday); 2026-W33 (Aug 10–16) is the
 * first week with archived rows, so it is the earliest reportable week.
 */
export const REPORT_FIRST_WEEK = "2026-W33";

const DAY_MS = 86_400_000;
const WEEK_ID_RE = /^(\d{4})-W(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ParsedWeekId {
  year: number;
  week: number;
}

export interface WeekRange {
  /** First calendar day of the week (Monday), YYYY-MM-DD. */
  startDay: string;
  /** Last calendar day of the week (Sunday), YYYY-MM-DD — inclusive. */
  endDay: string;
  /** Monday 00:00 US-Eastern as a UTC instant (inclusive). */
  startUtcISO: string;
  /** The following Monday 00:00 US-Eastern as a UTC instant (exclusive). */
  endUtcISO: string;
  /** "Aug 17–23, 2026", "Aug 31–Sep 6, 2026" or "Dec 29, 2025–Jan 4, 2026". */
  label: string;
}

/** UTC-midnight timestamp of a YYYY-MM-DD calendar day, or NaN when malformed. */
function dayToUtc(day: string): number {
  const match = DAY_RE.exec(day);
  if (!match) return Number.NaN;
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  // Round-trip rejects impossible dates (2026-02-31 → Mar 3).
  return new Date(ms).toISOString().slice(0, 10) === day ? ms : Number.NaN;
}

/** YYYY-MM-DD of a UTC-midnight timestamp. */
function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO weekday of a UTC-midnight timestamp: Monday = 1 … Sunday = 7. */
function isoWeekday(ms: number): number {
  return ((new Date(ms).getUTCDay() + 6) % 7) + 1;
}

/** UTC-midnight timestamp of the Monday that starts ISO week 1 of `year`. */
function mondayOfWeek1(year: number): number {
  // January 4th is always inside ISO week 1.
  const jan4 = Date.UTC(year, 0, 4);
  return jan4 - (isoWeekday(jan4) - 1) * DAY_MS;
}

/** {year, week} of the ISO week containing a UTC-midnight timestamp. */
function isoWeekOf(ms: number): ParsedWeekId {
  // The Thursday of the same week decides the ISO week-year.
  const thursday = ms + (4 - isoWeekday(ms)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.round((thursday - mondayOfWeek1(year)) / DAY_MS / 7) + 1;
  return { year, week };
}

/** 52 or 53: December 28th is always in the year's last ISO week. */
export function isoWeeksInYear(year: number): number {
  return isoWeekOf(Date.UTC(year, 11, 28)).week;
}

function formatWeekId({ year, week }: ParsedWeekId): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * "2026-W34" for a calendar day (YYYY-MM-DD string, taken as-is) or for an
 * instant (Date, read on the US-Eastern calendar via newsDayET). Throws on a
 * malformed day string — this is for trusted inputs; user-supplied week ids
 * go through parseWeekId.
 */
export function isoWeekId(input: string | Date): string {
  const day = input instanceof Date ? newsDayET(input) : input;
  const ms = dayToUtc(day);
  if (Number.isNaN(ms)) throw new RangeError(`isoWeekId: not a YYYY-MM-DD day: ${day}`);
  return formatWeekId(isoWeekOf(ms));
}

/**
 * Strict parse of "YYYY-Www". Null for anything else — wrong shape, week 00,
 * or a week 53 in a year that only has 52 (2025-W53 is null, 2026-W53 is
 * real: January 1st, 2026 is a Thursday).
 */
export function parseWeekId(id: string): ParsedWeekId | null {
  const match = WEEK_ID_RE.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > isoWeeksInYear(year)) return null;
  return { year, week };
}

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function weekLabel(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const startMonth = MONTH_SHORT.format(start);
  const endMonth = MONTH_SHORT.format(end);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear !== endYear) {
    return `${startMonth} ${start.getUTCDate()}, ${startYear}–${endMonth} ${end.getUTCDate()}, ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth} ${start.getUTCDate()}–${endMonth} ${end.getUTCDate()}, ${endYear}`;
  }
  return `${startMonth} ${start.getUTCDate()}–${end.getUTCDate()}, ${endYear}`;
}

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Signed offset of America/New_York from UTC at `instantMs` (EDT: -4h, EST: -5h). */
function etOffsetMs(instantMs: number): number {
  const parts: Record<string, number> = {};
  for (const part of ET_PARTS.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallClockAsUtc - instantMs;
}

/**
 * The UTC instant of 00:00 US-Eastern on a calendar day (given as a UTC
 * midnight timestamp). Guess 05:00Z (EST midnight), read the real offset
 * there, then re-read it at the result so a guess that straddled a DST
 * switch still lands on the correct side — week boundaries are Mondays and
 * DST switches on Sundays at 02:00 local, so in practice one pass suffices.
 */
function etMidnightUtcMs(dayUtcMs: number): number {
  const guess = dayUtcMs + 5 * 3_600_000;
  let result = dayUtcMs - etOffsetMs(guess);
  const offsetAtResult = etOffsetMs(result);
  if (dayUtcMs - offsetAtResult !== result) result = dayUtcMs - offsetAtResult;
  return result;
}

/**
 * Calendar days and UTC instants of a week id: [startUtcISO, endUtcISO) is
 * the half-open US-Eastern window archive rows are bucketed by. Null for an
 * invalid id.
 */
export function weekRangeET(id: string): WeekRange | null {
  const parsed = parseWeekId(id);
  if (!parsed) return null;
  const mondayMs = mondayOfWeek1(parsed.year) + (parsed.week - 1) * 7 * DAY_MS;
  const sundayMs = mondayMs + 6 * DAY_MS;
  const nextMondayMs = mondayMs + 7 * DAY_MS;
  return {
    startDay: utcToDay(mondayMs),
    endDay: utcToDay(sundayMs),
    startUtcISO: new Date(etMidnightUtcMs(mondayMs)).toISOString(),
    endUtcISO: new Date(etMidnightUtcMs(nextMondayMs)).toISOString(),
    label: weekLabel(mondayMs, sundayMs),
  };
}

/** The week id of the US-Eastern calendar day `now` falls on. */
export function currentWeekIdET(now: Date = new Date()): string {
  return isoWeekId(now);
}

/** The id of the week before `id` (crosses year boundaries); null for an invalid id. */
export function previousWeekId(id: string): string | null {
  const parsed = parseWeekId(id);
  if (!parsed) return null;
  const mondayMs = mondayOfWeek1(parsed.year) + (parsed.week - 1) * 7 * DAY_MS;
  return formatWeekId(isoWeekOf(mondayMs - 7 * DAY_MS));
}

/** The id of the week after `id`; null for an invalid id. */
export function nextWeekId(id: string): string | null {
  const parsed = parseWeekId(id);
  if (!parsed) return null;
  const mondayMs = mondayOfWeek1(parsed.year) + (parsed.week - 1) * 7 * DAY_MS;
  return formatWeekId(isoWeekOf(mondayMs + 7 * DAY_MS));
}

/**
 * Week ids that have a PERMANENT report page: a valid id, no earlier than
 * REPORT_FIRST_WEEK, and fully completed on the US-Eastern clock (the current
 * week lives on the index page, and a future week has nothing to report).
 * Zero-padded "YYYY-Www" ids compare correctly as plain strings, including
 * across a year boundary ("2025-W52" < "2026-W01").
 */
export function isReportableWeekId(id: string, now: Date = new Date()): boolean {
  if (!parseWeekId(id)) return false;
  return id >= REPORT_FIRST_WEEK && id < currentWeekIdET(now);
}

/**
 * Every completed report week from REPORT_FIRST_WEEK through the week before
 * the current one, NEWEST FIRST (the order the index page and the sitemap
 * want). Empty until the first week has ended.
 */
export function reportWeekIds(now: Date = new Date()): string[] {
  const ids: string[] = [];
  let id: string | null = previousWeekId(currentWeekIdET(now));
  while (id && id >= REPORT_FIRST_WEEK) {
    ids.push(id);
    id = previousWeekId(id);
  }
  return ids;
}
