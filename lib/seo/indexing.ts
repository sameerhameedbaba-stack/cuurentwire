import type { Metadata } from "next";

/**
 * Index controls for thin collection pages (topic and source listings).
 * Pages with fewer items than the threshold are kept out of the index —
 * links are still followed — so near-empty listings never dilute crawl
 * or index quality.
 */

export const MIN_CLUSTERS_FOR_INDEX = 3;

/** robots value for thin pages: noindex, but keep following links. */
export const NOINDEX_FOLLOW: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
};

export function shouldIndexCollection(itemCount: number): boolean {
  return itemCount >= MIN_CLUSTERS_FOR_INDEX;
}
