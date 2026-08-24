# Publishing a fact is how you find out it is wrong

**2026-08-25.** `/source/<slug>` hubs shipped a coverage profile: counts of a
publisher's stories, how many are corroborated, and the sections they were
filed in. It was built as *content* — the durable per-publisher value the hubs
had never had (BACKLOG item 3). Within minutes of the deploy it had found a
data defect that three weeks of crawling had not.

The rendered line reads "Sections filed in: General (11), World (7), …".
`General` is the internal low-confidence bucket, and it is the **largest
section for BBC News, CBC News and The Guardian** — three tier-A publishers.
Corroborated independently on 22 story pages read from their own
`articleSection`: 3 of 22 are `General`, one of them a West Bank settler story
that is a World story by any reading. `/general` is `noindex, nofollow` by
design, so every story routed there sits on **no indexable category page at
all**.

## The rule

**A page that renders your data is a monitor you get for free, and it is a
better monitor than a probe, because it runs on every request and a human
reads it.** The probes this site already runs — seo-health, url-survival,
surface-coherence, the CWV check — all ask questions someone thought to ask in
advance. The section-mix line asked no question at all; it just showed the
distribution, and the distribution was visibly wrong. Aggregate a field into
prose on a public page and its outliers stop being rows in a table.

The corollary is the reason it works: **prose forces the aggregation a table
lets you skip.** "Sections filed in, most-filed first" required sorting by
count, and sorting by count is what put `General` in first place. Nobody had
ever sorted story categories by publisher before, because no page needed it.

Related in shape, opposite in direction:
[[2026-08-21-the-instrument-breaks-first-and-quietly]] — there the measuring
tool was the thing that was broken. Here a *publishing* tool turned out to
measure. Both say the same thing about where to look: the numbers you put in
front of a reader get checked, and the ones you do not, do not.

## The obligation that comes with it

Publishing a computed fact about a **real, named third party** is a different
risk from publishing one about yourself. Every honesty rule went into the
module and the tests, not the prose:

- counts scoped to the current window, stated as lower bounds over the
  publications this site ingests;
- one story counted once however many times a publisher filed into it;
- the widest-corroborated line absent below two publications, so the copy
  cannot imply breadth that is not there;
- **no bias or factuality rating**, rendered or in schema —
  `collectionPageSchema` refuses a rating property on the `about` node;
- `about` names the publisher, `publisher` stays CurrentWire. Markup naming
  the outlet as the page's publisher would misrepresent who wrote it.

**If a number is not safe to be wrong in public about someone else, it is not
ready to publish.** That test is what kept the feature to counts.

## Also from this run

- **A gate that fails a different test every run is load, not a bug — and do
  not fix it before you know why.** Five full Playwright runs of one unchanged
  tree: three failed, each on a *different* test, every one passing when its
  own spec ran alone, and the suite green at `--workers=2` and green twice at
  default. That pattern is saturation. The tempting fix — pin `workers` in the
  config — was **not** taken, because the failure detail was never captured
  (passing re-runs wipe the artifacts), so nobody knows whether these are 500s
  or timeouts. **Capping concurrency to silence an intermittent 500 would hide
  the exact defect the gate exists to catch.** Capture the reason first. Logged
  on 2026-08-24 as "a one-off 500, if it recurs it is real" — it recurred, and
  "real" turned out to mean real about the harness.

- **`gh` unauthenticated is not a blocker.** The open `[auto-alert]` issues
  were read from the public GitHub REST API with plain `curl`, as were the
  workflow conclusions for `seo-health`, `url-survival` and `uptime`. A run
  that stops at `gh auth login` has given up one command too early.

- **A fix shipped after the last workflow run is not a fix CI has seen.**
  `url-survival` still shows `failure` on 08-23 and 08-24; both runs predate
  the LOST-state fix. The code was verified against production by hand, so it
  is known good — but the alert stays open until a *run* is green. Check
  timestamps against the commit before reading a red badge as a live defect.

Related: [[2026-08-24-an-outage-leaves-damage-that-outlives-it]],
[[2026-08-18-monitor-and-renderer-must-agree-on-the-field]],
[[2026-08-15-category-dedup-already-engineered]].
