# Every cached response needs something that invalidates it — redirects included

**2026-08-28.** The infinite 307 loop that reached Googlebot-News on
2026-08-26 was not a bug in the redirect logic. The redirect was correct
when it was written. It became wrong because nothing was responsible for
re-rendering it.

The site had exactly one invalidation path for story pages: the cron burst
revalidates `/story/<canonical slug>` for the live clusters. That set is,
by definition, the set of URLs that CANNOT hold a stale redirect. The URLs
that can — the slugs a rename just retired — were the only ones nobody
revalidated. `revalidateTag` did not reach them either, because the redirect
returns from the live branch before any tagged read, so the response carries
no tag. A cached 307 could therefore outlive its target by weeks, and a
headline flapping back paired two of them into a permanent cycle.

**The rule:** when a route can answer with more than one KIND of response —
a page, a redirect, a 404 — each kind is cached separately and each needs an
owner that invalidates it. Ask "what re-renders this?" for every branch, not
just the happy one. The invalidation that existed was written for the happy
branch and looked complete.

**And measure the frequency before designing the fix.** The temptation was
to treat a headline rename as an edge case and reach for TTLs. Two
measurements settled it in minutes: 5 of 178 archived live stories were
slugged differently in the live dataset than in the archive at one instant,
and 8 of ~690 news-sitemap stories were renamed in 32 minutes. Renames are
the normal case — which both justified fixing the mechanism rather than the
instance, and sized the cost of the fix (single digits per burst) against
the 150 revalidations the same burst already did.

Related: `2026-08-27-a-side-effect-gated-on-two-clocks-stops-happening.md`
(the burst that does this revalidation had itself stopped running),
`2026-08-26-a-vague-error-is-a-hiding-place.md` (the loop was reported for
days as `TypeError: fetch failed`).
