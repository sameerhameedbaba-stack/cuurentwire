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
}

export const TIER_WEIGHT: Record<SourceTier, number> = {
  A: 1.0,
  B: 0.7,
  C: 0.45,
};

export const SOURCES: SourceDefinition[] = [
  // ── Tier A: wires, public broadcasters, major nationals ──────────────
  { name: "Reuters", domain: "reuters.com", tier: "A", country: "INTL" },
  { name: "Associated Press", domain: "apnews.com", tier: "A", country: "US" },
  { name: "CBC News", domain: "cbc.ca", tier: "A", country: "CA" },
  { name: "NPR", domain: "npr.org", tier: "A", country: "US" },
  // Live feed is feeds.bbci.co.uk; item links use bbc.com and bbc.co.uk.
  { name: "BBC News", domain: "bbc.com", altDomains: ["bbc.co.uk", "bbci.co.uk"], tier: "A", country: "INTL" },
  { name: "The New York Times", domain: "nytimes.com", tier: "A", country: "US" },
  { name: "The Washington Post", domain: "washingtonpost.com", tier: "A", country: "US" },
  { name: "The Wall Street Journal", domain: "wsj.com", tier: "A", country: "US" },
  { name: "Bloomberg", domain: "bloomberg.com", tier: "A", country: "US" },
  { name: "The Globe and Mail", domain: "theglobeandmail.com", tier: "A", country: "CA" },
  { name: "Financial Times", domain: "ft.com", tier: "A", country: "INTL" },
  { name: "The Canadian Press", domain: "thecanadianpress.com", tier: "A", country: "CA" },
  { name: "CTV News", domain: "ctvnews.ca", tier: "A", country: "CA" },
  { name: "PBS NewsHour", domain: "pbs.org", tier: "A", country: "US" },

  // ── Tier B: strong regional / specialist ─────────────────────────────
  { name: "Politico", domain: "politico.com", tier: "B", country: "US" },
  { name: "Axios", domain: "axios.com", tier: "B", country: "US" },
  { name: "CNBC", domain: "cnbc.com", tier: "B", country: "US" },
  { name: "CNN", domain: "cnn.com", tier: "B", country: "US" },
  // ABC migrated abcnews.go.com → abcnews.com; live feed items link both.
  { name: "ABC News", domain: "abcnews.go.com", altDomains: ["abcnews.com"], tier: "B", country: "US" },
  { name: "CBS News", domain: "cbsnews.com", tier: "B", country: "US" },
  { name: "NBC News", domain: "nbcnews.com", tier: "B", country: "US" },
  { name: "Global News", domain: "globalnews.ca", tier: "B", country: "CA" },
  { name: "National Post", domain: "nationalpost.com", tier: "B", country: "CA" },
  { name: "Toronto Star", domain: "thestar.com", tier: "B", country: "CA" },
  { name: "The Guardian", domain: "theguardian.com", tier: "B", country: "INTL" },
  { name: "The Verge", domain: "theverge.com", tier: "B", country: "US" },
  { name: "Ars Technica", domain: "arstechnica.com", tier: "B", country: "US" },
  { name: "TechCrunch", domain: "techcrunch.com", tier: "B", country: "US" },
  { name: "Wired", domain: "wired.com", tier: "B", country: "US" },
  { name: "The Athletic", domain: "theathletic.com", tier: "B", country: "US" },
  { name: "ESPN", domain: "espn.com", tier: "B", country: "US" },
  { name: "TSN", domain: "tsn.ca", tier: "B", country: "CA" },
  { name: "Financial Post", domain: "financialpost.com", tier: "B", country: "CA" },
  { name: "The Hill", domain: "thehill.com", tier: "B", country: "US" },
  { name: "MarketWatch", domain: "marketwatch.com", tier: "B", country: "US" },

  // ── Tier C: smaller credible publications ────────────────────────────
  { name: "Vancouver Sun", domain: "vancouversun.com", tier: "C", country: "CA" },
  { name: "Calgary Herald", domain: "calgaryherald.com", tier: "C", country: "CA" },
  { name: "Montreal Gazette", domain: "montrealgazette.com", tier: "C", country: "CA" },
  { name: "Seattle Times", domain: "seattletimes.com", tier: "C", country: "US" },
  { name: "Chicago Tribune", domain: "chicagotribune.com", tier: "C", country: "US" },
  { name: "Los Angeles Times", domain: "latimes.com", tier: "C", country: "US" },
  { name: "Boston Globe", domain: "bostonglobe.com", tier: "C", country: "US" },
  { name: "Houston Chronicle", domain: "houstonchronicle.com", tier: "C", country: "US" },
  // Added with the 2026-08 curated feed expansion (config/feeds.ts). Tiers
  // follow the same reputation/reach rule as above — never ideology.
  { name: "Fox News", domain: "foxnews.com", tier: "B", country: "US" },
  { name: "ProPublica", domain: "propublica.org", tier: "A", country: "US" },
  { name: "NASA", domain: "nasa.gov", tier: "A", country: "US" },
  { name: "Al Jazeera", domain: "aljazeera.com", tier: "B", country: "INTL" },
  { name: "France 24", domain: "france24.com", tier: "B", country: "INTL" },
  { name: "Sportsnet", domain: "sportsnet.ca", tier: "B", country: "CA" },
  { name: "CBS Sports", domain: "cbssports.com", tier: "B", country: "US" },
  { name: "Variety", domain: "variety.com", tier: "B", country: "US" },
  { name: "Deadline", domain: "deadline.com", tier: "B", country: "US" },
  { name: "Billboard", domain: "billboard.com", tier: "B", country: "US" },
  { name: "The Hollywood Reporter", domain: "hollywoodreporter.com", tier: "B", country: "US" },
  { name: "Engadget", domain: "engadget.com", tier: "B", country: "US" },
  { name: "MIT Technology Review", domain: "technologyreview.com", tier: "B", country: "US" },
  { name: "VentureBeat", domain: "venturebeat.com", tier: "C", country: "US" },
  { name: "Space.com", domain: "space.com", tier: "B", country: "US" },
  { name: "Phys.org", domain: "phys.org", tier: "B", country: "INTL" },
  { name: "STAT", domain: "statnews.com", tier: "B", country: "US" },
  { name: "KFF Health News", domain: "kffhealthnews.org", tier: "B", country: "US" },
  { name: "Inside Climate News", domain: "insideclimatenews.org", tier: "B", country: "US" },
  { name: "Grist", domain: "grist.org", tier: "B", country: "US" },
  { name: "Chalkbeat", domain: "chalkbeat.org", tier: "B", country: "US" },
  { name: "HousingWire", domain: "housingwire.com", tier: "C", country: "US" },
  { name: "The Marshall Project", domain: "themarshallproject.org", tier: "B", country: "US" },
  { name: "The Texas Tribune", domain: "texastribune.org", tier: "B", country: "US" },
  { name: "CalMatters", domain: "calmatters.org", tier: "B", country: "US" },
  { name: "Religion News Service", domain: "religionnews.com", tier: "B", country: "US" },

  // ── Demo outlets (development mock mode only) ────────────────────────
  { name: "Continental Wire", domain: "continentalwire.demo", tier: "A", country: "INTL", demo: true },
  { name: "North American Press", domain: "napress.demo", tier: "A", country: "US", demo: true },
  { name: "True North Broadcasting", domain: "truenorth.demo", tier: "A", country: "CA", demo: true },
  { name: "Capitol Journal", domain: "capitoljournal.demo", tier: "B", country: "US", demo: true },
  { name: "Maple Leaf Times", domain: "mapleleaftimes.demo", tier: "B", country: "CA", demo: true },
  { name: "Atlantic Business Review", domain: "atlanticbusiness.demo", tier: "B", country: "US", demo: true },
  { name: "Pacific Standard News", domain: "pacificstandard.demo", tier: "B", country: "US", demo: true },
  { name: "Prairie Post", domain: "prairiepost.demo", tier: "C", country: "CA", demo: true },
  { name: "Great Lakes Gazette", domain: "greatlakesgazette.demo", tier: "C", country: "US", demo: true },
  { name: "Northern Tech Desk", domain: "northerntechdesk.demo", tier: "C", country: "CA", demo: true },
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
