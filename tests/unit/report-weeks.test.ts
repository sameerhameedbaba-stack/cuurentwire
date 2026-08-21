import { describe, expect, it } from "vitest";
import {
  REPORT_FIRST_WEEK,
  currentWeekIdET,
  isReportableWeekId,
  isoWeekId,
  isoWeeksInYear,
  nextWeekId,
  parseWeekId,
  previousWeekId,
  reportWeekIds,
  weekRangeET,
} from "@/lib/reports/weeks";

describe("isoWeekId", () => {
  it("maps calendar days to ISO weeks (Aug 17–23, 2026 is W34)", () => {
    expect(isoWeekId("2026-08-17")).toBe("2026-W34"); // Monday
    expect(isoWeekId("2026-08-22")).toBe("2026-W34"); // Saturday
    expect(isoWeekId("2026-08-23")).toBe("2026-W34"); // Sunday
    expect(isoWeekId("2026-08-24")).toBe("2026-W35"); // next Monday
    expect(isoWeekId("2026-08-10")).toBe("2026-W33");
  });

  it("uses the ISO week-year across the new year", () => {
    // Jan 1, 2026 is a Thursday, so 2026-W01 starts on Mon Dec 29, 2025.
    expect(isoWeekId("2025-12-28")).toBe("2025-W52");
    expect(isoWeekId("2025-12-29")).toBe("2026-W01");
    expect(isoWeekId("2026-01-04")).toBe("2026-W01");
    // Jan 1, 2027 is a Friday: it still belongs to 2026's last week (W53).
    expect(isoWeekId("2026-12-28")).toBe("2026-W53");
    expect(isoWeekId("2027-01-03")).toBe("2026-W53");
    expect(isoWeekId("2027-01-04")).toBe("2027-W01");
  });

  it("reads Date instants on the US-Eastern calendar, not UTC", () => {
    // 03:00Z Monday Aug 24 is 23:00 EDT Sunday Aug 23 — still W34.
    expect(isoWeekId(new Date("2026-08-24T03:00:00.000Z"))).toBe("2026-W34");
    // 04:00Z is 00:00 EDT Monday — W35 begins.
    expect(isoWeekId(new Date("2026-08-24T04:00:00.000Z"))).toBe("2026-W35");
    // Winter (EST, UTC-5): 04:59Z Monday is still Sunday evening.
    expect(isoWeekId(new Date("2026-01-12T04:59:00.000Z"))).toBe("2026-W02");
    expect(isoWeekId(new Date("2026-01-12T05:00:00.000Z"))).toBe("2026-W03");
  });

  it("throws on malformed day strings", () => {
    expect(() => isoWeekId("2026-8-1")).toThrow(RangeError);
    expect(() => isoWeekId("2026-02-31")).toThrow(RangeError);
  });
});

describe("parseWeekId", () => {
  it("accepts well-formed ids with a real week number", () => {
    expect(parseWeekId("2026-W34")).toEqual({ year: 2026, week: 34 });
    expect(parseWeekId("2026-W01")).toEqual({ year: 2026, week: 1 });
    expect(parseWeekId("2026-W53")).toEqual({ year: 2026, week: 53 }); // 53-week year
  });

  it("rejects malformed and out-of-range ids", () => {
    expect(parseWeekId("2026-W00")).toBeNull();
    expect(parseWeekId("2026-W54")).toBeNull();
    expect(parseWeekId("2025-W53")).toBeNull(); // 2025 has 52 weeks
    expect(parseWeekId("2026-W7")).toBeNull();
    expect(parseWeekId("2026-w34")).toBeNull();
    expect(parseWeekId("2026-W34 ")).toBeNull();
    expect(parseWeekId("2026W34")).toBeNull();
    expect(parseWeekId("W34")).toBeNull();
    expect(parseWeekId("")).toBeNull();
  });

  it("knows which years have 53 ISO weeks", () => {
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2027)).toBe(52);
    expect(isoWeeksInYear(2020)).toBe(53); // leap year starting Wednesday
  });
});

describe("weekRangeET", () => {
  it("gives Eastern-midnight UTC instants and a compact label in summer", () => {
    const range = weekRangeET("2026-W34");
    expect(range).toEqual({
      startDay: "2026-08-17",
      endDay: "2026-08-23",
      startUtcISO: "2026-08-17T04:00:00.000Z", // 00:00 EDT
      endUtcISO: "2026-08-24T04:00:00.000Z",
      label: "Aug 17–23, 2026",
    });
  });

  it("uses the EST offset in winter", () => {
    const range = weekRangeET("2026-W03");
    expect(range?.startDay).toBe("2026-01-12");
    expect(range?.startUtcISO).toBe("2026-01-12T05:00:00.000Z");
    expect(range?.endUtcISO).toBe("2026-01-19T05:00:00.000Z");
    expect(range?.label).toBe("Jan 12–18, 2026");
  });

  it("labels weeks that cross a month or a year", () => {
    expect(weekRangeET("2026-W36")?.label).toBe("Aug 31–Sep 6, 2026");
    expect(weekRangeET("2026-W01")?.label).toBe("Dec 29, 2025–Jan 4, 2026");
    expect(weekRangeET("2026-W01")?.startDay).toBe("2025-12-29");
  });

  it("straddles the DST switch inside a week without drifting", () => {
    // 2026-W10 (Mar 2–8) starts on EST and ends after the Mar 8 switch to EDT.
    const range = weekRangeET("2026-W10");
    expect(range?.startUtcISO).toBe("2026-03-02T05:00:00.000Z");
    expect(range?.endUtcISO).toBe("2026-03-09T04:00:00.000Z");
  });

  it("is null for invalid ids", () => {
    expect(weekRangeET("2026-W99")).toBeNull();
    expect(weekRangeET("nope")).toBeNull();
  });
});

describe("currentWeekIdET / previousWeekId / nextWeekId", () => {
  it("rolls the current week over at Eastern midnight on Monday", () => {
    expect(currentWeekIdET(new Date("2026-08-24T03:59:59.000Z"))).toBe("2026-W34");
    expect(currentWeekIdET(new Date("2026-08-24T04:00:00.000Z"))).toBe("2026-W35");
  });

  it("steps across year boundaries in both directions", () => {
    expect(previousWeekId("2026-W34")).toBe("2026-W33");
    expect(previousWeekId("2026-W01")).toBe("2025-W52");
    expect(previousWeekId("2027-W01")).toBe("2026-W53");
    expect(nextWeekId("2026-W53")).toBe("2027-W01");
    expect(nextWeekId("2025-W52")).toBe("2026-W01");
    expect(previousWeekId("bad")).toBeNull();
    expect(nextWeekId("bad")).toBeNull();
  });
});

describe("reportWeekIds / isReportableWeekId", () => {
  it("lists every completed week from the first report week, newest first", () => {
    expect(REPORT_FIRST_WEEK).toBe("2026-W33");
    // Saturday Aug 22, 2026 (W34): only W33 has completed.
    expect(reportWeekIds(new Date("2026-08-22T15:00:00.000Z"))).toEqual(["2026-W33"]);
    // Monday Aug 31 00:00 EDT (W36): W34 and W35 have completed too.
    expect(reportWeekIds(new Date("2026-08-31T04:00:00.000Z"))).toEqual([
      "2026-W35",
      "2026-W34",
      "2026-W33",
    ]);
  });

  it("is empty before the first week has ended and rolls at Eastern midnight", () => {
    expect(reportWeekIds(new Date("2026-08-14T12:00:00.000Z"))).toEqual([]);
    // Sunday Aug 16 23:59 EDT: W33 is not over yet.
    expect(reportWeekIds(new Date("2026-08-17T03:59:00.000Z"))).toEqual([]);
    // Monday Aug 17 00:00 EDT: W33 has completed.
    expect(reportWeekIds(new Date("2026-08-17T04:00:00.000Z"))).toEqual(["2026-W33"]);
  });

  it("crosses the year boundary without gaps", () => {
    const ids = reportWeekIds(new Date("2027-01-12T12:00:00.000Z")); // 2027-W02
    expect(ids[0]).toBe("2027-W01");
    expect(ids[1]).toBe("2026-W53");
    expect(ids[ids.length - 1]).toBe("2026-W33");
    expect(ids).toHaveLength(22);
  });

  it("isReportableWeekId rejects malformed, pre-archive, current and future ids", () => {
    const now = new Date("2026-08-22T15:00:00.000Z"); // W34
    expect(isReportableWeekId("2026-W33", now)).toBe(true);
    expect(isReportableWeekId("2026-W32", now)).toBe(false); // before the archive
    expect(isReportableWeekId("2026-W34", now)).toBe(false); // current week
    expect(isReportableWeekId("2026-W35", now)).toBe(false); // future
    expect(isReportableWeekId("2026-W3", now)).toBe(false);
    expect(isReportableWeekId("2026-W00", now)).toBe(false);
  });
});
