import { describe, expect, it } from "vitest";
import {
  OPTIMIZED_IMAGE_HOSTS,
  isOptimizableImageHost,
} from "@/config/image-hosts";
import nextConfig from "../../next.config";

describe("OPTIMIZED_IMAGE_HOSTS", () => {
  it("is a non-empty list of exact lowercase hostnames", () => {
    expect(OPTIMIZED_IMAGE_HOSTS.length).toBeGreaterThan(0);
    for (const host of OPTIMIZED_IMAGE_HOSTS) {
      expect(host).toBe(host.toLowerCase());
      // Hostnames only — no scheme, path, wildcard or port.
      expect(host).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  it("is alphabetised and free of duplicates", () => {
    const sorted = [...OPTIMIZED_IMAGE_HOSTS].sort();
    expect(OPTIMIZED_IMAGE_HOSTS).toEqual(sorted);
    expect(new Set(OPTIMIZED_IMAGE_HOSTS).size).toBe(OPTIMIZED_IMAGE_HOSTS.length);
  });

  it("carries the hero CDNs seen on the live homepage and sections", () => {
    for (const host of [
      "ichef.bbci.co.uk",
      "d3i6fh83elv35t.cloudfront.net",
      "i.cbc.ca",
      "www.nasa.gov",
      "sportshub.cbsistatic.com",
    ]) {
      expect(OPTIMIZED_IMAGE_HOSTS).toContain(host);
    }
  });
});

describe("isOptimizableImageHost", () => {
  it("accepts an allowlisted host", () => {
    expect(
      isOptimizableImageHost(
        "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/x/live/y.jpg",
      ),
    ).toBe(true);
    expect(
      isOptimizableImageHost(
        "https://i.cbc.ca/ais/abc,123/full/max/0/default.jpg?im=Crop%2Crect",
      ),
    ).toBe(true);
  });

  it("rejects subdomains of an allowlisted host (exact-host allowlist)", () => {
    // Next caps remotePatterns at 50 entries, so the config cannot carry a
    // `**.host` companion per host; the helper must match exactly to agree
    // with the server.
    expect(isOptimizableImageHost("https://static.variety.com/a.jpg")).toBe(false);
    expect(isOptimizableImageHost("https://a.b.thehill.com/a.jpg")).toBe(false);
  });

  it("is case-insensitive on the hostname", () => {
    expect(isOptimizableImageHost("https://ICHEF.BBCI.CO.UK/a.jpg")).toBe(true);
  });

  it("rejects http:", () => {
    expect(isOptimizableImageHost("http://ichef.bbci.co.uk/a.jpg")).toBe(false);
  });

  it("rejects other schemes", () => {
    expect(isOptimizableImageHost("data:image/png;base64,AAAA")).toBe(false);
    expect(isOptimizableImageHost("ftp://ichef.bbci.co.uk/a.jpg")).toBe(false);
  });

  it("rejects unlisted hosts", () => {
    expect(isOptimizableImageHost("https://static01.nyt.com/a.jpg")).toBe(false);
    expect(isOptimizableImageHost("https://example.com/a.jpg")).toBe(false);
  });

  it("rejects a host that merely ends with an allowlisted string", () => {
    expect(
      isOptimizableImageHost("https://evil-ichef.bbci.co.uk.attacker.com/a.jpg"),
    ).toBe(false);
    expect(isOptimizableImageHost("https://evil-ichef.bbci.co.uk/a.jpg")).toBe(false);
    expect(isOptimizableImageHost("https://notthehill.com/a.jpg")).toBe(false);
  });

  it("rejects an allowlisted host used as a subdomain of an attacker host", () => {
    expect(
      isOptimizableImageHost("https://ichef.bbci.co.uk.attacker.com/a.jpg"),
    ).toBe(false);
  });

  it("rejects malformed and relative URLs", () => {
    expect(isOptimizableImageHost("")).toBe(false);
    expect(isOptimizableImageHost("not a url")).toBe(false);
    expect(isOptimizableImageHost("/placeholder.svg")).toBe(false);
    expect(isOptimizableImageHost("//ichef.bbci.co.uk/a.jpg")).toBe(false);
    expect(isOptimizableImageHost("https://")).toBe(false);
  });
});

/**
 * The optimizer is ON again only because every non-hero <Image> opts out per
 * image (components/news/RemoteImage.tsx). next.config must therefore NOT set
 * images.unoptimized (it would force every image raw, including the hero —
 * node_modules/next/dist/shared/lib/get-img-props.js), and its remotePatterns
 * must be exactly the allowlist (one exact entry per host — Next caps the
 * array at 50): a wildcard-only hostname would reopen /_next/image as a
 * public proxy.
 */
describe("next.config images", () => {
  const images = nextConfig.images;
  if (!images) throw new Error("next.config.ts must configure images");
  const patterns = (images.remotePatterns ?? []).map((pattern) =>
    pattern instanceof URL
      ? { protocol: pattern.protocol.replace(/:$/, ""), hostname: pattern.hostname }
      : { protocol: pattern.protocol, hostname: pattern.hostname },
  );

  it("does not force every image unoptimized", () => {
    expect(images.unoptimized).toBe(false);
  });

  it("allowlists exactly the optimizable hosts over https", () => {
    const expected = OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
    }));
    expect(patterns).toEqual(expected);
  });

  it("stays under Next's 50-entry remotePatterns cap", () => {
    // Measured at build 2026-08-21: "Array must contain at most 50
    // element(s) at images.remotePatterns" is a fatal config error.
    expect(patterns.length).toBeLessThanOrEqual(50);
    expect(OPTIMIZED_IMAGE_HOSTS.length).toBeLessThanOrEqual(50);
  });

  it("never allows a bare wildcard hostname", () => {
    for (const { hostname } of patterns) {
      expect(hostname).not.toMatch(/^\*+$/);
      expect(hostname).not.toMatch(/^\*\*\.[a-z]+$/);
    }
  });

  it("keeps every optimizable URL inside the remotePatterns allowlist", () => {
    // isOptimizableImageHost() matches hosts exactly; the server must agree.
    const hostnames = new Set(patterns.map((pattern) => pattern.hostname));
    for (const host of OPTIMIZED_IMAGE_HOSTS) {
      expect(hostnames.has(host)).toBe(true);
      expect(isOptimizableImageHost(`https://${host}/x.jpg`)).toBe(true);
    }
  });

  it("caps the hero srcset at two device widths to bound transformations", () => {
    expect(images.deviceSizes).toEqual([640, 1080]);
    expect(images.formats).toEqual(["image/webp"]);
    expect(images.minimumCacheTTL).toBe(86400);
  });
});
