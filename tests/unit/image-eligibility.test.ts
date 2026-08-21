import { describe, expect, it } from "vitest";
import {
  THRESHOLDS,
  classifyDimensions,
  extractHeroImage,
  extractOgImage,
  imageDimensions,
  parseNewsSitemap,
  summarize,
  upgradeHistoryRow,
} from "../../scripts/image-eligibility.mjs";

/**
 * scripts/image-eligibility.mjs is the weekly Discover image audit. It is
 * imported here as a module: its main() only runs when the file is the
 * process entry point, so importing it performs no network calls.
 */

const PAGE = "https://currentwire.us/story/example-abc123";

/** The story page's hero as Next/React serialise it (fetchPriority camelCase, &amp; in src). */
const heroPage = (imgTag: string) => `<!doctype html><html><head>
<meta property="og:image" content="https://currentwire.us/story/example-abc123/opengraph-image?abc"/>
</head><body>
<img alt="logo" loading="lazy" src="https://cdn.example.com/not-the-hero.png">
<div class="img-frame relative aspect-[16/9]">${imgTag}</div>
<img alt="later" loading="lazy" fetchPriority="high" src="https://cdn.example.com/later.jpg">
</body></html>`;

describe("extractHeroImage", () => {
  it("returns the remote publisher URL of the first fetchpriority=high <img>, entities decoded", () => {
    const html = heroPage(
      '<img alt="2 dead" fetchPriority="high" loading="eager" decoding="async" data-nimg="fill" class="object-cover" src="https://globalnews.ca/wp-content/uploads/2026/08/IMG.jpg?quality=65&amp;strip=all&amp;w=976"/>',
    );
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "https://globalnews.ca/wp-content/uploads/2026/08/IMG.jpg?quality=65&strip=all&w=976",
      kind: "publisher",
    });
  });

  it("accepts lowercase fetchpriority, single quotes and src before the priority attribute", () => {
    const html = heroPage(
      "<img src='https://img.example.org/a.webp' loading='eager' fetchpriority='high' alt=''>",
    );
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "https://img.example.org/a.webp",
      kind: "publisher",
    });
  });

  it("classifies a local src as placeholder art and keeps the path as written", () => {
    const html = heroPage(
      '<img src="/placeholders/business-1.svg" alt="t" loading="eager" fetchPriority="high" class="absolute inset-0 h-full w-full object-cover"/>',
    );
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "/placeholders/business-1.svg",
      kind: "placeholder",
    });
  });

  it("reports none when no <img> carries fetchpriority=high (category placeholder branch has no <img>)", () => {
    const html = `<html><head><meta property="og:image" content="/story/x/opengraph-image"/></head>
<body><img alt="logo" loading="lazy" src="/logo.svg"><div aria-hidden class="absolute inset-0"><svg></svg></div></body></html>`;
    expect(extractHeroImage(html, PAGE)).toEqual({ src: null, kind: "none" });
    expect(extractHeroImage("", PAGE)).toEqual({ src: null, kind: "none" });
  });

  it("ignores srcset/data-src and a fetchpriority other than high", () => {
    const html = heroPage(
      '<img alt="" fetchPriority="low" src="https://cdn.example.com/low.jpg" data-src="https://cdn.example.com/data.jpg" srcset="https://cdn.example.com/set.jpg 1x">',
    );
    // The only fetchpriority=high image is the trailing "later" one.
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "https://cdn.example.com/later.jpg",
      kind: "publisher",
    });
  });

  it("unwraps /_next/image?url=... to the optimised publisher URL", () => {
    const html = heroPage(
      '<img alt="" fetchPriority="high" loading="eager" src="/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fb.jpg%3Fw%3D976&amp;w=1200&amp;q=75"/>',
    );
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "https://cdn.example.com/b.jpg?w=976",
      kind: "publisher",
    });
  });

  it("unwraps an absolute /_next/image URL and classifies a local inner url as placeholder", () => {
    const html = heroPage(
      '<img fetchPriority="high" src="https://currentwire.us/_next/image?url=%2Fplaceholders%2Fworld-1.svg&amp;w=1200&amp;q=75"/>',
    );
    expect(extractHeroImage(html, PAGE)).toEqual({
      src: "/placeholders/world-1.svg",
      kind: "placeholder",
    });
  });

  it("returns unknown for a hero <img> without a usable src", () => {
    expect(extractHeroImage(heroPage('<img fetchPriority="high" alt="no src">'), PAGE)).toEqual({
      src: null,
      kind: "unknown",
    });
    expect(
      extractHeroImage(heroPage('<img fetchPriority="high" src="data:image/gif;base64,R0lGOD">'), PAGE),
    ).toEqual({ src: "data:image/gif;base64,R0lGOD", kind: "unknown" });
    expect(extractHeroImage(heroPage('<img fetchPriority="high" src="/_next/image?w=1200">'), PAGE)).toEqual({
      src: "/_next/image?w=1200",
      kind: "unknown",
    });
  });
});

describe("extractOgImage", () => {
  it("resolves the og:image against the page and decodes entities", () => {
    const html =
      '<meta property="og:image:width" content="1200"/><meta property="og:image" content="/story/x/opengraph-image?a=1&amp;b=2"/>';
    expect(extractOgImage(html, PAGE)).toBe(
      "https://currentwire.us/story/x/opengraph-image?a=1&b=2",
    );
    expect(extractOgImage("<html></html>", PAGE)).toBeNull();
  });
});

describe("parseNewsSitemap", () => {
  it("keeps only /story/ URLs, newest first", () => {
    const xml = `<urlset>
<url><loc>https://currentwire.us/story/older</loc><lastmod>2026-08-20T10:00:00Z</lastmod></url>
<url><loc>https://currentwire.us/topic/not-a-story</loc><lastmod>2026-08-22T10:00:00Z</lastmod></url>
<url><loc>https://currentwire.us/story/newer?x=1&amp;y=2</loc><news:news><news:publication_date>2026-08-21T10:00:00Z</news:publication_date></news:news></url>
</urlset>`;
    expect(parseNewsSitemap(xml).map((e) => e.url)).toEqual([
      "https://currentwire.us/story/newer?x=1&y=2",
      "https://currentwire.us/story/older",
    ]);
  });
});

describe("imageDimensions / classifyDimensions", () => {
  it("reads a PNG IHDR and flags the 1200x630 card as eligible", () => {
    const png = Buffer.alloc(24);
    png.write("\x89PNG\r\n\x1a\n", 0, "latin1");
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "latin1");
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(630, 20);
    expect(imageDimensions(png)).toEqual({ format: "png", width: 1200, height: 630 });
    expect(classifyDimensions(1200, 630)).toEqual({
      aspect: 1.905,
      width1200: true,
      pixels300k: true,
      wide16x9: true,
    });
    expect(classifyDimensions(976, 549)).toMatchObject({ width1200: false, wide16x9: true });
    expect(THRESHOLDS.minWidth).toBe(1200);
  });
});

type Measurement = {
  width?: number | null;
  width1200?: boolean;
  pixels300k?: boolean;
  wide16x9?: boolean;
  broken?: boolean;
};
const og = (m: Measurement & { hasImage?: boolean } = {}) => ({
  src: null,
  hasImage: true,
  width: 1200,
  width1200: true,
  pixels300k: true,
  wide16x9: true,
  broken: false,
  ...m,
});
const hero = (kind: string, m: Measurement = {}) => ({
  src: null,
  kind,
  width: null,
  width1200: false,
  pixels300k: false,
  wide16x9: false,
  broken: false,
  ...m,
});

describe("summarize", () => {
  it("reports og and hero separately, hero percentages over all rows plus a publisher-only width share", () => {
    const rows = [
      { url: "a", pageStatus: 200, og: og(), hero: hero("publisher", { width: 1600, width1200: true, pixels300k: true, wide16x9: true }) },
      { url: "b", pageStatus: 200, og: og(), hero: hero("publisher", { width: 976, pixels300k: true, wide16x9: true }) },
      { url: "c", pageStatus: 200, og: og(), hero: hero("placeholder") },
      { url: "d", pageStatus: 404, og: og({ hasImage: false, width: null, width1200: false, pixels300k: false, wide16x9: false, broken: true }), hero: hero("unknown", { broken: true }) },
      { url: "e", pageStatus: 200, og: og(), hero: hero("none") },
    ];
    expect(summarize(rows)).toEqual({
      sampled: 5,
      og: {
        pctWithImage: 80,
        pctWidth1200: 80,
        pctPixels300k: 80,
        pctWide16x9: 80,
        pctBroken: 20,
        medianWidth: 1200,
      },
      hero: {
        pctPublisherImage: 40,
        pctPlaceholder: 20,
        pctNone: 20,
        pctWidth1200: 20,
        pctPixels300k: 40,
        pctWide16x9: 40,
        pctBroken: 20,
        medianWidth: 1288,
        pctWidth1200OfPublisher: 50,
      },
    });
  });

  it("is all zeros / nulls for an empty sample", () => {
    expect(summarize([])).toEqual({
      sampled: 0,
      og: { pctWithImage: 0, pctWidth1200: 0, pctPixels300k: 0, pctWide16x9: 0, pctBroken: 0, medianWidth: null },
      hero: {
        pctPublisherImage: 0,
        pctPlaceholder: 0,
        pctNone: 0,
        pctWidth1200: 0,
        pctPixels300k: 0,
        pctWide16x9: 0,
        pctBroken: 0,
        medianWidth: null,
        pctWidth1200OfPublisher: null,
      },
    });
  });
});

describe("upgradeHistoryRow", () => {
  it("lifts a pre-hero flat row into { og, hero: null } and leaves new rows alone", () => {
    const flat = {
      date: "2026-08-21T20:41:32.993Z",
      sampled: 120,
      pctWithImage: 98.3,
      pctWidth1200: 98.3,
      pctPixels300k: 98.3,
      pctWide16x9: 98.3,
      pctBroken: 1.7,
      medianWidth: 1200,
    };
    expect(upgradeHistoryRow(flat)).toEqual({
      date: flat.date,
      sampled: 120,
      og: {
        pctWithImage: 98.3,
        pctWidth1200: 98.3,
        pctPixels300k: 98.3,
        pctWide16x9: 98.3,
        pctBroken: 1.7,
        medianWidth: 1200,
      },
      hero: null,
    });
    const fresh = { date: "x", ...summarize([]) };
    expect(upgradeHistoryRow(fresh)).toBe(fresh);
  });
});
