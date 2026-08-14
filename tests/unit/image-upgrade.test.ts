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
