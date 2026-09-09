# A shield scoped to a window has no expiry, so its 5xx is permanent

**2026-09-09.** Four `/story/` URLs answered a retriable 500 for at least
eleven hours. Nothing was down. The archive answered `200` with zero rows for
all four ids on `/api/stats/archive-sources`; `seo-health.mjs` passed 24/24;
the news-sitemap write heartbeat was thirteen minutes old; all 743
news-sitemap URLs answered 200. The site was healthy and four of its own
published URLs were permanently broken at the same time.

The mechanism is the shield in `lib/news/story-resolution.ts`. When the
archive says "no such story" for a slug carrying a real cluster-id token, the
route answers `unavailable` (500) rather than 404, because database writes are
batched to ~25-30 minutes (`lib/database/persist-gate.ts`) and a story can be
live, advertised in the news sitemap, and genuinely absent from the archive
inside that window. A 404 is the one answer that cannot be taken back, so the
retriable status is right — **for the window**.

But the shield has no clock in it. It cannot distinguish "absent for four
minutes" from "absent for eleven hours" from "absent forever", so a story that
falls out of the window keeps drawing the same answer until a human writes its
id into `data/lost-stories.json`. The remedy is manual by construction, and it
had been used once before, for a different cause, after the August outage.

## Rules this leaves behind

- **A guard justified by a time window needs the window in it.** "This state
  is temporary" is an assumption about elapsed time; if the code never reads a
  clock, the assumption is never checked and the temporary answer is the
  permanent one. Ask of any shield: what makes it stop?
- **A healthy site can be serving permanent 5xx.** Every green check here
  measured aggregates or samples of what the site currently advertises. These
  four URLs had already left both sitemaps, so no sitemap-derived probe could
  ever have found them. Only the ledger of what was *once* published did — and
  it runs once a day.
- **`lastOk: null` is the strongest evidence a URL is dead, not the weakest.**
  A URL that has never once answered 200 is not "insufficient data"; it is a
  promise that was never kept. This is the second time that field has been the
  tell (see the 2026-09-02 correction in `data/lost-stories.json` provenance,
  where a `null < "2026-08-22"` comparison skipped exactly these cases).
- **Clearing the symptom is not finding the cause.** The tombstone stops the
  500. It says nothing about why four stories were advertised in a sitemap and
  never written to the archive while the archive was up. Do not let the green
  probe close the question.

Related: `2026-08-24-an-outage-leaves-damage-that-outlives-it.md` (same damage
shape, but there an outage explained it — here nothing does),
`2026-08-22-a-cost-fix-can-move-a-correctness-boundary.md` (the batching that
created the window in the first place).
