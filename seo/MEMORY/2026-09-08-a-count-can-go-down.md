# Before you difference a series, read the definition of the set

**2026-09-08.** The archive-sitemap runway has now been wrong three times, and
each correction fixed the previous mistake while keeping the assumption
underneath it. First "years away" (a rate from a lull). Then ~1,620/day and a
2026-09-21 deadline (a rate from `<lastmod>` counts, which measure
modification, not creation — [[2026-09-05-a-derived-rate-inherits-the-proxys-meaning]]).
Then, on 09-07, the careful version: three readings of the sitemap **total**,
16,973 → 17,366 → 17,716, a measured 206/day, a ~132-day runway, and an
explicit warning never to quote a runway from one delta.

The fourth reading, nine hours after the third, was **17,426**. Down 290.

Nothing broke. `app/archive-sitemap.xml/route.ts` lists non-merged stories the
thin-story policy keeps indexable, and that predicate carries a rolling term —
`first_seen_at > now() - interval '336 hours'` — so a single-source story with
no history and no Search Console signal *leaves* the sitemap fourteen days
after it is first seen, and a merge removes one permanently. The count rises
and falls by design. Every projection built on it, including the careful one,
was arithmetic on a set that was never monotone.

**The general shape.** Differencing a series silently assumes the set is
cumulative. That assumption is almost never written down next to the number,
and the number keeps looking more trustworthy each time it is refined: more
readings, longer window, an explicit caveat about single deltas. All of that
guards against noise in the measurement, and none of it guards against the set
being the wrong shape. The 09-07 caveat — "never quote a runway derived from
one delta" — would not have caught this, because the problem was not the
delta.

**How to apply.** Before treating any count as a trend, open the code or query
that produces it and ask whether an item can leave. Rolling windows, filters
on freshness, soft deletes, merges and re-keying all make a count a *snapshot
of a predicate*, not an accumulation. If items can leave, differencing is
meaningless and the honest guard is an assertion on the current value — which
is what `ARCHIVE_SHARD_AT` already was, all three times the comment above it
was wrong.

And the meta-lesson, which cost three runs: when a number gets corrected twice,
stop correcting the number and go check the thing it is counting.

Related: [[2026-09-05-a-derived-rate-inherits-the-proxys-meaning]],
[[2026-08-31-serving-200-is-not-being-read]],
[[2026-09-07-a-coverage-floor-is-not-coverage]].
