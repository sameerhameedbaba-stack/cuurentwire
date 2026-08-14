import { describe, expect, it } from "vitest";
import { clampDateModified } from "@/lib/seo/structured-data";

describe("clampDateModified", () => {
  it("keeps modified when it is at or after published", () => {
    expect(
      clampDateModified("2026-08-14T10:00:00.000Z", "2026-08-14T12:00:00.000Z"),
    ).toBe("2026-08-14T12:00:00.000Z");
    expect(
      clampDateModified("2026-08-14T10:00:00.000Z", "2026-08-14T10:00:00.000Z"),
    ).toBe("2026-08-14T10:00:00.000Z");
  });

  it("clamps modified up to published when sources predate our publication", () => {
    // Real production case: archive first_seen_at (our publication) comes
    // after the sources' latest coverage time.
    expect(
      clampDateModified("2026-08-14T19:16:50.067Z", "2026-08-14T19:01:58.000Z"),
    ).toBe("2026-08-14T19:16:50.067Z");
  });

  it("passes modified through when either date is unparseable", () => {
    expect(clampDateModified("not-a-date", "2026-08-14T10:00:00.000Z")).toBe(
      "2026-08-14T10:00:00.000Z",
    );
    expect(clampDateModified("2026-08-14T10:00:00.000Z", "not-a-date")).toBe(
      "not-a-date",
    );
  });
});
