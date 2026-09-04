# A derived rate inherits the proxy's meaning, not the one you wanted

**2026-09-05.** `scripts/seo-health.mjs` carries a comment putting archive
growth at ~1,620/day and the sharding `fail()` at ~2026-09-21. That comment is
itself a *correction*, written on 2026-09-03 to replace an earlier claim that
sharding was "years away" — and it was written carefully, with real numbers
taken live. It is still wrong, because it counts the wrong field.

The rate was read off per-day `<lastmod>` counts in the archive sitemap:
1,607 / 1,614 / 1,668 / 1,486 for Sep 1–4. But the sitemap **total** went
16,973 → 17,366 over that last day: net **+393**. A `lastmod` is a
modification date, so 1,486 rows stamped Sep 4 across a day that added 393
URLs is mostly re-modified (and possibly tombstoned) rows. The question was
"how long until we hit 45,000 URLs", and only the total answers it.

**The trap is that a proxy-derived number looks more rigorous than a guess.**
It has a real measurement behind it, a date range, and arithmetic. "Years
away" was obviously unverified; "~1,620/day, fail lands 2026-09-21" reads like
it was checked. Both are unverified in the same way — neither measured the
quantity the decision depends on.

**How to apply.** Before trusting a rate, name the quantity the decision needs
and check that the field you counted *is* that quantity. `lastmod` is not
creation. A 200 is not a read. A healthy site is not a shipped deploy. A
deployment record is not a live page.

**And the second half, which is the harder discipline:** having found the old
rate wrong, do not immediately write the new one in. A single 24-hour delta is
the same sample size that produced the error. The runway here spans ~26 to ~70
days depending on the window chosen, so the correct move was to file the
finding, start recording the total every run, and let a real series
accumulate — not to swap one confidently-stated number for another. A
correction made at the same rigour as the mistake is just the next mistake.

Related: [[2026-08-31-serving-200-is-not-being-read]],
[[2026-09-02-a-healthy-site-is-not-a-shipped-deploy]],
[[2026-08-21-the-instrument-breaks-first-and-quietly]].
