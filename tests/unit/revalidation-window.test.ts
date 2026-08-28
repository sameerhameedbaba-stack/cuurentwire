import { describe, expect, it } from "vitest";
import type { StoryCluster } from "@/lib/news/types";
import {
  REVALIDATION_WINDOW,
  selectRevalidationSlugs,
} from "@/lib/news/revalidation-window";

/**
 * The cron marks a bounded number of live story paths per burst. Before
 * 2026-08-29 that bound was spent on the same top 150 every time, so the
 * 576 lower-ranked clusters of a measured 726 were never re-rendered and
 * could serve a frozen archive copy for the story route's 30-day TTL
 * (seo/BACKLOG.md item 3 / `[auto-alert]` #2).
 *
 * These tests pin both halves of the fix: the cost bound is unchanged, and
 * every live cluster is reached within one rotation cycle.
 */

const { MAX, HEAD, ROTATION, BURST_INTERVAL_MS } = REVALIDATION_WINDOW;

function clusters(count: number, isMock = false): StoryCluster[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    slug: `slug-${i}`,
    isMock,
  })) as unknown as StoryCluster[];
}

/** Burst n, in the same units the cursor counts. */
function burst(n: number): Date {
  return new Date(n * BURST_INTERVAL_MS);
}

describe("selectRevalidationSlugs", () => {
  it("never marks more paths than the burst's cost bound", () => {
    for (let n = 0; n < 40; n++) {
      expect(selectRevalidationSlugs(clusters(726), burst(n)).length).toBeLessThanOrEqual(MAX);
    }
  });

  it("never repeats a path inside one burst", () => {
    for (let n = 0; n < 40; n++) {
      const slugs = selectRevalidationSlugs(clusters(726), burst(n));
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("always marks the ranked head, whatever the cursor is", () => {
    const head = clusters(726).slice(0, HEAD).map((c) => c.slug);
    for (let n = 0; n < 40; n++) {
      const slugs = new Set(selectRevalidationSlugs(clusters(726), burst(n)));
      for (const slug of head) expect(slugs.has(slug)).toBe(true);
    }
  });

  it("reaches every live cluster within one rotation cycle", () => {
    // 726 is the live cluster count measured on production 2026-08-28.
    const all = clusters(726);
    const cycle = Math.ceil((all.length - HEAD) / ROTATION);
    const seen = new Set<string>();
    for (let n = 0; n < cycle; n++) {
      for (const slug of selectRevalidationSlugs(all, burst(n))) seen.add(slug);
    }
    expect(seen.size).toBe(all.length);
    // At ~2 bursts/hour this is the promise the comment makes: ~6.5 hours.
    expect(cycle).toBe(13);
  });

  it("advances the rotation between consecutive bursts", () => {
    const all = clusters(726);
    const first = selectRevalidationSlugs(all, burst(1));
    const second = selectRevalidationSlugs(all, burst(2));
    expect(first).not.toEqual(second);
    // The difference is entirely in the tail: the head is common to both.
    expect(first.slice(0, HEAD)).toEqual(second.slice(0, HEAD));
  });

  it("marks every cluster and rotates nothing when the dataset fits", () => {
    const all = clusters(MAX);
    const slugs = selectRevalidationSlugs(all, burst(7));
    expect(slugs).toEqual(all.map((c) => c.slug));
    expect(selectRevalidationSlugs(all, burst(8))).toEqual(slugs);
  });

  it("excludes mock clusters", () => {
    const all = [...clusters(3), ...clusters(2, true)];
    expect(selectRevalidationSlugs(all, burst(0))).toEqual(["slug-0", "slug-1", "slug-2"]);
  });

  it("handles an empty dataset", () => {
    expect(selectRevalidationSlugs([], burst(0))).toEqual([]);
  });

  it("never produces a negative slice index for a pre-epoch clock", () => {
    const slugs = selectRevalidationSlugs(clusters(726), new Date(-5 * BURST_INTERVAL_MS));
    expect(slugs.length).toBeLessThanOrEqual(MAX);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
