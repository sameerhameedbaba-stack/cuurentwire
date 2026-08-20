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

  // BBC's two recipes are not interchangeable and the cheaper one depends
  // on the source format. Measured live 2026-08-21 at width 976 on 10
  // assets, bytes AND decoded pixels, ace/standard -> news:
  //   PNG  6 of 6 shrink:  447->92, 433->36, 667->81, 371->55, 929->106,
  //                        140->28 KB  (-80% to -92%, identical pixels;
  //                        the news recipe re-encodes PNG as JPEG)
  //   JPEG 4 of 4 GROW:    39->45, 137->157, 72->83, 53->63 KB (+14-19%)
  it("routes BBC PNGs through the news recipe, which re-encodes them", () => {
    expect(
      upgradeImageUrl(
        "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/f685/live/690551d0.png",
      ),
    ).toBe("https://ichef.bbci.co.uk/news/976/cpsprodpb/f685/live/690551d0.png");
  });

  it("upgrades width and swaps the recipe together for a small BBC PNG", () => {
    expect(
      upgradeImageUrl(
        "https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/318d/live/26da4630.png",
      ),
    ).toBe("https://ichef.bbci.co.uk/news/976/cpsprodpb/318d/live/26da4630.png");
  });

  it("keeps a BBC PNG already wider than the target at its own width", () => {
    // BBC picked 1024; only the recipe changes. Forcing 976 would fetch a
    // different rendition than the publisher chose for no byte saving.
    expect(
      upgradeImageUrl(
        "https://ichef.bbci.co.uk/ace/standard/1024/cpsprodpb/abc.png",
      ),
    ).toBe("https://ichef.bbci.co.uk/news/1024/cpsprodpb/abc.png");
  });

  it("leaves BBC JPEGs on ace/standard — the news recipe is 14-19% LARGER", () => {
    const jpeg =
      "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/e405/live/b1ef1300.jpg";
    expect(upgradeImageUrl(jpeg)).toBe(jpeg);
  });

  it("does not touch a BBC PNG on an unrecognised path shape", () => {
    const odd = "https://ichef.bbci.co.uk/images/ic/credit/abc.png";
    expect(upgradeImageUrl(odd)).toBe(odd);
  });

  it("rewrites CBS 60x60 signed thumbnails to a width-capped original", () => {
    // Live-verified 2026-08-18: swapping the size 404s (the 32-hex segment
    // signs one rendition), but dropping /thumbnail/<size>/<hex>/ serves the
    // original image on assets1/2/3.cbsnewsstatic.com. Live-verified
    // 2026-08-19: that original is unbounded (4,085 KB at 4896x3264) and the
    // CDN honours ?width= on it (200 KB at 976x651).
    expect(
      upgradeImageUrl(
        "https://assets2.cbsnewsstatic.com/hub/i/r/2026/08/18/7e95546a-4955-45f4-8541-6b31f30ad0e6/thumbnail/60x60/d006f34b9787183ffa7b36998ae056e8/gettyimages-2288809425.jpg",
      ),
    ).toBe(
      "https://assets2.cbsnewsstatic.com/hub/i/r/2026/08/18/7e95546a-4955-45f4-8541-6b31f30ad0e6/gettyimages-2288809425.jpg?width=976&quality=80",
    );
  });

  it("caps a CBS original that arrives with no thumbnail segment", () => {
    expect(
      upgradeImageUrl(
        "https://assets3.cbsnewsstatic.com/hub/i/r/2026/08/19/f313/ap26222696212458.jpg",
      ),
    ).toBe(
      "https://assets3.cbsnewsstatic.com/hub/i/r/2026/08/19/f313/ap26222696212458.jpg?width=976&quality=80",
    );
  });

  it("leaves card-sized CBS renditions and unexpected CBS shapes alone", () => {
    // A kept signed thumbnail is served exactly as signed — ?width= on a
    // signed rendition is unverified and the signature may bind the response.
    const large =
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/abc/thumbnail/1200x630/d006f34b9787183ffa7b36998ae056e8/pic.jpg";
    expect(upgradeImageUrl(large)).toBe(large);
    // No signature segment — not the verified shape, so the thumbnail stays
    // and no width is appended.
    const unsigned =
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/abc/thumbnail/60x60/pic.jpg";
    expect(upgradeImageUrl(unsigned)).toBe(unsigned);
    // An explicit width already on the URL is the publisher's choice.
    const widened =
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/abc/pic.jpg?width=620";
    expect(upgradeImageUrl(widened)).toBe(widened);
    // CBS-lookalike path on another host stays untouched.
    const otherHost =
      "https://example.com/hub/i/r/2026/08/18/abc/thumbnail/60x60/d006f34b9787183ffa7b36998ae056e8/pic.jpg";
    expect(upgradeImageUrl(otherHost)).toBe(otherHost);
  });

  it("downscales NPR Brightspot dims3 renditions and sets a quality", () => {
    // Live-verified 2026-08-19: the feed's own /resize/7559x5039!/ served
    // 6,366 KB; this rewrite served 84 KB at 976x651.
    expect(
      upgradeImageUrl(
        "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/7559x5039+0+0/resize/7559x5039!/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fdd%2Fgetty.jpg",
      ),
    ).toBe(
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/7559x5039+0+0/resize/976x651!/quality/80/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fdd%2Fgetty.jpg",
    );
  });

  it("leaves NPR renditions already at or under the target width alone", () => {
    const small =
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/900x600+0+0/resize/900x600!/?url=http%3A%2F%2Fx%2Fy.jpg";
    expect(upgradeImageUrl(small)).toBe(small);
    // An existing quality filter is the publisher's choice; only the size is
    // rewritten.
    const withQuality =
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3000x2000+0+0/resize/3000x2000!/quality/90/?url=http%3A%2F%2Fx%2Fy.jpg";
    expect(upgradeImageUrl(withQuality)).toBe(
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/3000x2000+0+0/resize/976x651!/quality/90/?url=http%3A%2F%2Fx%2Fy.jpg",
    );
    // Not the dims3 shape — pass through rather than guess.
    const otherShape = "https://npr.brightspotcdn.com/some/other/path.jpg";
    expect(upgradeImageUrl(otherShape)).toBe(otherShape);
  });

  it("adds a WordPress delivery width only when the feed set none", () => {
    // Live-verified 2026-08-19: 607 KB 3840x2160 -> 99 KB 976x549.
    expect(
      upgradeImageUrl(
        "https://platform.theverge.com/wp-content/uploads/sites/2/2026/06/ULT.jpg?quality=90&strip=all&crop=0,0,100,100",
      ),
    ).toBe(
      "https://platform.theverge.com/wp-content/uploads/sites/2/2026/06/ULT.jpg?quality=90&strip=all&crop=0,0,100,100&w=976",
    );
    expect(
      upgradeImageUrl("https://globalnews.ca/wp-content/uploads/2026/08/p.jpg"),
    ).toBe("https://globalnews.ca/wp-content/uploads/2026/08/p.jpg?w=976");
    // The Hill's feed already ships ?w=900 — that is the publisher's own
    // rendition choice and forcing it wider would fetch MORE bytes.
    const hill =
      "https://thehill.com/wp-content/uploads/sites/2/2026/08/AP26.jpg?w=900";
    expect(upgradeImageUrl(hill)).toBe(hill);
    // Not an uploads path on a listed host — untouched.
    const nonUpload = "https://globalnews.ca/assets/logo.jpg";
    expect(upgradeImageUrl(nonUpload)).toBe(nonUpload);
  });

  it("drops formats no CDN resizes and no browser should download", () => {
    // globalnews.ca/.../Classroom.bmp was live on /health at 6,221 KB and
    // WordPress's ?w= resizer ignores it — there is no lever but omission.
    expect(
      upgradeImageUrl(
        "https://globalnews.ca/wp-content/uploads/2025/12/Classroom.bmp",
      ),
    ).toBeUndefined();
    expect(
      upgradeImageUrl("https://example.com/a.tiff?quality=65"),
    ).toBeUndefined();
    expect(upgradeImageUrl("https://example.com/a.tif")).toBeUndefined();
    // A .bmp inside a query value is not the delivered format.
    const notBmp = "https://example.com/photo.jpg?ref=old.bmp";
    expect(upgradeImageUrl(notBmp)).toBe(notBmp);
  });

  it("never touches signed Guardian URLs, Politico, or unknown hosts", () => {
    const guardian =
      "https://i.guim.co.uk/img/media/0443f4/470_0_3333_2667/master/3333.jpg?width=700&quality=85&s=96de5a";
    expect(upgradeImageUrl(guardian)).toBe(guardian);
    // static.politico.com is a plain Cloudflare passthrough — every resize
    // parameter tried on 2026-08-19 returned the identical 4,944,055 bytes.
    const politico =
      "https://static.politico.com/68/6d/8f02/election-2-26-south-carolina.jpg";
    expect(upgradeImageUrl(politico)).toBe(politico);
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
