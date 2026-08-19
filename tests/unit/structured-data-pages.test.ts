import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import {
  collectionPageSchema,
  trustPageSchema,
} from "@/lib/seo/structured-data";

/**
 * The trust pages and /topics ship JSON-LD built by these two pure functions.
 * Testing the payload (not the rendered component) keeps the test in plain
 * .ts, which is all vitest.config.ts includes, and asserts the thing that
 * actually matters: the shape Google parses.
 */
describe("trustPageSchema", () => {
  const about = trustPageSchema({
    path: "/about",
    name: "About CurrentWire",
    description: "what this site is",
    type: "AboutPage",
  });

  it("uses the requested page type and an absolute self URL", () => {
    expect(about["@type"]).toBe("AboutPage");
    expect(about.url).toBe(`${siteConfig.url}/about`);
    expect(about["@context"]).toBe("https://schema.org");
  });

  it("defaults to WebPage for the policy pages", () => {
    const methodology = trustPageSchema({
      path: "/methodology",
      name: "How CurrentWire Ranks the News",
      description: "d",
    });
    expect(methodology["@type"]).toBe("WebPage");
  });

  it("supports ContactPage", () => {
    expect(
      trustPageSchema({
        path: "/contact",
        name: "Contact CurrentWire",
        description: "d",
        type: "ContactPage",
      })["@type"],
    ).toBe("ContactPage");
  });

  it("names the publisher with a dimensioned logo", () => {
    expect(about.publisher.name).toBe(siteConfig.name);
    expect(about.publisher.logo.width).toBeGreaterThan(0);
    expect(about.publisher.logo.height).toBeGreaterThan(0);
    expect(about.publisher.logo.url).toMatch(/\/logo-600\.png$/);
  });

  it("ties the page to the same WebSite the home page declares", () => {
    expect(about.isPartOf).toEqual({
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    });
  });

  it("asserts no dates: trust pages have no honest publication timestamp", () => {
    // The site records no publish/modify date for these pages, so schema must
    // not invent one. This is the fabrication guard, not a style preference.
    expect(about).not.toHaveProperty("datePublished");
    expect(about).not.toHaveProperty("dateModified");
  });
});

describe("collectionPageSchema", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    name: `Topic ${i}`,
    url: `/topic/topic-${i}`,
  }));
  const schema = collectionPageSchema({
    path: "/topics",
    name: "Topics",
    description: "browse by topic",
    items,
  });

  it("is a CollectionPage wrapping an ItemList", () => {
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.url).toBe(`${siteConfig.url}/topics`);
    expect(schema.mainEntity["@type"]).toBe("ItemList");
  });

  it("caps the list at 30 and counts only what it emits", () => {
    // numberOfItems must match itemListElement — declaring 40 while listing
    // 30 is a small fabrication.
    expect(schema.mainEntity.itemListElement).toHaveLength(30);
    expect(schema.mainEntity.numberOfItems).toBe(30);
  });

  it("numbers positions from 1 and absolutizes relative URLs", () => {
    expect(schema.mainEntity.itemListElement[0]).toMatchObject({
      "@type": "ListItem",
      position: 1,
      name: "Topic 0",
      url: `${siteConfig.url}/topic/topic-0`,
    });
    expect(schema.mainEntity.itemListElement[29].position).toBe(30);
  });

  it("leaves already-absolute URLs alone", () => {
    const one = collectionPageSchema({
      path: "/topics",
      name: "Topics",
      description: "d",
      items: [{ name: "x", url: "https://currentwire.us/topic/x" }],
    });
    expect(one.mainEntity.itemListElement[0].url).toBe(
      "https://currentwire.us/topic/x",
    );
  });

  it("survives an empty collection", () => {
    const empty = collectionPageSchema({
      path: "/topics",
      name: "Topics",
      description: "d",
      items: [],
    });
    expect(empty.mainEntity.numberOfItems).toBe(0);
    expect(empty.mainEntity.itemListElement).toEqual([]);
  });
});
