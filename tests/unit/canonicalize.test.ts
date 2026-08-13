import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  domainFromUrl,
  isSafeExternalUrl,
} from "@/lib/news/normalization/canonicalize";

describe("canonicalizeUrl", () => {
  it("strips tracking parameters", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/story?utm_source=x&utm_medium=social&id=7",
      ),
    ).toBe("https://example.com/story?id=7");
  });

  it("normalizes www, protocol, hash and trailing slash", () => {
    expect(canonicalizeUrl("http://www.Example.com/path/#section")).toBe(
      "https://example.com/path",
    );
  });

  it("treats equivalent URLs identically", () => {
    const a = canonicalizeUrl("https://www.example.com/a?fbclid=123");
    const b = canonicalizeUrl("http://example.com/a#top");
    expect(a).toBe(b);
  });

  it("rejects non-http(s) and malformed URLs", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("ftp://example.com/file")).toBeNull();
    expect(canonicalizeUrl("not a url")).toBeNull();
  });
});

describe("isSafeExternalUrl", () => {
  it("allows only http and https", () => {
    expect(isSafeExternalUrl("https://example.com")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,x")).toBe(false);
  });
});

describe("domainFromUrl", () => {
  it("extracts host without www", () => {
    expect(domainFromUrl("https://www.cbc.ca/news/story")).toBe("cbc.ca");
  });
});
