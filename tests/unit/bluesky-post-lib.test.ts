import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLUSTER_ID_RE,
  dedupKey,
  headlineAlreadyPosted,
  headlineKey,
} from "../../scripts/bluesky-post-lib.mjs";

/**
 * The poster shares at most one story per run and skips anything already in its
 * own feed. That ledger used to be keyed by URL, which is not the story's
 * identity: the slug is derived from the headline, and headlines are rewritten
 * as coverage develops.
 */
describe("dedupKey", () => {
  it("gives one story one key across a headline rewrite", () => {
    // THE DEFECT, from the live account on 2026-09-03: these two posts, five
    // hours apart, are the same death of the same person.
    const first =
      "https://currentwire.us/story/gloria-steinem-trailblazing-journalist-and-activist-dies-at-92-c6f6dcadc62b0";
    const second = "https://currentwire.us/story/feminist-icon-gloria-steinem-dies-at-92-c6f6dcadc62b0";
    expect(dedupKey(first)).toBe(dedupKey(second));
    expect(dedupKey(first)).toBe("c6f6dcadc62b0");
  });

  it("keeps genuinely different stories apart", () => {
    // The failure mode in the other direction: over-matching would silence the
    // feed, which is worse than a duplicate.
    const a = "https://currentwire.us/story/feminist-icon-gloria-steinem-dies-at-92-c6f6dcadc62b0";
    const b =
      "https://currentwire.us/story/ice-agent-charged-with-lying-about-shooting-venezuelan-man-during-crackdown-c60fcfd4f0b1c";
    expect(dedupKey(a)).not.toBe(dedupKey(b));
  });

  it("ignores a trailing slash and id casing", () => {
    const bare = "https://currentwire.us/story/some-headline-c6f6dcadc62b0";
    expect(dedupKey(`${bare}/`)).toBe(dedupKey(bare));
    expect(dedupKey("https://currentwire.us/story/some-headline-C6F6DCADC62B0")).toBe(dedupKey(bare));
  });

  it("falls back to the normalised URL when there is no cluster id", () => {
    // A URL with no well-formed token was never one of our story URLs, so it
    // keeps the previous behaviour rather than collapsing into a shared key.
    expect(dedupKey("https://currentwire.us/sports")).toBe("https://currentwire.us/sports");
    expect(dedupKey("https://currentwire.us/sports/")).toBe("https://currentwire.us/sports");
    expect(dedupKey("https://example.com/a-b-notacluster")).toBe("https://example.com/a-b-notacluster");
    expect(dedupKey(undefined)).toBe("");
  });

  it("mirrors CLUSTER_ID_RE from lib/database/archive.ts", () => {
    // The poster runs under plain node in CI and cannot import the TypeScript
    // module, so the pattern is copied. This is what stops the copy rotting:
    // the archive's version was verified against all 1,660 ledger URLs.
    const archive = readFileSync(new URL("../../lib/database/archive.ts", import.meta.url), "utf8");
    const match = archive.match(/^const CLUSTER_ID_RE = (.+);$/m);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(String(CLUSTER_ID_RE));
  });
});

/**
 * Keying on the cluster id assumed one story is one cluster. On 2026-09-05 the
 * archive opened two clusters five minutes apart for one event and the poster
 * shared both, two hours apart, with byte-identical text. The headline is the
 * signal that catches it.
 */
describe("headlineAlreadyPosted", () => {
  // THE DEFECT, from the live account on 2026-09-05: cfd84c3e6f25d at 15:21Z
  // and ceee985710f14 at 17:25Z. Different cluster ids, one event.
  const TANKERS = "US hits three Iranian oil tankers after saying its warships were targeted";

  it("catches one event published under two cluster ids", () => {
    const first = `https://currentwire.us/story/us-hits-three-iranian-oil-tankers-after-saying-its-warships-were-targeted-cfd84c3e6f25d`;
    const second = `https://currentwire.us/story/us-hits-three-iranian-oil-tankers-after-saying-its-warships-were-targeted-ceee985710f14`;
    // The id key cannot see it — that is why the headline key exists.
    expect(dedupKey(first)).not.toBe(dedupKey(second));
    expect(headlineAlreadyPosted([TANKERS], TANKERS)).toBe(true);
  });

  it("does not skip a genuinely different story on the same subject", () => {
    // Also live, 2026-09-06: two real developments in one diplomatic story.
    // Different headlines are different stories and must both post.
    expect(
      headlineAlreadyPosted(
        ["US envoys meet Putin in Moscow for Ukraine talks"],
        "US envoys meet Zelensky in Ukraine after talks with Putin in Russia",
      ),
    ).toBe(false);
  });

  it("matches a stored post that the 280-char limit truncated", () => {
    const stored = "Depleted strategic oil reserve nears level that raises concerns about…";
    const full =
      "Depleted strategic oil reserve nears level that raises concerns about damage to caverns, operations";
    expect(headlineAlreadyPosted([stored], full)).toBe(true);
  });

  it("does not let a truncated prefix swallow an unrelated story", () => {
    const stored = "Trump says…";
    expect(headlineAlreadyPosted([stored], "Biden says he will not run again")).toBe(false);
  });

  it("ignores case and whitespace differences only", () => {
    expect(headlineKey("  US  Hits Three   Tankers ")).toBe("us hits three tankers");
    expect(headlineAlreadyPosted(["US Hits Three Tankers"], "us hits three tankers")).toBe(true);
  });

  it("treats an empty or missing headline as not posted", () => {
    expect(headlineAlreadyPosted(["something"], "")).toBe(false);
    expect(headlineAlreadyPosted([""], "something")).toBe(false);
    expect(headlineAlreadyPosted(undefined, "something")).toBe(false);
  });
});
