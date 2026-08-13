import { describe, expect, it } from "vitest";
import {
  MIN_CLUSTERS_FOR_INDEX,
  NOINDEX_FOLLOW,
  shouldIndexCollection,
} from "@/lib/seo/indexing";

describe("index controls for thin collection pages", () => {
  it("keeps collections at or above the threshold indexable", () => {
    expect(shouldIndexCollection(MIN_CLUSTERS_FOR_INDEX)).toBe(true);
    expect(shouldIndexCollection(MIN_CLUSTERS_FOR_INDEX + 10)).toBe(true);
  });

  it("noindexes collections below the threshold", () => {
    expect(shouldIndexCollection(MIN_CLUSTERS_FOR_INDEX - 1)).toBe(false);
    expect(shouldIndexCollection(0)).toBe(false);
  });

  it("noindex directive still follows links", () => {
    expect(NOINDEX_FOLLOW).toEqual({ index: false, follow: true });
  });
});
