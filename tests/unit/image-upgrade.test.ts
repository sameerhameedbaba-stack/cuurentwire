import { describe, expect, it } from "vitest";
import { upgradeImageUrl } from "@/lib/news/normalization/image-upgrade";
import { parseItems } from "@/lib/news/providers/rss";

describe("upgradeImageUrl", () => {
  it("upgrades small BBC ace/standard renditions to 976", () => {
    expect(
      upgradeImageUrl(
        "https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/50eb/live/f1f95720.jpg",
      ),
    ).toBe(
      "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/50eb/live/f1f95720.jpg",
    );
  });

  it("upgrades the BBC news/<width> variant", () => {
    expect(
      upgradeImageUrl("https://ichef.bbci.co.uk/news/240/cpsprodpb/abc.jpg"),
    ).toBe("https://ichef.bbci.co.uk/news/976/cpsprodpb/abc.jpg");
  });

  it("leaves BBC renditions at or above the target width alone", () => {
    const large =
      "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/abc.jpg";
    expect(upgradeImageUrl(large)).toBe(large);
  });

  it("rewrites CBS 60x60 signed thumbnails to the original asset", () => {
    // Live-verified 2026-08-18: swapping the size 404s (the 32-hex segment
    // signs one rendition), but dropping /thumbnail/<size>/<hex>/ serves the
    // original image on assets1/2/3.cbsnewsstatic.com.
    expect(
      upgradeImageUrl(
        "https://assets2.cbsnewsstatic.com/hub/i/r/2026/08/18/7e95546a-4955-45f4-8541-6b31f30ad0e6/thumbnail/60x60/d006f34b9787183ffa7b36998ae056e8/gettyimages-2288809425.jpg",
      ),
    ).toBe(
      "https://assets2.cbsnewsstatic.com/hub/i/r/2026/08/18/7e95546a-4955-45f4-8541-6b31f30ad0e6/gettyimages-2288809425.jpg",
    );
  });

  it("leaves card-sized CBS renditions and unexpected CBS shapes alone", () => {
    const large =
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/abc/thumbnail/1200x630/d006f34b9787183ffa7b36998ae056e8/pic.jpg";
    expect(upgradeImageUrl(large)).toBe(large);
    // No signature segment — not the verified shape, pass through untouched.
    const unsigned =
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/abc/thumbnail/60x60/pic.jpg";
    expect(upgradeImageUrl(unsigned)).toBe(unsigned);
    // CBS-lookalike path on another host stays untouched.
    const otherHost =
      "https://example.com/hub/i/r/2026/08/18/abc/thumbnail/60x60/d006f34b9787183ffa7b36998ae056e8/pic.jpg";
    expect(upgradeImageUrl(otherHost)).toBe(otherHost);
  });

  it("never touches signed Guardian URLs or unknown hosts", () => {
    const guardian =
      "https://i.guim.co.uk/img/media/0443f4/470_0_3333_2667/master/3333.jpg?width=700&quality=85&s=96de5a";
    expect(upgradeImageUrl(guardian)).toBe(guardian);
    const other = "https://example.com/ace/standard/240/photo.jpg";
    expect(upgradeImageUrl(other)).toBe(other);
    expect(upgradeImageUrl("not a url")).toBe("not a url");
  });
});

describe("numeric entity decoding in feed URLs", () => {
  it("decodes &#038; and hex entities inside item fields", () => {
    const xml = `<rss><channel><item>
      <title>WordPress feed item &#8211; with dash</title>
      <link>https://example.com/story?a=1&#038;b=2</link>
      <pubDate>Fri, 14 Aug 2026 10:00:00 GMT</pubDate>
      <media:content url="https://example.com/img.jpg?quality=65&#038;strip=all" width="800" />
    </item></channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.url).toBe("https://example.com/story?a=1&b=2");
    expect(item.imageUrl).toBe("https://example.com/img.jpg?quality=65&strip=all");
    expect(item.title).toContain("– with dash");
  });
});
