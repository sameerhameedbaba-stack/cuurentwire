/** URL canonicalization — used for exact-duplicate removal and stable IDs. */

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref",
  "referrer", "source", "cmp", "ito", "ns_campaign", "ns_mchannel",
  "smid", "smtyp", "partner", "ocid", "cid", "at_medium", "at_campaign",
]);

/**
 * Canonicalize an article URL:
 * lowercase host, strip www, drop tracking params, drop hash, trim trailing slash.
 * Returns null for anything that is not plain http(s).
 */
export function canonicalizeUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.protocol = "https:";

  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) kept.append(key, value);
  }
  url.search = kept.toString() ? `?${kept.toString()}` : "";

  let result = url.toString();
  if (result.endsWith("/") && url.pathname === "/") {
    // keep bare-host trailing slash as-is
  } else {
    result = result.replace(/\/$/, "");
  }
  return result;
}

/** Extract the registrable-ish domain from a URL (host minus www). */
export function domainFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Only http/https URLs are ever rendered as outbound links. */
export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
