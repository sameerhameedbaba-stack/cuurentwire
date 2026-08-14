/**
 * Story update history — the pure diff layer behind "what changed since the
 * previous update" on story pages.
 *
 * Every refresh, the archive upsert compares the incoming cluster against
 * the previously archived row and appends the resulting events to the row's
 * history jsonb (capped at STORY_HISTORY_LIMIT, oldest dropped). Events are
 * stamped with the dataset version and generation time so each entry traces
 * back to exactly one snapshot.
 */

export type StoryUpdateEvent =
  | { kind: "source_added"; at: string; version: string; source: string }
  | { kind: "headline_updated"; at: string; version: string; from: string; to: string }
  | { kind: "coverage_change"; at: string; version: string; from: number; to: number }
  | { kind: "category_changed"; at: string; version: string; from: string; to: string };

/** Maximum events kept per story; the oldest are dropped first. */
export const STORY_HISTORY_LIMIT = 20;

/** The archived fields a history diff compares between two refreshes. */
export interface StoryUpdateSnapshot {
  title: string;
  sourceCount: number;
  category: string;
  sourceNames: string[];
}

/**
 * Diff two snapshots of a story into history events. Pure and
 * deterministic. A null previous (story never archived before) yields no
 * events — new stories start with an empty history, not synthetic entries.
 * Event order is stable: headline_updated, then source_added in
 * next.sourceNames order, then coverage_change, then category_changed.
 */
export function diffStoryForHistory(
  previous: StoryUpdateSnapshot | null,
  next: StoryUpdateSnapshot,
  version: string,
  at: string,
): StoryUpdateEvent[] {
  if (!previous) return [];
  const events: StoryUpdateEvent[] = [];
  if (previous.title !== next.title) {
    events.push({ kind: "headline_updated", at, version, from: previous.title, to: next.title });
  }
  const known = new Set(previous.sourceNames);
  for (const source of next.sourceNames) {
    if (known.has(source)) continue;
    known.add(source);
    events.push({ kind: "source_added", at, version, source });
  }
  if (previous.sourceCount !== next.sourceCount) {
    events.push({
      kind: "coverage_change",
      at,
      version,
      from: previous.sourceCount,
      to: next.sourceCount,
    });
  }
  if (previous.category !== next.category) {
    events.push({
      kind: "category_changed",
      at,
      version,
      from: previous.category,
      to: next.category,
    });
  }
  return events;
}

/**
 * Append new events to a stored history, keeping at most `limit` entries by
 * dropping the OLDEST. Histories are stored oldest-to-newest.
 */
export function appendStoryHistory(
  history: StoryUpdateEvent[],
  events: StoryUpdateEvent[],
  limit: number = STORY_HISTORY_LIMIT,
): StoryUpdateEvent[] {
  const combined = [...history, ...events];
  return combined.length > limit ? combined.slice(combined.length - limit) : combined;
}
