import { significantTokens } from "@/lib/utils/text";

/**
 * Event fingerprinting for same-event clustering.
 *
 * Headline Jaccard alone cannot carry reworded coverage ("kidnapped" vs
 * "kidnap", "released" vs "freed", equal weight for "missionary" and
 * "group"), so clustering also compares EVENT FINGERPRINTS:
 *
 *  1. Morphological normalization — a light deterministic suffix-stripping
 *     stemmer (no dependency) used ONLY for matching, never for display.
 *  2. Action synonym groups — a conservative table of news verbs
 *     (released~freed, killed~dies, arrested~detained, …) collapsed into
 *     shared markers so different verbs for the same act still match.
 *  3. Rarity weighting — tokens are weighted by inverse document frequency
 *     within the current run corpus, so "missionary"/"niger" count far more
 *     than "group"/"says".
 *
 * Everything here is deterministic and derived only from the articles in the
 * current run.
 */

/**
 * Rarity cutoff: a stem is "rare" when its document frequency is at most
 * max(RARE_DF_FLOOR, ceil(corpusSize * RARE_DF_FRACTION)). The floor keeps
 * small corpora usable; the fraction keeps widely-covered events (10+
 * outlets on one story) from pushing their own anchor tokens out of rarity.
 */
export const RARE_DF_FLOOR = 4;
export const RARE_DF_FRACTION = 0.04;

/**
 * A strong fingerprint requires at least this many shared rare non-action
 * stems (entities and distinctive nouns like "missionary", "niger") between
 * the two headlines.
 */
export const MIN_SHARED_RARE_STEMS = 2;

/**
 * Light suffix-stripping stemmer for MATCHING ONLY (never displayed).
 * Handles regular plurals, -ing/-ed forms with consonant undoubling, and a
 * final-e strip so inflections collapse to one key:
 *   kidnapped/kidnapping/kidnap -> kidnap
 *   released/releases/release   -> releas
 *   freed/frees/free            -> fre
 * Irregular forms (won, died, dead) are handled by the action-synonym table,
 * not the stemmer.
 */
export function stemToken(token: string): string {
  let t = token;
  if (t.length <= 3) return t;

  // Plurals.
  if (t.endsWith("ies") && t.length >= 5) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith("sses")) t = t.slice(0, -2);
  else if (t.endsWith("ss") || t.endsWith("us") || t.endsWith("is")) {
    // keep: "press", "virus", "crisis"
  } else if (t.endsWith("s")) t = t.slice(0, -1);

  // Gerund / past tense.
  if (t.endsWith("ing") && t.length >= 6) t = undouble(t.slice(0, -3));
  else if (t.endsWith("ied") && t.length >= 5) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith("ed") && t.length >= 5) t = undouble(t.slice(0, -2));

  // Final e, so "release"/"released" agree after the -ed strip.
  if (t.length >= 4 && t.endsWith("e")) t = t.slice(0, -1);
  return t;
}

/** Undo consonant doubling ("kidnapp" -> "kidnap"), keeping ll/ss/zz. */
function undouble(t: string): string {
  const n = t.length;
  const last = t[n - 1];
  if (
    n >= 3 &&
    last === t[n - 2] &&
    !"aeiou".includes(last) &&
    last !== "l" &&
    last !== "s" &&
    last !== "z"
  ) {
    return t.slice(0, -1);
  }
  return t;
}

/**
 * Conservative action-word synonym groups for news verbs. A group collapses
 * different surface verbs for the same act into one marker so "released"
 * matches "freed". Groups are deliberately narrow: words with a second
 * common news sense (e.g. "denies", "advances", "names") are left out, and
 * a word may sit in several groups when its senses genuinely overlap
 * ("releases" a hostage vs "releases" a product).
 *
 * Known accepted ambiguity: "fired/fires/fire" all stem to "fir", so that
 * stem carries BOTH the dismissal marker and the blaze marker — a wildfire
 * headline and a sacked-coach headline are "action compatible". A marker
 * alone never merges anything (rare-token and similarity gates still apply),
 * so this is noise, not a false-merge path.
 */
const ACTION_GROUPS: string[][] = [
  ["released", "releases", "release", "freed", "frees", "liberated"],
  ["kidnapped", "kidnaps", "kidnap", "kidnapping", "abducted", "abducts", "abduction"],
  ["killed", "kills", "dead", "dies", "died", "death", "deaths", "slain", "fatal", "fatally"],
  ["arrested", "arrests", "detained", "detains", "apprehended", "custody"],
  // "captures/captured" also sit in the seize group — "captures the title"
  // vs "captured by rebels" is genuine polysemy (multi-group membership).
  ["wins", "win", "won", "victory", "triumph", "triumphs", "captures", "captured"],
  ["defeats", "defeat", "defeated", "beats", "beat"],
  ["fired", "dismissed", "dismisses", "ousted", "ousts", "sacked", "sacks"],
  ["resigns", "resigned", "resignation", "quits", "quit"],
  ["approves", "approved", "approval", "passes", "passed", "clears", "cleared", "adopts", "adopted", "ratifies", "ratified", "enacts", "enacted", "signs", "signed"],
  ["rejects", "rejected", "vetoes", "vetoed", "veto", "blocks", "blocked"],
  ["bans", "banned", "ban", "prohibits", "prohibited", "outlaws", "outlawed"],
  ["sues", "sued", "lawsuit", "lawsuits"],
  ["charged", "charges", "indicted", "indicts", "indictment", "prosecuted"],
  ["convicted", "convicts", "guilty"],
  ["sentenced", "jailed", "imprisoned"],
  ["acquitted", "acquits", "exonerated"],
  ["injured", "injures", "injuries", "wounded", "wounds", "hurt", "hurts"],
  ["crashes", "crashed", "crash", "collides", "collided", "collision", "derails", "derailed"],
  ["explodes", "exploded", "explosion", "explosions", "blast", "blasts", "detonated"],
  ["erupts", "erupted", "eruption"],
  ["earthquake", "quake", "quakes", "tremor", "tremors"],
  ["floods", "flooded", "flooding", "floodwaters", "deluge"],
  ["launches", "launched", "launch", "unveils", "unveiled", "debuts", "debuted", "introduces", "introduced", "releases", "released"],
  ["cuts", "cut", "reduces", "reduced", "lowers", "lowered", "slashes", "slashed", "trims", "trimmed"],
  ["raises", "raised", "hikes", "hiked", "hike", "increases", "increased", "boosts", "boosted"],
  ["falls", "fell", "drops", "dropped", "plunges", "plunged", "tumbles", "tumbled", "slides", "slid", "sinks", "sank", "slumps", "slumped", "declines", "declined"],
  ["rises", "rose", "surges", "surged", "soars", "soared", "climbs", "climbed", "jumps", "jumped"],
  ["warns", "warned", "warning", "cautions", "cautioned"],
  ["announces", "announced", "declares", "declared"],
  ["evacuated", "evacuates", "evacuation", "flee", "fled", "flees"],
  ["rescued", "rescues", "rescue"],
  ["seized", "seizes", "captured", "captures", "recaptured"],
  ["missing", "disappeared", "disappears", "vanished", "vanishes"],
  ["discovered", "discovers", "finds", "found", "uncovered", "uncovers"],
  ["appointed", "appoints", "hired", "hires"],
  ["shooting", "shot", "shoots", "gunfire", "shootout"],
  ["wildfire", "wildfires", "blaze", "blazes", "fire", "fires"],
  ["agreement", "pact", "accord", "treaty"],
  ["strike", "strikes", "walkout"],
];

/**
 * Closed word classes demoted from fingerprints: calendar terms, demonyms,
 * religion adjectives and attribution boilerplate DESCRIBE an event's
 * actors, timing and sourcing but do not identify the event ("American
 * missionary … in October" vs "US missionary" is the same story; "police
 * say" vs "his group says" is the same story). They are excluded from
 * fingerprint stems so they can neither anchor a strong fingerprint nor
 * dilute the similarity of reworded coverage. These are grammatical /
 * journalistic classes, not event-specific keywords.
 */
const WEAK_TOKENS = new Set(
  [
    // Calendar terms.
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "monday", "tuesday",
    "wednesday", "thursday", "friday", "saturday", "sunday", "today",
    "yesterday", "tonight", "overnight",
    // Demonyms (adjectival nationalities).
    "american", "americans", "canadian", "canadians", "british", "french",
    "german", "russian", "chinese", "indian", "mexican", "italian", "spanish",
    "japanese", "korean", "australian", "ukrainian", "israeli", "palestinian",
    "iranian", "european", "africans", "african", "asian", "latin",
    // Religion adjectives.
    "christian", "muslim", "jewish", "catholic", "hindu", "buddhist",
    // Attribution / generic-actor boilerplate ("police say", "researchers
    // report", "his group says") — sourcing vocabulary, never event identity.
    "police", "officer", "officers", "official", "officials", "authorities",
    "authority", "researcher", "researchers", "scientist", "scientists",
    "expert", "experts", "report", "reports", "reported", "reporting",
    "according", "spokesperson", "spokesman", "spokeswoman", "witness",
    "witnesses", "group", "groups", "organization", "organizations",
  ].map((word) => stemToken(word)),
);

/** stem -> action-group markers (a stem may belong to several groups). */
const ACTION_GROUP_INDEX: Map<string, string[]> = (() => {
  const index = new Map<string, Set<string>>();
  ACTION_GROUPS.forEach((group) => {
    const id = `act:${stemToken(group[0])}`;
    for (const word of group) {
      const stem = stemToken(word);
      let markers = index.get(stem);
      if (!markers) index.set(stem, (markers = new Set()));
      markers.add(id);
    }
  });
  return new Map([...index].map(([stem, markers]) => [stem, [...markers]]));
})();

export interface EventFingerprint {
  /** All canonical tokens: non-action stems plus action-group markers. */
  canonical: Set<string>;
  /** Non-action stems only — the pool rarity checks draw from. */
  stems: Set<string>;
  /** Action-group markers present in the headline. */
  actions: Set<string>;
  /**
   * Stems that look like a proper noun (capitalized at a non-initial title
   * position, or part of an extracted entity) — the "location or actor"
   * anchors a strong fingerprint must share.
   */
  proper: Set<string>;
}

/** Build the event fingerprint for one headline (+ its extracted entities). */
export function buildFingerprint(title: string, entities: string[]): EventFingerprint {
  const canonical = new Set<string>();
  const stems = new Set<string>();
  const actions = new Set<string>();
  for (const token of significantTokens(title)) {
    const stem = stemToken(token);
    if (WEAK_TOKENS.has(stem)) continue;
    const markers = ACTION_GROUP_INDEX.get(stem);
    if (markers) {
      for (const marker of markers) {
        actions.add(marker);
        canonical.add(marker);
      }
    } else {
      stems.add(stem);
      canonical.add(stem);
    }
  }

  const proper = new Set<string>();
  const words = title.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    if (!/^[A-Z]/.test(words[i])) continue;
    for (const token of significantTokens(words[i])) {
      const stem = stemToken(token);
      if (stems.has(stem)) proper.add(stem);
    }
  }
  for (const entity of entities) {
    for (const token of significantTokens(entity)) {
      const stem = stemToken(token);
      if (stems.has(stem)) proper.add(stem);
    }
  }

  return { canonical, stems, actions, proper };
}

/** Document frequencies of canonical tokens across the current run corpus. */
export interface CorpusStats {
  size: number;
  df: Map<string, number>;
  /** Highest document frequency still considered "rare" in this corpus. */
  rareDfMax: number;
}

export function buildCorpusStats(prints: EventFingerprint[]): CorpusStats {
  const df = new Map<string, number>();
  for (const print of prints) {
    for (const token of print.canonical) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return {
    size: prints.length,
    df,
    rareDfMax: Math.max(RARE_DF_FLOOR, Math.ceil(prints.length * RARE_DF_FRACTION)),
  };
}

/** Inverse-document-frequency weight of a canonical token. */
export function idfWeight(stats: CorpusStats, token: string): number {
  return Math.log(1 + stats.size / (stats.df.get(token) ?? 1));
}

/**
 * IDF-weighted Jaccard over canonical tokens in [0, 1]: shared rare tokens
 * (missionary, niger) dominate; shared boilerplate (group, says) barely
 * counts.
 */
export function fingerprintSimilarity(
  a: EventFingerprint,
  b: EventFingerprint,
  stats: CorpusStats,
): number {
  let shared = 0;
  let union = 0;
  for (const token of a.canonical) {
    const w = idfWeight(stats, token);
    union += w;
    if (b.canonical.has(token)) shared += w;
  }
  for (const token of b.canonical) {
    if (!a.canonical.has(token)) union += idfWeight(stats, token);
  }
  return union === 0 ? 0 : shared / union;
}

/**
 * IDF-weighted overlap coefficient over canonical tokens in [0, 1]:
 * shared weight normalized by the SMALLER side. Where Jaccard punishes a
 * headline for being richer ("Kevin Rideout, American missionary held in
 * Niger, released after months in captivity" vs "U.S. missionary kidnapped
 * in Niger is released" — the added name and duration dilute the union),
 * containment asks whether the shorter headline's event is CONTAINED in the
 * longer one. Runs hot by construction, so callers must pair it with
 * stricter evidence (strong fingerprint + shared action group).
 */
export function fingerprintContainment(
  a: EventFingerprint,
  b: EventFingerprint,
  stats: CorpusStats,
): number {
  let shared = 0;
  let weightA = 0;
  let weightB = 0;
  for (const token of a.canonical) {
    const w = idfWeight(stats, token);
    weightA += w;
    if (b.canonical.has(token)) shared += w;
  }
  for (const token of b.canonical) weightB += idfWeight(stats, token);
  const smaller = Math.min(weightA, weightB);
  return smaller === 0 ? 0 : shared / smaller;
}

/**
 * True when both headlines carry a marker from the SAME action group — the
 * same act, not merely the absence of conflict. The confirmation the hot
 * containment path requires.
 */
export function hasSharedAction(a: EventFingerprint, b: EventFingerprint): boolean {
  for (const marker of a.actions) if (b.actions.has(marker)) return true;
  return false;
}

/** Shared non-action stems that are rare within the current corpus. */
export function sharedRareStems(
  a: EventFingerprint,
  b: EventFingerprint,
  stats: CorpusStats,
): string[] {
  const out: string[] = [];
  for (const stem of a.stems) {
    if (b.stems.has(stem) && (stats.df.get(stem) ?? 1) <= stats.rareDfMax) out.push(stem);
  }
  return out;
}

/**
 * Action CONFLICT between two headlines: both name table actions and no
 * group is shared (a "vetoes" story vs an "approves" story). Only this
 * symmetric disagreement is evidence of different events. One-sided actions
 * are neutral — reworded coverage routinely nominalizes or drops the verb
 * ("announces merger" vs "to merge", "detained" vs "held"), so a missing
 * marker proves nothing.
 */
export function hasConflictingAction(a: EventFingerprint, b: EventFingerprint): boolean {
  if (a.actions.size === 0 || b.actions.size === 0) return false;
  for (const marker of a.actions) if (b.actions.has(marker)) return false;
  return true;
}

/**
 * Strong fingerprint = the evidence bar that lets clustering relax its
 * headline-similarity threshold:
 *  - at least MIN_SHARED_RARE_STEMS shared rare non-action stems, of which
 *    at least one is a proper-noun anchor (location or actor) on EITHER
 *    side — capitalization at a non-initial title position on one side
 *    already proves the token is a proper noun, and many headlines LEAD
 *    with their anchor ("Harborview region hit by outage") where
 *    capitalization is uninformative;
 *  - no conflicting action words (see hasConflictingAction).
 * The publication-time window is enforced by the caller.
 */
export function isStrongFingerprint(
  a: EventFingerprint,
  b: EventFingerprint,
  stats: CorpusStats,
): boolean {
  const rare = sharedRareStems(a, b, stats);
  if (rare.length < MIN_SHARED_RARE_STEMS) return false;
  if (!rare.some((stem) => a.proper.has(stem) || b.proper.has(stem))) return false;
  return !hasConflictingAction(a, b);
}
