import { describe, expect, it } from "vitest";
import { extractHeroImageUrls } from "@/lib/seo/warm-hero";

describe("extractHeroImageUrls", () => {
  it("returns the optimized src and every srcset candidate, entity-decoded", () => {
    const html = `
      <img alt="x" fetchPriority="high" loading="eager"
        src="/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&amp;w=1080&amp;q=75"
        srcset="/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&amp;w=640&amp;q=75 640w, /_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&amp;w=1080&amp;q=75 1080w" />`;
    expect(extractHeroImageUrls(html)).toEqual([
      "/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&w=1080&q=75",
      "/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&w=640&q=75",
    ]);
  });

  it("ignores a raw (unoptimized) hero and pages without a priority image", () => {
    expect(
      extractHeroImageUrls('<img fetchpriority="high" src="https://cdn.example/raw.jpg" />'),
    ).toEqual([]);
    expect(extractHeroImageUrls('<img loading="lazy" src="/_next/image?url=x&w=640&q=75" />')).toEqual([]);
  });
});
