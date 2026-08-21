import { describe, expect, it } from "vitest";
import { isValidDayString, newsDayET } from "@/lib/utils/news-day";

describe("newsDayET", () => {
  it("uses the Eastern calendar date, not UTC", () => {
    // 03:00 UTC on Aug 21 is 23:00 ET on Aug 20 — still the previous
    // news day.
    expect(newsDayET(new Date("2026-08-21T03:00:00.000Z"))).toBe("2026-08-20");
    // 13:00 UTC is 09:00 ET the same day.
    expect(newsDayET(new Date("2026-08-21T13:00:00.000Z"))).toBe("2026-08-21");
  });

  it("handles winter (EST) offsets too", () => {
    // 04:30 UTC on Jan 10 is 23:30 EST on Jan 9.
    expect(newsDayET(new Date("2026-01-10T04:30:00.000Z"))).toBe("2026-01-09");
  });
});

describe("isValidDayString", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDayString("2026-08-21")).toBe(true);
    expect(isValidDayString("2024-02-29")).toBe(true); // leap day
  });

  it("rejects malformed and impossible dates", () => {
    expect(isValidDayString("2026-8-21")).toBe(false);
    expect(isValidDayString("2026-02-31")).toBe(false);
    expect(isValidDayString("2025-02-29")).toBe(false); // not a leap year
    expect(isValidDayString("not-a-date")).toBe(false);
    expect(isValidDayString("2026-08-21T00:00:00Z")).toBe(false);
  });
});
