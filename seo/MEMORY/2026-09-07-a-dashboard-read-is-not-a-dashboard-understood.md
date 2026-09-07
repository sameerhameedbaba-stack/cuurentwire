# A dashboard read is not a dashboard understood

**2026-09-07, weekly deep run.**

On 2026-08-31 a run opened GSC Crawl stats for the first time, recorded
"80,800 requests, 354 MB, 162 ms, 200s at 99%, Refresh 95% / Discovery 5%,
Other 92% / HTML 5%", and scored the crawl facet on it. That run reported
reading the dashboard as a *gain* — +2 on the data-quality facet for "three
monitoring surfaces that had never been read".

Today the same report reads **80,865 requests** and every single breakdown row
is byte-identical. The chart — which nobody had looked at — shows crawl
requests peaking near 20,000/day on Aug 19-20, falling off a cliff on **Aug 21**,
and sitting on the zero line every day since. Googlebot had already stopped
crawling for ten days when that "gain" was recorded, and two weekly scores were
assigned on top of it.

**The percentages were the trap.** By-purpose, by-file-type and by-Googlebot-type
are all *ratios*, and a ratio survives its denominator going to zero. 92% of
nothing is still 92%. The run reasoned at length about the Desktop/Smartphone
skew and the 92%-non-HTML mix — real analysis, of a distribution that had
stopped being sampled.

**The rule.** When you read a dashboard for the first time, read its **volume
over time** before you read anything it computes from that volume. A totals row
and a set of percentages describe a shape; only the series says whether the
shape is still being drawn. The same applies to any cumulative counter: the
number is worthless without a second reading, which is exactly the lesson
[[2026-09-03-a-signal-dismissed-is-a-signal-unread]] and the cycle-average
mistake in the spend item already paid for, in a different instrument.

**And the corollary that costs more.** A number that is *identical* to last
week's is not a stable system — it is very often a stopped one. The instinct on
seeing an unchanged figure should be suspicion, not reassurance. See
[[2026-08-21-the-instrument-breaks-first-and-quietly]]: this is the same failure
seen from the outside, where the instrument is fine and the thing it measures
has gone away.

Related: [[2026-08-31-serving-200-is-not-being-read]] — that note closed the gap
between "our sitemap serves 200" and "Google read it". This one closes the next
gap along: between "we opened Google's report" and "we know what it says".
