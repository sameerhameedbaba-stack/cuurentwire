import { PgDialect } from "drizzle-orm/pg-core";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked db layer — these tests never require a real Postgres. getDb is
// swapped per-test: null (unconfigured), a failing chain, or a fake that
// answers with canned rows.
const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import { GET } from "@/app/api/stats/archive-sources/route";
import { ArchiveUnavailableError } from "@/lib/database/archive";
import {
  ARCHIVE_SOURCES_DEFAULT_LIMIT,
  archiveSourcesAggregates,
  getArchiveSources,
  mapArchiveSourcesRow,
  parseArchiveSourcesInstant,
  parseArchiveSourcesParams,
  type ArchiveSourcesDbRow,
} from "@/lib/database/archive-sources";
import {
  bucket,
  compareSample,
  decodeEntities,
  fetchAllRows,
  maxCoverage,
  mulberry32,
  parseArgs,
  parseRenderedPublications,
  pickSample,
  summarize,
} from "../../scripts/audit-archive-unions.mjs";

const ID_A = "c0123456789ab";
const ID_B = "cfedcba987654";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

/** A db whose every query rejects — the outage under test. */
function failingDb(message = "connection terminated") {
  const boom = () => Promise.reject(new Error(message));
  const chain: Record<string, unknown> = {};
  for (const key of ["from", "where", "orderBy", "limit", "offset", "select"]) {
    chain[key] = () => chain;
  }
  chain.then = (resolve: unknown, reject: (e: unknown) => void) => boom().catch(reject);
  return { select: () => chain, execute: boom };
}

/**
 * A db that answers the schema probes (history column present) and every
 * select with the given rows. Records the calls so a test can check which
 * chain methods ran (limit/offset for range mode, none for ids mode).
 */
function rowsDb(rows: unknown[], calls: string[] = []) {
  const chain: Record<string, unknown> = {};
  for (const key of ["from", "where", "orderBy", "limit", "offset"]) {
    chain[key] = () => {
      calls.push(key);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(rows).then(resolve);
  return {
    select: () => {
      calls.push("select");
      return chain;
    },
    execute: async () => ({ rows: [{ ok: 1 }] }),
  };
}

function dbRow(overrides: Partial<ArchiveSourcesDbRow> = {}): ArchiveSourcesDbRow {
  return {
    clusterId: ID_A,
    slug: `senate-passes-rail-safety-bill-${ID_A}`,
    firstSeenAt: new Date("2026-08-12T14:00:00.000Z"),
    sourceCount: 1,
    unionSources: 3,
    unionPublications: 2,
    peakHistoryCoverage: 2,
    historyEvents: 4,
    stamped: true,
    merged: false,
    ...overrides,
  };
}

beforeEach(() => {
  getDbMock.mockReset();
  getDbMock.mockReturnValue(null);
});

describe("parseArchiveSourcesInstant", () => {
  it("takes YYYY-MM-DD as midnight UTC and normalises ISO datetimes", () => {
    expect(parseArchiveSourcesInstant("2026-08-10")).toBe("2026-08-10T00:00:00.000Z");
    expect(parseArchiveSourcesInstant("2026-08-10T04:00:00Z")).toBe("2026-08-10T04:00:00.000Z");
    expect(parseArchiveSourcesInstant("2026-08-10T00:00:00-04:00")).toBe(
      "2026-08-10T04:00:00.000Z",
    );
  });

  it("rejects anything that is not one of the two shapes or not a real instant", () => {
    for (const bad of ["", "yesterday", "2026-13-45", "20260810", "2026-08-10 04:00:00", "1723000000"]) {
      expect(parseArchiveSourcesInstant(bad)).toBeNull();
    }
  });
});

describe("parseArchiveSourcesParams", () => {
  it("accepts a comma-separated id list, trimmed and de-duplicated", () => {
    const parsed = parseArchiveSourcesParams(params(`ids=${ID_A}, ${ID_B},${ID_A}`));
    expect(parsed).toEqual({ ok: true, query: { mode: "ids", ids: [ID_A, ID_B] } });
  });

  it("rejects malformed ids, an empty list and more than 500 ids", () => {
    expect(parseArchiveSourcesParams(params("ids=not-an-id")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params(`ids=${ID_A},C0123456789AB`)).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("ids=")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("ids=,,")).ok).toBe(false);
    const tooMany = Array.from(
      { length: 501 },
      (_, i) => `c${i.toString(16).padStart(12, "0")}`,
    ).join(",");
    expect(parseArchiveSourcesParams(params(`ids=${tooMany}`)).ok).toBe(false);
    const justEnough = Array.from(
      { length: 500 },
      (_, i) => `c${i.toString(16).padStart(12, "0")}`,
    ).join(",");
    expect(parseArchiveSourcesParams(params(`ids=${justEnough}`)).ok).toBe(true);
  });

  it("accepts a [from, to) range with default limit/offset", () => {
    const parsed = parseArchiveSourcesParams(
      params("from=2026-08-10T04:00:00Z&to=2026-08-17T04:00:00Z"),
    );
    expect(parsed).toEqual({
      ok: true,
      query: {
        mode: "range",
        from: "2026-08-10T04:00:00.000Z",
        to: "2026-08-17T04:00:00.000Z",
        limit: ARCHIVE_SOURCES_DEFAULT_LIMIT,
        offset: 0,
      },
    });
  });

  it("accepts date-only bounds and explicit limit/offset", () => {
    const parsed = parseArchiveSourcesParams(
      params("from=2026-08-10&to=2026-08-11&limit=2000&offset=1000"),
    );
    expect(parsed).toEqual({
      ok: true,
      query: {
        mode: "range",
        from: "2026-08-10T00:00:00.000Z",
        to: "2026-08-11T00:00:00.000Z",
        limit: 2000,
        offset: 1000,
      },
    });
  });

  it("rejects ranges that are inverted, empty, longer than 9 days or half-specified", () => {
    expect(parseArchiveSourcesParams(params("from=2026-08-17&to=2026-08-10")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("from=2026-08-10&to=2026-08-10")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("from=2026-08-10&to=2026-08-19T00:00:01Z")).ok).toBe(
      false,
    );
    // Exactly 9 days is the inclusive maximum.
    expect(parseArchiveSourcesParams(params("from=2026-08-10&to=2026-08-19")).ok).toBe(true);
    expect(parseArchiveSourcesParams(params("from=2026-08-10")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("to=2026-08-10")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("from=soon&to=2026-08-10")).ok).toBe(false);
  });

  it("rejects out-of-range or non-integer limit/offset", () => {
    const range = "from=2026-08-10&to=2026-08-11";
    for (const bad of ["limit=0", "limit=2001", "limit=10.5", "limit=abc", "offset=-1", "offset=x"]) {
      expect(parseArchiveSourcesParams(params(`${range}&${bad}`)).ok).toBe(false);
    }
    expect(parseArchiveSourcesParams(params(`${range}&limit=1&offset=0`)).ok).toBe(true);
  });

  it("rejects mixing ids with from/to, and the absence of both", () => {
    expect(parseArchiveSourcesParams(params(`ids=${ID_A}&from=2026-08-10`)).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("")).ok).toBe(false);
    expect(parseArchiveSourcesParams(params("limit=5")).ok).toBe(false);
  });
});

describe("archiveSourcesAggregates", () => {
  it("aggregates the jsonb in SQL (elements subselects), with the history column guarded", () => {
    const dialect = new PgDialect();
    const withHistory = archiveSourcesAggregates(true);
    const union = dialect.sqlToQuery(withHistory.unionPublications);
    expect(union.sql).toContain("count(distinct nullif(btrim(s->>'name'), ''))");
    expect(union.sql).toContain("jsonb_array_elements(");
    expect(union.sql).toMatch(/jsonb_typeof\("[a-z_".]*sources"\) = 'array'/);
    expect(union.params).toEqual([]);

    const stamped = dialect.sqlToQuery(withHistory.stamped);
    expect(stamped.sql).toContain("s ? 'firstSeenAt'");

    const peak = dialect.sqlToQuery(withHistory.peakHistoryCoverage);
    expect(peak.sql).toContain("e->>'kind' = 'coverage_change'");
    expect(peak.sql).toContain("max(greatest(");
    expect(peak.sql).toMatch(/jsonb_typeof\("[a-z_".]*history"\) = 'array'/);
    // The from/to keys are bound parameters, never interpolated text.
    expect(peak.params).toEqual(["from", "from", "to", "to"]);

    const events = dialect.sqlToQuery(withHistory.historyEvents);
    expect(events.sql).toMatch(/jsonb_array_length\(.*history.*\)::int/);
  });

  it("never references the history column before the runtime migration ran", () => {
    const dialect = new PgDialect();
    const without = archiveSourcesAggregates(false);
    expect(dialect.sqlToQuery(without.peakHistoryCoverage).sql).toBe("null::int");
    expect(dialect.sqlToQuery(without.historyEvents).sql).toBe("0::int");
    expect(dialect.sqlToQuery(without.unionSources).sql).not.toContain("history");
  });
});

describe("mapArchiveSourcesRow", () => {
  it("maps driver rows to the API shape (ISO dates, numbers, booleans)", () => {
    expect(mapArchiveSourcesRow(dbRow())).toEqual({
      id: ID_A,
      slug: `senate-passes-rail-safety-bill-${ID_A}`,
      firstSeenAt: "2026-08-12T14:00:00.000Z",
      sourceCount: 1,
      unionSources: 3,
      unionPublications: 2,
      peakHistoryCoverage: 2,
      historyEvents: 4,
      stamped: true,
      merged: false,
    });
  });

  it("coerces stringly numbers and keeps a null peak null", () => {
    const mapped = mapArchiveSourcesRow(
      dbRow({
        firstSeenAt: "2026-08-12T14:00:00.000Z",
        sourceCount: "3",
        unionSources: "5",
        unionPublications: "4",
        peakHistoryCoverage: null,
        historyEvents: null,
        stamped: null,
        merged: null,
      }),
    );
    expect(mapped.sourceCount).toBe(3);
    expect(mapped.unionSources).toBe(5);
    expect(mapped.unionPublications).toBe(4);
    expect(mapped.peakHistoryCoverage).toBeNull();
    expect(mapped.historyEvents).toBe(0);
    expect(mapped.stamped).toBe(false);
    expect(mapped.merged).toBe(false);
    expect(mapped.firstSeenAt).toBe("2026-08-12T14:00:00.000Z");
  });
});

describe("getArchiveSources", () => {
  it("answers empty without a database", async () => {
    await expect(getArchiveSources({ mode: "ids", ids: [ID_A] })).resolves.toEqual({
      rows: [],
      truncated: false,
    });
  });

  it("throws ArchiveUnavailableError when the query fails", async () => {
    getDbMock.mockReturnValue(failingDb());
    await expect(getArchiveSources({ mode: "ids", ids: [ID_A] })).rejects.toBeInstanceOf(
      ArchiveUnavailableError,
    );
  });

  it("pages range mode with limit+1 and reports truncation exactly", async () => {
    const calls: string[] = [];
    // The fake returns limit+1 rows: the extra one is the truncation probe.
    getDbMock.mockReturnValue(rowsDb([dbRow(), dbRow({ clusterId: ID_B }), dbRow()], calls));
    const result = await getArchiveSources({
      mode: "range",
      from: "2026-08-10T04:00:00.000Z",
      to: "2026-08-17T04:00:00.000Z",
      limit: 2,
      offset: 0,
    });
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].id).toBe(ID_B);
    expect(calls).toEqual(["select", "from", "where", "orderBy", "limit", "offset"]);
  });

  it("ids mode never paginates and is never truncated", async () => {
    const calls: string[] = [];
    getDbMock.mockReturnValue(rowsDb([dbRow()], calls));
    const result = await getArchiveSources({ mode: "ids", ids: [ID_A] });
    expect(result).toEqual({ rows: [mapArchiveSourcesRow(dbRow())], truncated: false });
    expect(calls).toEqual(["select", "from", "where", "orderBy"]);
  });
});

describe("GET /api/stats/archive-sources", () => {
  const request = (query: string) =>
    new NextRequest(`http://localhost:3000/api/stats/archive-sources?${query}`);

  it("answers 400, uncached, for bad params", async () => {
    const res = await GET(request("ids=nope"));
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("answers 200 with empty rows and the mode when no database is configured", async () => {
    const res = await GET(request("from=2026-08-10&to=2026-08-17"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    const body = await res.json();
    expect(body.mode).toBe("range");
    expect(body.rows).toEqual([]);
    expect(body.truncated).toBe(false);
    expect(body.note).toBe("aggregate statistics only");
    expect(typeof body.generatedAt).toBe("string");
  });

  it("answers 503, uncached, when the archive does not answer — never an empty 200", async () => {
    getDbMock.mockReturnValue(failingDb());
    const res = await GET(request(`ids=${ID_A}`));
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.error).toBe("archive temporarily unavailable");
    expect(body.rows).toBeUndefined();
  });

  it("returns aggregate rows only — no URLs, titles or names", async () => {
    getDbMock.mockReturnValue(rowsDb([dbRow()]));
    const res = await GET(request(`ids=${ID_A}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("ids");
    expect(body.rows).toEqual([mapArchiveSourcesRow(dbRow())]);
    expect(Object.keys(body.rows[0]).sort()).toEqual(
      [
        "firstSeenAt",
        "historyEvents",
        "id",
        "merged",
        "peakHistoryCoverage",
        "slug",
        "sourceCount",
        "stamped",
        "unionPublications",
        "unionSources",
      ].sort(),
    );
  });
});

// ── scripts/audit-archive-unions.mjs pure helpers ──────────────────────────

type AuditRow = {
  id: string;
  slug: string;
  firstSeenAt: string;
  sourceCount: number;
  unionSources: number;
  unionPublications: number;
  peakHistoryCoverage: number | null;
  historyEvents: number;
  stamped: boolean;
  merged: boolean;
};

function auditRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: ID_A,
    slug: `story-${ID_A}`,
    firstSeenAt: "2026-08-12T14:00:00.000Z",
    sourceCount: 1,
    unionSources: 1,
    unionPublications: 1,
    peakHistoryCoverage: null,
    historyEvents: 0,
    stamped: true,
    merged: false,
    ...overrides,
  };
}

describe("audit script: parseArgs", () => {
  it("defaults to the 2026-W33 Eastern week against production", () => {
    expect(parseArgs([])).toEqual({
      base: "https://currentwire.us",
      from: "2026-08-10T04:00:00Z",
      to: "2026-08-17T04:00:00Z",
      sample: 60,
      seed: 2026,
    });
  });

  it("reads overrides and strips a trailing slash from --base", () => {
    expect(
      parseArgs(["--base", "http://localhost:3000/", "--from", "2026-08-17", "--to", "2026-08-24", "--sample", "10", "--seed", "7"]),
    ).toEqual({
      base: "http://localhost:3000",
      from: "2026-08-17",
      to: "2026-08-24",
      sample: 10,
      seed: 7,
    });
    expect(parseArgs(["--sample", "-3"]).sample).toBe(60);
  });
});

describe("audit script: summarize", () => {
  const rows: AuditRow[] = [
    auditRow({ id: "c000000000001", slug: "one", sourceCount: 1, unionPublications: 1 }),
    auditRow({
      id: "c000000000002",
      slug: "two",
      sourceCount: 1,
      unionPublications: 3,
      peakHistoryCoverage: 2,
      historyEvents: 3,
    }),
    auditRow({
      id: "c000000000003",
      slug: "three",
      sourceCount: 2,
      unionPublications: 2,
      peakHistoryCoverage: 4,
    }),
    auditRow({ id: "c000000000004", slug: "four", sourceCount: 5, unionPublications: 5, stamped: false }),
    auditRow({ id: "c000000000005", slug: "merged", sourceCount: 9, unionPublications: 9, merged: true }),
  ];

  it("excludes merged rows and computes every distribution and share", () => {
    const s = summarize(rows);
    expect(s.totalRows).toBe(4);
    expect(s.mergedExcluded).toBe(1);
    expect(s.sourceCountDistribution).toEqual({ "1": 2, "2": 1, "4+": 1 });
    expect(s.unionPublicationsDistribution).toEqual({ "1": 1, "2": 1, "3": 1, "4+": 1 });
    expect(s.peakHistoryCoverageDistribution).toEqual({ null: 2, "2": 1, "4+": 1 });
    expect(s.stamped).toEqual({ count: 3, pct: 75 });
    expect(s.unionAboveActive).toEqual({ count: 1, pct: 25 });
    expect(s.peakAboveActive).toEqual({ count: 2, pct: 50 });
    expect(s.multiSource.bySourceCount).toEqual({ count: 2, pct: 50 });
    expect(s.multiSource.byUnionPublications).toEqual({ count: 3, pct: 75 });
    expect(s.multiSource.byMax).toEqual({ count: 3, pct: 75 });
    expect(s.mismatchCount).toBe(2);
    expect(s.mismatches).toEqual([
      { slug: "two", sourceCount: 1, unionPublications: 3, peakHistoryCoverage: 2 },
      { slug: "three", sourceCount: 2, unionPublications: 2, peakHistoryCoverage: 4 },
    ]);
  });

  it("bucket and maxCoverage follow the 1/2/3/4+ and null rules", () => {
    expect([bucket(0), bucket(1), bucket(2), bucket(3), bucket(4), bucket(17), bucket(null)]).toEqual(
      ["0", "1", "2", "3", "4+", "4+", "null"],
    );
    expect(maxCoverage(auditRow({ sourceCount: 1, unionPublications: 2, peakHistoryCoverage: null }))).toBe(2);
    expect(maxCoverage(auditRow({ sourceCount: 1, unionPublications: 2, peakHistoryCoverage: 6 }))).toBe(6);
  });
});

describe("audit script: pickSample", () => {
  const rows: AuditRow[] = [
    ...Array.from({ length: 10 }, (_, i) =>
      auditRow({ id: `cmulti000000${i}`, slug: `multi-${i}`, unionPublications: 2 + i }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      auditRow({ id: `csingle00000${i}`, slug: `single-${i}`, unionPublications: 1 }),
    ),
    auditRow({ id: "cmerged000000", slug: "merged", unionPublications: 7, merged: true }),
  ];

  it("takes up to N/2 multi rows then fills with singles, never merged, deterministically", () => {
    const a = pickSample(rows, 8, mulberry32(1));
    const b = pickSample(rows, 8, mulberry32(1));
    expect(a.map((r: AuditRow) => r.slug)).toEqual(b.map((r: AuditRow) => r.slug));
    expect(a).toHaveLength(8);
    expect(a.filter((r: AuditRow) => r.unionPublications >= 2)).toHaveLength(4);
    expect(a.filter((r: AuditRow) => r.unionPublications < 2)).toHaveLength(4);
    expect(a.some((r: AuditRow) => r.merged)).toBe(false);
  });

  it("tops up with more multi rows when singles run out", () => {
    // 10 multi + 3 singles, n=12: 6 multi, all 3 singles, then 3 more multi.
    const scarce = rows.filter((r) => r.unionPublications >= 2 || r.slug < "single-3");
    const picked = pickSample(scarce, 12, mulberry32(3));
    expect(picked).toHaveLength(12);
    expect(picked.filter((r: AuditRow) => r.unionPublications < 2)).toHaveLength(3);
    expect(picked.filter((r: AuditRow) => r.unionPublications >= 2)).toHaveLength(9);
    expect(new Set(picked.map((r: AuditRow) => r.slug)).size).toBe(12);
  });
});

describe("audit script: parseRenderedPublications", () => {
  // Mirrors the live markup inspected on 2026-08-22 (see the script header).
  const livePage = `
<section aria-label="Coverage at a glance" class="mt-3"><h2 class="x">Coverage at a glance</h2><ul class="mt-1 space-y-0.5"><li><span class="font-semibold text-ink">First observed by CurrentWire<!-- -->:</span> <!-- -->NBC News · Aug 21, 2026 at 2:15 PM ET</li><li><span class="font-semibold text-ink">Coverage<!-- -->:</span> <!-- -->16 reports from 14 independent publications</li></ul></section>
<div class="mt-5"><h3 class="x">All-time coverage</h3><p class="mt-1 text-sm leading-snug">3<!-- --> publications have covered this story since CurrentWire first saw it: <!-- -->BBC News, Barron&#x27;s, Global News<!-- -->.</p></div>
<div class="mt-10"><section aria-labelledby="coverage-heading"><h2 id="coverage-heading" class="headline">Coverage</h2><p class="text-sm text-muted">3 reports from 2 publications.</p><ul class="mt-4 divide-y divide-rule"><li class="py-3"><p class="text-xs font-bold uppercase tracking-[0.1em] text-muted">BBC News<span class="ml-2 rounded-news">Tier <!-- -->A</span></p><a href="https://example.com/a">x</a></li><li class="py-3"><p class="text-xs font-bold uppercase tracking-[0.1em] text-muted">Barron&#x27;s<span class="ml-2 rounded-news">Tier <!-- -->B</span></p></li><li class="py-3"><p class="text-xs font-bold uppercase tracking-[0.1em] text-muted">BBC News<span class="ml-2 rounded-news">Tier <!-- -->A</span></p></li></ul></section></div>`;

  it("reads the coverage list, its header, the all-time block and the glance line", () => {
    const parsed = parseRenderedPublications(livePage);
    expect(parsed.coverageListFound).toBe(true);
    expect(parsed.coverageListNames).toEqual(["BBC News", "Barron's", "BBC News"]);
    expect(parsed.coverageListDistinct).toBe(2);
    expect(parsed.headerPublications).toBe(2);
    expect(parsed.allTimeCount).toBe(3);
    expect(parsed.allTimeNames).toEqual(["BBC News", "Barron's", "Global News"]);
    expect(parsed.glance).toEqual({ reports: 16, publications: 14 });
    // The union the page renders is the larger of list and all-time.
    expect(parsed.renderedPublications).toBe(3);
  });

  it("handles the single-publication and archived shapes (no all-time block)", () => {
    const single = `<section aria-labelledby="coverage-heading"><h2>Coverage</h2><p class="text-sm text-muted">1 publication is covering this story.</p><ul><li class="py-3"><p class="text-xs">NPR<span class="y">Tier <!-- -->A</span></p></li></ul></section>`;
    const parsed = parseRenderedPublications(single);
    expect(parsed.headerPublications).toBe(1);
    expect(parsed.coverageListDistinct).toBe(1);
    expect(parsed.allTimeCount).toBeNull();
    expect(parsed.glance).toBeNull();
    expect(parsed.renderedPublications).toBe(1);

    const covering = `<section aria-labelledby="coverage-heading"><p class="text-sm text-muted">4 publications are covering this story.</p><ul></ul></section>`;
    expect(parseRenderedPublications(covering).headerPublications).toBe(4);
  });

  it("reports nulls for a page without any coverage markup", () => {
    const parsed = parseRenderedPublications("<html><body>nothing here</body></html>");
    expect(parsed.coverageListFound).toBe(false);
    expect(parsed.renderedPublications).toBeNull();
  });

  it("decodes the entities React emits in names", () => {
    expect(decodeEntities("Barron&#x27;s &amp; Co &quot;Daily&quot; &#169;")).toBe(
      `Barron's & Co "Daily" ©`,
    );
  });
});

describe("audit script: compareSample", () => {
  it("classifies match / more / fewer / unparsed", () => {
    const row = auditRow({ unionPublications: 3 });
    const parsed = (rendered: number | null) => ({
      coverageListDistinct: rendered,
      headerPublications: rendered,
      allTimeCount: null,
      glance: null,
      renderedPublications: rendered,
    });
    expect(compareSample(row, parsed(3)).relation).toBe("match");
    expect(compareSample(row, parsed(4)).relation).toBe("page-renders-more");
    expect(compareSample(row, parsed(2)).relation).toBe("page-renders-fewer");
    expect(compareSample(row, parsed(null)).relation).toBe("unparsed");
  });
});

describe("audit script: fetchAllRows", () => {
  it("pages with limit 1000 + offset until the endpoint stops truncating", async () => {
    const urls: string[] = [];
    const pageA = Array.from({ length: 1000 }, (_, i) => auditRow({ id: `c${String(i).padStart(12, "0")}` }));
    const pageB = [auditRow({ id: "cfinal0000000" })];
    const fakeFetch = async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get("offset"));
      const body = offset === 0 ? { rows: pageA, truncated: true } : { rows: pageB, truncated: false };
      return {
        status: 200,
        json: async () => body,
      };
    };
    const result = await fetchAllRows(
      "https://example.test",
      "2026-08-10T04:00:00Z",
      "2026-08-17T04:00:00Z",
      fakeFetch as unknown as typeof fetch,
    );
    expect(result.pages).toBe(2);
    expect(result.rows).toHaveLength(1001);
    expect(urls[0]).toBe(
      "https://example.test/api/stats/archive-sources?from=2026-08-10T04%3A00%3A00Z&to=2026-08-17T04%3A00%3A00Z&limit=1000&offset=0",
    );
    expect(new URL(urls[1]).searchParams.get("offset")).toBe("1000");
  });

  it("throws EndpointUnreachableError on a network failure or non-200", async () => {
    const networkDown = (async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;
    await expect(
      fetchAllRows("https://nonexistent.invalid", "2026-08-10", "2026-08-17", networkDown),
    ).rejects.toMatchObject({ name: "EndpointUnreachableError" });
    const fiveOhThree = (async () => ({
      status: 503,
      json: async () => ({ error: "x" }),
    })) as unknown as typeof fetch;
    await expect(
      fetchAllRows("https://example.test", "2026-08-10", "2026-08-17", fiveOhThree),
    ).rejects.toMatchObject({ name: "EndpointUnreachableError" });
  });
});
