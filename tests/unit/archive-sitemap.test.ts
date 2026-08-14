import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import {
  ARCHIVE_SITEMAP_MAX_ENTRIES,
  renderArchiveSitemap,
} from "@/lib/seo/archive-sitemap";

describe("renderArchiveSitemap", () => {
  it("renders a valid urlset with loc and lastmod per entry", () => {
    const xml = renderArchiveSitemap([
      { slug: "first-story-abc123", lastModifiedAt: "2026-08-01T10:00:00.000Z" },
      { slug: "second-story-def456", lastModifiedAt: "2026-08-02T11:00:00.000Z" },
    ]);
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    expect(xml).toContain(`<loc>${siteConfig.url}/story/first-story-abc123</loc>`);
    expect(xml).toContain(`<lastmod>2026-08-02T11:00:00.000Z</lastmod>`);
    expect(xml).toContain("</urlset>");
  });

  it("serves a valid empty urlset with no entries", () => {
    const xml = renderArchiveSitemap([]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("<url>");
  });

  it("deduplicates slugs and escapes XML-significant characters", () => {
    const xml = renderArchiveSitemap([
      { slug: "story-a&b", lastModifiedAt: "2026-08-01T10:00:00.000Z" },
      { slug: "story-a&b", lastModifiedAt: "2026-08-01T10:00:00.000Z" },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain("story-a&amp;b");
  });

  it("caps output at the sitemap protocol limit", () => {
    const entries = Array.from({ length: ARCHIVE_SITEMAP_MAX_ENTRIES + 10 }, (_, i) => ({
      slug: `story-${i}`,
      lastModifiedAt: "2026-08-01T10:00:00.000Z",
    }));
    const xml = renderArchiveSitemap(entries);
    expect(xml.match(/<url>/g)).toHaveLength(ARCHIVE_SITEMAP_MAX_ENTRIES);
  });
});
