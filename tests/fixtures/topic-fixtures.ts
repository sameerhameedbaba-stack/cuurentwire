/**
 * Labeled fixtures for topic-slug normalization (lib/news/topics.ts).
 * Same shape and discipline as tests/fixtures/classification-fixtures.ts:
 * labeled inputs, an expected value, and a note saying WHY.
 *
 * Cases marked (live) were measured against https://currentwire.us on
 * 2026-08-19T00:01Z and are regression inputs for real observed URLs, not
 * invented examples. Everything else is synthetic-but-realistic.
 */

export interface TopicKeyFixture {
  entity: string;
  expectedKey: string;
  note: string;
}

export interface TopicFoldFixture {
  a: string;
  b: string;
  /** true = must share ONE topic key (one URL); false = must stay apart. */
  fold: boolean;
  note: string;
}

const k = (entity: string, expectedKey: string, note: string): TopicKeyFixture => ({
  entity,
  expectedKey,
  note,
});

export const topicKeyFixtures: TopicKeyFixture[] = [
  // ── containment: place-type qualifiers ──────────────────────────────
  k("Big Bend National Park", "big-bend", "(live) /topic/big-bend-national-park listed 1 story while /topic/big-bend listed 0"),
  k("Big Bend", "big-bend", "(live) the decapitated variant must land on the same key"),
  k("Yosemite National Park", "yosemite", "same rule, different park"),
  k("Banff National Park", "banff", "Canadian park, same rule"),
  k("Everglades National Park", "everglades", "same rule"),
  k("Algonquin Provincial Park", "algonquin", "provincial park qualifier"),
  k("Adirondack State Park", "adirondack", "state park qualifier"),
  // Known limit, kept honest: qualifiers outside the curated list do not
  // fold. Add "national military park" only with a fixture and evidence.
  k("Gettysburg National Military Park", "gettysburg-national-military-park", "documented limit: qualifier is not curated"),

  // ── singular/plural, licensed by the curated vocabulary ─────────────
  k("Wildfires", "wildfires", "dictionary entity keeps its own key"),
  k("Wildfire", "wildfires", "singular folds because the plural is curated"),
  k("Elections", "elections", "dictionary entity"),
  k("Election", "elections", "singular folds onto the curated plural"),
  k("Interest Rates", "interest-rates", "dictionary entity"),
  k("Interest Rate", "interest-rates", "whole-name fold, not per-token"),
  k("Semiconductors", "semiconductors", "dictionary entity"),
  k("Semiconductor", "semiconductors", "singular folds"),
  k("Electric Vehicle", "electric-vehicles", "alias table already canonicalizes this"),
  k("Olympics", "olympics", "dictionary entity"),
  k("Olympic", "olympics", "singular folds"),
  k("Congress", "congress", "must NOT be mangled into 'congres' by plural logic"),
  k("Texas", "texas", "trailing s is part of the name, not a plural marker"),

  // ── proper plurals nobody curated: never folded ─────────────────────
  k("Giants", "giants", "team name — no curated singular licenses a fold"),
  k("Giant", "giant", "and the bare singular is its own thing"),
  k("Washington Commanders", "washington-commanders", "never 'washington-commander'"),
  k("Toronto Maple Leafs", "toronto-maple-leafs", "never 'toronto-maple-leaf'"),
  k("Texas Rangers", "texas-rangers", "never folded onto Texas"),

  // ── alias canonicalization flows into the key ───────────────────────
  k("Trump", "donald-trump", "alias table target"),
  k("President Trump", "donald-trump", "titled form, same key"),
  k("The Fed", "federal-reserve", "scanned alias"),
  k("USS Lincoln", "uss-abraham-lincoln", "existing alias pair stays one topic"),
  k("COVID", "covid-19", "alias to COVID-19, slug shape preserved"),

  // ── near-miss containment: MUST stay separate ───────────────────────
  k("New York", "new-york", "(live) /topic/new-york listed 7 stories, indexable"),
  k("York", "york", "(live) /topic/york listed 0 stories — a different place"),
  k("New York City", "new-york-city", "'City' is deliberately not a type qualifier"),
  k("Washington", "washington", "(live) /topic/washington listed 4 stories, indexable"),
  k("Washington Post", "washington-post", "(live) publisher, not the place"),
  k("George Washington", "george-washington", "person, not the place"),
  k("Florida", "florida", "(live) /topic/florida listed 24 stories, indexable"),
  k("Florida House", "florida-house", "(live) /topic/florida-house listed 2 stories — the chamber, not the state"),
  k("Park", "park", "a bare type word folds onto nothing"),
  k("Big Bend Brewery", "big-bend-brewery", "contains big-bend but is not the park"),

  // ── observed headline fragments keep their literal key; they are ────
  // ── suppressed by the corroboration gate, not by renaming.       ────
  k("Bay Giants", "bay-giants", "(live) /topic/bay-giants listed 0 stories"),
  k("UnitedHealthcare CEO", "unitedhealthcare-ceo", "(live) /topic/unitedhealthcare-ceo listed 0 stories"),
  k("Tommy John", "tommy-john", "(live) linked from /topics — a real, corroborated topic"),
];

const f = (a: string, b: string, fold: boolean, note: string): TopicFoldFixture => ({
  a,
  b,
  fold,
  note,
});

export const topicFoldFixtures: TopicFoldFixture[] = [
  f("Big Bend", "Big Bend National Park", true, "(live) the reported duplicate pair"),
  f("Yosemite", "Yosemite National Park", true, "same rule"),
  f("Banff", "Banff National Park", true, "same rule"),
  f("Wildfire", "Wildfires", true, "curated singular/plural"),
  f("Election", "Elections", true, "curated singular/plural"),
  f("Interest Rate", "Interest Rates", true, "curated singular/plural"),
  f("Semiconductor", "Semiconductors", true, "curated singular/plural"),
  f("USS Lincoln", "USS Abraham Lincoln", true, "existing alias pair"),
  f("The Fed", "Federal Reserve", true, "existing alias pair"),

  f("York", "New York", false, "(live) both resolve today; different places"),
  f("New York", "New York City", false, "state/metro vs city — deliberately distinct"),
  f("Washington", "Washington Post", false, "(live) place vs publisher"),
  f("Washington", "George Washington", false, "place vs person"),
  f("Florida", "Florida House", false, "(live) state vs legislature chamber"),
  f("Giants", "Bay Giants", false, "a fragment is not a shorter name for the team"),
  f("Giant", "Giants", false, "uncurated plural must not fold"),
  f("Commander", "Washington Commanders", false, "uncurated plural, and a containment trap"),
  f("Leaf", "Toronto Maple Leafs", false, "uncurated plural"),
  f("Texas", "Texas Rangers", false, "state vs team"),
  f("Park", "Big Bend National Park", false, "type word is not the topic"),
  f("Big Bend", "Big Bend Brewery", false, "containment without a type qualifier never folds"),
];
