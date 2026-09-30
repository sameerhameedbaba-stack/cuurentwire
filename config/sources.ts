/**
 * Source authority configuration.
 *
 * Tiers reflect journalistic reputation and reach — never political ideology.
 * Values are configuration so they can be edited without touching pipeline code.
 *
 * Tier A — major wire services, public-service broadcasters, national publications.
 * Tier B — strong regional and specialist publications.
 * Tier C — smaller credible publications and unknown-but-valid sources.
 */

export type SourceTier = "A" | "B" | "C";

/**
 * Reader access model — the "free range" filter for the slim relaunch
 * (owner decision 2026-09-15: publish only stories readers can actually
 * open, from sources that cost us nothing).
 *
 * - `free`      — articles are readable without a subscription or meter.
 * - `metered`   — some articles free, then a paywall; unpredictable per URL.
 * - `paywalled` — subscription required for substantially all articles.
 *
 * These are EDITORIAL LABELS, not verified facts, and publishers change
 * their access model without notice. Two consequences that the code relies
 * on: the default for anything unlabeled is `metered` (see resolveAccess),
 * never `free`, so an unknown source can never smuggle itself into the free
 * pool; and this table needs a human re-check periodically — see
 * `seo/routines/weekly.md`. Last reviewed 2026-09-15.
 */
export type SourceAccess = "free" | "metered" | "paywalled";

/**
 * Explicit reuse licence, where a publisher grants one. This is a much
 * stronger permission than "free to read": these outlets invite
 * republication under stated terms.
 *
 * - `public-domain` — US federal works (e.g. NASA); no rights reserved.
 * - `cc-by`         — reuse with attribution.
 * - `cc-by-nc-nd`   — reuse with attribution, non-commercial, no derivatives.
 *
 * NOTE: `cc-by-nc-nd` forbids BOTH commercial use and derivative works, so
 * it does NOT license our synthesis. It is recorded for completeness only;
 * `licensePermitsSynthesis` deliberately excludes it.
 */
export type SourceLicense = "public-domain" | "cc-by" | "cc-by-nc-nd";

export interface SourceDefinition {
  /** Canonical display name. */
  name: string;
  /** Primary domain (no protocol, no www). */
  domain: string;
  /**
   * Additional domains this publisher serves articles or feeds from
   * (legacy domains, feed CDNs, country variants). Every alt domain
   * resolves to the same canonical name and tier as the primary — this is
   * what keeps RSS channel titles ("ABC News: Top Stories") from leaking
   * into the UI when a live feed links a domain variant.
   */
  altDomains?: string[];
  tier: SourceTier;
  /** Home country of the publication (weak geography signal only). */
  country?: "US" | "CA" | "INTL";
  /** True for clearly-labeled demo/mock outlets used in development. */
  demo?: boolean;
  /**
   * Reader access model. Omitted means "not reviewed" and resolves to
   * `metered` — deliberately NOT `free`, so the free-range filter fails
   * closed for any source nobody has checked.
   */
  access?: SourceAccess;
  /** Publisher-granted reuse licence, where one exists. */
  license?: SourceLicense;
}

export const TIER_WEIGHT: Record<SourceTier, number> = {
  A: 1.0,
  B: 0.7,
  C: 0.45,
};

export const SOURCES: SourceDefinition[] = [
  // ── Tier A: wires, public broadcasters, major nationals ──────────────
  { name: "Reuters", domain: "reuters.com", tier: "A", country: "INTL", access: "metered" },
  { name: "Associated Press", domain: "apnews.com", tier: "A", country: "US", access: "free" },
  { name: "CBC News", domain: "cbc.ca", tier: "A", country: "CA", access: "free" },
  { name: "NPR", domain: "npr.org", tier: "A", country: "US", access: "free" },
  // Live feed is feeds.bbci.co.uk; item links use bbc.com and bbc.co.uk.
  { name: "BBC News", domain: "bbc.com", altDomains: ["bbc.co.uk", "bbci.co.uk"], tier: "A", country: "INTL", access: "free" },
  { name: "The New York Times", domain: "nytimes.com", tier: "A", country: "US", access: "paywalled" },
  { name: "The Washington Post", domain: "washingtonpost.com", tier: "A", country: "US", access: "paywalled" },
  { name: "The Wall Street Journal", domain: "wsj.com", tier: "A", country: "US", access: "paywalled" },
  { name: "Bloomberg", domain: "bloomberg.com", tier: "A", country: "US", access: "paywalled" },
  { name: "The Globe and Mail", domain: "theglobeandmail.com", tier: "A", country: "CA", access: "paywalled" },
  { name: "Financial Times", domain: "ft.com", tier: "A", country: "INTL", access: "paywalled" },
  { name: "The Canadian Press", domain: "thecanadianpress.com", tier: "A", country: "CA", access: "free" },
  { name: "CTV News", domain: "ctvnews.ca", tier: "A", country: "CA", access: "free" },
  { name: "PBS NewsHour", domain: "pbs.org", tier: "A", country: "US", access: "free" },

  // ── Tier B: strong regional / specialist ─────────────────────────────
  { name: "Politico", domain: "politico.com", tier: "B", country: "US", access: "free" },
  { name: "Axios", domain: "axios.com", tier: "B", country: "US", access: "free" },
  { name: "CNBC", domain: "cnbc.com", tier: "B", country: "US", access: "free" },
  { name: "CNN", domain: "cnn.com", tier: "B", country: "US", access: "free" },
  // ABC migrated abcnews.go.com → abcnews.com; live feed items link both.
  { name: "ABC News", domain: "abcnews.go.com", altDomains: ["abcnews.com"], tier: "B", country: "US", access: "free" },
  { name: "CBS News", domain: "cbsnews.com", tier: "B", country: "US", access: "free" },
  { name: "NBC News", domain: "nbcnews.com", tier: "B", country: "US", access: "free" },
  { name: "Global News", domain: "globalnews.ca", tier: "B", country: "CA", access: "free" },
  { name: "National Post", domain: "nationalpost.com", tier: "B", country: "CA", access: "metered" },
  { name: "Toronto Star", domain: "thestar.com", tier: "B", country: "CA", access: "metered" },
  { name: "The Guardian", domain: "theguardian.com", tier: "B", country: "INTL", access: "free" },
  { name: "The Verge", domain: "theverge.com", tier: "B", country: "US", access: "free" },
  { name: "Ars Technica", domain: "arstechnica.com", tier: "B", country: "US", access: "metered" },
  { name: "TechCrunch", domain: "techcrunch.com", tier: "B", country: "US", access: "free" },
  { name: "Wired", domain: "wired.com", tier: "B", country: "US", access: "metered" },
  { name: "The Athletic", domain: "theathletic.com", tier: "B", country: "US", access: "paywalled" },
  { name: "ESPN", domain: "espn.com", tier: "B", country: "US", access: "free" },
  { name: "TSN", domain: "tsn.ca", tier: "B", country: "CA", access: "free" },
  { name: "Financial Post", domain: "financialpost.com", tier: "B", country: "CA", access: "metered" },
  { name: "The Hill", domain: "thehill.com", tier: "B", country: "US", access: "free" },
  { name: "MarketWatch", domain: "marketwatch.com", tier: "B", country: "US", access: "metered" },

  // ── Tier C: smaller credible publications ────────────────────────────
  { name: "Vancouver Sun", domain: "vancouversun.com", tier: "C", country: "CA", access: "metered" },
  { name: "Calgary Herald", domain: "calgaryherald.com", tier: "C", country: "CA", access: "metered" },
  { name: "Montreal Gazette", domain: "montrealgazette.com", tier: "C", country: "CA", access: "metered" },
  { name: "Seattle Times", domain: "seattletimes.com", tier: "C", country: "US", access: "metered" },
  { name: "Chicago Tribune", domain: "chicagotribune.com", tier: "C", country: "US", access: "metered" },
  { name: "Los Angeles Times", domain: "latimes.com", tier: "C", country: "US", access: "metered" },
  { name: "Boston Globe", domain: "bostonglobe.com", tier: "C", country: "US", access: "paywalled" },
  { name: "Houston Chronicle", domain: "houstonchronicle.com", tier: "C", country: "US", access: "metered" },
  // Added with the 2026-08 curated feed expansion (config/feeds.ts). Tiers
  // follow the same reputation/reach rule as above — never ideology.
  { name: "Fox News", domain: "foxnews.com", tier: "B", country: "US", access: "free" },
  { name: "ProPublica", domain: "propublica.org", tier: "A", country: "US", access: "free", license: "cc-by-nc-nd" },
  { name: "NASA", domain: "nasa.gov", tier: "A", country: "US", access: "free", license: "public-domain" },
  { name: "Al Jazeera", domain: "aljazeera.com", tier: "B", country: "INTL", access: "free" },
  { name: "France 24", domain: "france24.com", tier: "B", country: "INTL", access: "free" },
  { name: "Sportsnet", domain: "sportsnet.ca", tier: "B", country: "CA", access: "free" },
  { name: "CBS Sports", domain: "cbssports.com", tier: "B", country: "US", access: "free" },
  { name: "Variety", domain: "variety.com", tier: "B", country: "US", access: "metered" },
  { name: "Deadline", domain: "deadline.com", tier: "B", country: "US", access: "free" },
  { name: "Billboard", domain: "billboard.com", tier: "B", country: "US", access: "metered" },
  { name: "The Hollywood Reporter", domain: "hollywoodreporter.com", tier: "B", country: "US", access: "metered" },
  { name: "Engadget", domain: "engadget.com", tier: "B", country: "US", access: "free" },
  { name: "MIT Technology Review", domain: "technologyreview.com", tier: "B", country: "US", access: "metered" },
  { name: "VentureBeat", domain: "venturebeat.com", tier: "C", country: "US", access: "free" },
  { name: "Space.com", domain: "space.com", tier: "B", country: "US", access: "free" },
  { name: "Phys.org", domain: "phys.org", tier: "B", country: "INTL", access: "free" },
  { name: "STAT", domain: "statnews.com", tier: "B", country: "US", access: "metered" },
  { name: "KFF Health News", domain: "kffhealthnews.org", tier: "B", country: "US", access: "free", license: "cc-by" },
  { name: "Inside Climate News", domain: "insideclimatenews.org", tier: "B", country: "US", access: "free", license: "cc-by-nc-nd" },
  { name: "Grist", domain: "grist.org", tier: "B", country: "US", access: "free", license: "cc-by" },
  { name: "Chalkbeat", domain: "chalkbeat.org", tier: "B", country: "US", access: "free", license: "cc-by-nc-nd" },
  { name: "HousingWire", domain: "housingwire.com", tier: "C", country: "US", access: "paywalled" },
  { name: "The Marshall Project", domain: "themarshallproject.org", tier: "B", country: "US", access: "free", license: "cc-by-nc-nd" },
  { name: "The Texas Tribune", domain: "texastribune.org", tier: "B", country: "US", access: "free", license: "cc-by" },
  { name: "CalMatters", domain: "calmatters.org", tier: "B", country: "US", access: "free", license: "cc-by" },
  { name: "Religion News Service", domain: "religionnews.com", tier: "B", country: "US", access: "free" },

  // ── Demo outlets (development mock mode only) ────────────────────────
  { name: "Continental Wire", domain: "continentalwire.demo", tier: "A", country: "INTL", demo: true, access: "free" },
  { name: "North American Press", domain: "napress.demo", tier: "A", country: "US", demo: true, access: "free" },
  { name: "True North Broadcasting", domain: "truenorth.demo", tier: "A", country: "CA", demo: true, access: "free" },
  { name: "Capitol Journal", domain: "capitoljournal.demo", tier: "B", country: "US", demo: true, access: "free" },
  { name: "Maple Leaf Times", domain: "mapleleaftimes.demo", tier: "B", country: "CA", demo: true, access: "free" },
  { name: "Atlantic Business Review", domain: "atlanticbusiness.demo", tier: "B", country: "US", demo: true, access: "free" },
  { name: "Pacific Standard News", domain: "pacificstandard.demo", tier: "B", country: "US", demo: true, access: "free" },
  { name: "Prairie Post", domain: "prairiepost.demo", tier: "C", country: "CA", demo: true, access: "free" },
  { name: "Great Lakes Gazette", domain: "greatlakesgazette.demo", tier: "C", country: "US", demo: true, access: "free" },
  { name: "Northern Tech Desk", domain: "northerntechdesk.demo", tier: "C", country: "CA", demo: true, access: "free" },
];

const byDomain = new Map<string, SourceDefinition>(
  SOURCES.flatMap((s) => [
    [s.domain, s] as const,
    ...(s.altDomains ?? []).map((d) => [d, s] as const),
  ]),
);
const byName = new Map<string, SourceDefinition>(
  SOURCES.map((s) => [s.name.toLowerCase(), s]),
);

/**
 * Resolve a hostname to its configured source. Matches the exact host first,
 * then progressively strips leading subdomain labels (feeds.npr.org →
 * npr.org, www.bbc.co.uk → bbc.co.uk, edition.cnn.com → cnn.com) so feed
 * CDNs and country editions resolve to the same canonical publisher.
 */
/**
 * Real publications CurrentWire tiers by authority (demo sources excluded).
 * The honest denominator for any "N of M publishers" line on a public page:
 * our counts are always a lower bound over the publications we track, never
 * a claim about all coverage everywhere.
 */
export const TRACKED_PUBLISHER_COUNT = SOURCES.filter((source) => !source.demo).length;

export function lookupSourceByDomain(domain: string): SourceDefinition | undefined {
  const labels = domain.trim().toLowerCase().split(".");
  for (let start = 0; start <= labels.length - 2; start++) {
    const candidate = byDomain.get(labels.slice(start).join("."));
    if (candidate) return candidate;
  }
  return undefined;
}

export function lookupSourceByName(name: string): SourceDefinition | undefined {
  return byName.get(name.trim().toLowerCase());
}

/** Resolve tier for an article's source; unknown sources default to Tier C. */
export function resolveTier(sourceName: string, sourceDomain: string): SourceTier {
  return (
    lookupSourceByDomain(sourceDomain)?.tier ??
    lookupSourceByName(sourceName)?.tier ??
    "C"
  );
}

/**
 * Resolve the reader-access model for an article's source.
 *
 * Unknown and unreviewed sources resolve to `metered`, never `free`. This
 * fails CLOSED on purpose: the free-range filter is a promise to the reader
 * that the story opens without a subscription, and an unrecognised domain is
 * exactly the case where we cannot keep that promise. A source only counts
 * as free once a human has put it in the table above.
 */
export function resolveAccess(sourceName: string, sourceDomain: string): SourceAccess {
  return (
    lookupSourceByDomain(sourceDomain)?.access ??
    lookupSourceByName(sourceName)?.access ??
    "metered"
  );
}

/** True when the source's articles open without a subscription or meter. */
export function isFreeToRead(sourceName: string, sourceDomain: string): boolean {
  return resolveAccess(sourceName, sourceDomain) === "free";
}

/** Publisher-granted reuse licence for a source, if any. */
export function resolveLicense(
  sourceName: string,
  sourceDomain: string,
): SourceLicense | undefined {
  return (
    lookupSourceByDomain(sourceDomain)?.license ??
    lookupSourceByName(sourceName)?.license
  );
}

/**
 * True when the publisher's own licence permits building a derivative work
 * (our synthesis) from their reporting.
 *
 * `cc-by-nc-nd` is excluded deliberately: the ND ("no derivatives") term
 * forbids exactly what a synthesis is, and the NC term forbids commercial
 * use. Being generous about this would be the expensive kind of mistake, so
 * the predicate stays narrow.
 *
 * This is NOT the permission we normally rely on — we write original prose
 * from facts, and facts are not copyrightable. It marks the sources where we
 * additionally have an explicit grant, which is useful when a story needs
 * closer paraphrase than usual.
 */
export function licensePermitsSynthesis(
  sourceName: string,
  sourceDomain: string,
): boolean {
  const license = resolveLicense(sourceName, sourceDomain);
  return license === "public-domain" || license === "cc-by";
}
