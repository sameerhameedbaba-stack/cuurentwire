import { describe, expect, it, vi } from "vitest";

/**
 * An archive outage must never produce a PERMANENT "gone" signal.
 *
 * On 2026-08-21 the story archive stopped answering. Every archive read
 * caught its own failure and returned empty, so:
 *   - /archive-sitemap.xml served 200 with an empty <urlset> — a valid,
 *     cacheable statement that the site has zero permanent story URLs,
 *     where it had advertised 2,793 the day before;
 *   - 1,322 of 1,329 published /story/ URLs returned a hard 404, because
 *     "the query failed" and "no such story" were the same value by the
 *     time the page decided its status code.
 *
 * Both signals outlive the outage that caused them. These tests pin the
 * corrected contract: a read that ANSWERS may report absence; a read that
 * FAILS must say so, and the caller must emit something retriable.
 */

const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import {
  ArchiveUnavailableError,
  getArchiveBrowse,
  listArchivedStoriesForSitemap,
  looksLikePublishedStorySlug,
} from "@/lib/database/archive";
import {
  resolveStoryRequest,
  type StoryLookups,
} from "@/lib/news/story-resolution";
import type { StoryCluster } from "@/lib/news/types";

/** A db whose every query rejects — the outage under test. */
function failingDb(message = "connection terminated") {
  const boom = () => Promise.reject(new Error(message));
  const chain: Record<string, unknown> = {};
  for (const key of ["from", "where", "orderBy", "limit", "groupBy", "select"]) {
    chain[key] = () => chain;
  }
  chain.then = (resolve: unknown, reject: (e: unknown) => void) =>
    boom().catch(reject);
  return {
    select: () => chain,
    execute: boom,
  };
}

/** A db that answers every query with no rows — a genuinely empty archive. */
function emptyDb() {
  const chain: Record<string, unknown> = {};
  for (const key of ["from", "where", "orderBy", "limit", "groupBy"]) {
    chain[key] = () => chain;
  }
  chain.then = (resolve: (rows: unknown[]) => void) => Promise.resolve([]).then(resolve);
  return { select: () => chain };
}

describe("looksLikePublishedStorySlug", () => {
  // Cluster ids are `c` + 12 hex (stableId, lib/utils/text.ts). Verified
  // against all 1,660 URLs in data/url-ledger.json on 2026-08-21.
  it("accepts a real published slug", () => {
    expect(
      looksLikePublishedStorySlug(
        "woman-accused-of-plotting-major-attack-on-new-york-state-capitol-building-ca57f429ef76e",
      ),
    ).toBe(true);
  });

  it("accepts a bare cluster id (the /story/<clusterId> alias form)", () => {
    expect(looksLikePublishedStorySlug("ca57f429ef76e")).toBe(true);
  });

  it("rejects paths this site never published", () => {
    for (const junk of [
      "wp-admin",
      "does-not-exist",
      "index.php",
      "story-about-nothing",
      "ca57f429ef76", // 11 hex — one short
      "ca57f429ef76eg", // 13, not hex
      "xa57f429ef76e", // right shape, wrong prefix
      "",
    ]) {
      expect(looksLikePublishedStorySlug(junk), junk).toBe(false);
    }
  });
});

describe("archive reads distinguish absence from unavailability", () => {
  it("sitemap: no DB configured is an empty list, not an error", async () => {
    // A deployment without DATABASE_URL never promised permanence.
    getDbMock.mockReturnValue(null);
    await expect(listArchivedStoriesForSitemap()).resolves.toEqual([]);
  });

  it("sitemap: a failed query throws instead of reporting zero URLs", async () => {
    getDbMock.mockReturnValue(failingDb());
    await expect(listArchivedStoriesForSitemap()).rejects.toBeInstanceOf(
      ArchiveUnavailableError,
    );
  });

  // `/archive` is prerendered at build time, so this read must NEVER throw:
  // a build that fails while the database is down cannot ship the fix that
  // ends the outage. It degrades to an empty page instead, which advertises
  // nothing about any individual story URL.
  it("browse: a failed query degrades to empty so `next build` still succeeds", async () => {
    getDbMock.mockReturnValue(failingDb());
    await expect(getArchiveBrowse()).resolves.toEqual([]);
  });

  it("browse: a genuinely empty archive still renders", async () => {
    getDbMock.mockReturnValue(emptyDb());
    await expect(getArchiveBrowse()).resolves.toEqual([]);
  });
});

describe("resolveStoryRequest during an archive outage", () => {
  const PUBLISHED = "iran-dismisses-trumps-economic-d-day-threat-cffd4a1eecb2b";

  function lookups(over: Partial<StoryLookups> = {}): StoryLookups {
    return {
      getLive: async () => null,
      getArchived: async () => null,
      ...over,
    };
  }

  it("returns 'unavailable' for a published-looking slug", async () => {
    const resolution = await resolveStoryRequest(
      PUBLISHED,
      lookups({
        getArchived: async () => {
          throw new ArchiveUnavailableError("story lookup", new Error("timeout"));
        },
      }),
    );
    // NOT "not-found" — that is the 404 this whole change exists to prevent.
    expect(resolution.kind).toBe("unavailable");
  });

  it("still 404s junk paths, so an outage does not 5xx every scanner probe", async () => {
    const resolution = await resolveStoryRequest(
      "wp-login.php",
      lookups({
        getArchived: async () => {
          throw new ArchiveUnavailableError("story lookup", new Error("timeout"));
        },
      }),
    );
    expect(resolution.kind).toBe("not-found");
  });

  it("a live hit never consults the archive, so live stories survive an outage", async () => {
    const cluster = { id: "cffd4a1eecb2b", slug: PUBLISHED } as StoryCluster;
    const getArchived = vi.fn(async () => {
      throw new ArchiveUnavailableError("story lookup", new Error("timeout"));
    });
    const resolution = await resolveStoryRequest(
      PUBLISHED,
      lookups({ getLive: async () => cluster, getArchived }),
    );
    expect(resolution.kind).toBe("live");
    expect(getArchived).not.toHaveBeenCalled();
  });

  it("an archive that ANSWERS 'no such story' ALSO refuses to 404 a published-looking slug", async () => {
    // Premise change, 2026-08-22. This case asserted "not-found" while every
    // 5-minute refresh wrote straight through to Postgres, so an archive that
    // answered "no" had genuinely never been told about the story. Database
    // writes are now batched to ~25-30 minutes (lib/database/persist-gate.ts),
    // which opens a window where a cluster is live, already listed in
    // /news-sitemap.xml, and absent from the archive. Production on 2026-08-22
    // showed 2 of the 40 newest news-sitemap entries answering a CDN-cached
    // 404 while /story/<id-token> resolved to the same slug.
    //
    // The old expectation is not weakened here, it is wrong: the archive's
    // "no" stopped being conclusive when the writes stopped being immediate.
    const resolution = await resolveStoryRequest(PUBLISHED, lookups());
    expect(resolution.kind).toBe("unavailable");
  });

  it("404s a published-looking slug when NO archive is attached at all", async () => {
    // The bound that keeps the status code a diagnosis: a deployment without
    // a database never promised permanence and was never in the batched-write
    // window, so an unknown slug there is simply unknown. Only a deployment
    // that HAS an archive gets the benefit of the doubt above.
    const resolution = await resolveStoryRequest(PUBLISHED, {
      ...lookups(),
      hasArchive: () => false,
    });
    expect(resolution.kind).toBe("not-found");
  });

  it("still 404s a slug with no cluster-id token when the archive answers", async () => {
    // The bound on the rule above: a 5xx is only ever offered to a slug we
    // could have published. Scanner noise keeps getting a clean 404.
    const resolution = await resolveStoryRequest("wp-login.php", lookups());
    expect(resolution.kind).toBe("not-found");
  });

  it("a merge-target lookup failure keeps serving the archived copy", async () => {
    let call = 0;
    const resolution = await resolveStoryRequest(
      PUBLISHED,
      lookups({
        getArchived: async () => {
          call += 1;
          if (call === 1) {
            return {
              clusterId: "cffd4a1eecb2b",
              slug: PUBLISHED,
              mergedIntoClusterId: "c000000000001",
              summary: null,
              sources: [],
            } as never;
          }
          throw new ArchiveUnavailableError("story lookup", new Error("timeout"));
        },
      }),
    );
    // The row we already hold is enough to answer 200.
    expect(resolution.kind).toBe("archived");
  });
});
