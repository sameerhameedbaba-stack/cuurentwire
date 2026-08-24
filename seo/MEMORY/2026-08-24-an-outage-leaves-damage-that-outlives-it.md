# An outage leaves damage that outlives it, and the excuse hides it

**2026-08-24.** The 2026-08-20 Neon egress outage was declared CLOSED on
2026-08-21: the archive answered again, `/archive-sitemap.xml` came back, and
three reports since then treated the incident as over. It was not. It had
destroyed data, and nothing counted the loss for four days.

Probing all 2,015 ledger URLs against production: **1,610 × 200, 191 redirect,
214 × 5xx.** Every one of the 214 was first seen on **2026-08-20 (174) or
2026-08-21 (40)** and **none on any other day**. Those stories were live, were
advertised in `/news-sitemap.xml`, were never written to `story_archive` while
the database refused all traffic, and then aged out of the ~72 h live dataset.
The content exists nowhere. The site's own archive says the same thing
independently: `/archive/2026-08-20` lists **24** stories where every
neighbouring day lists 552–1,275.

## Rules this leaves behind

- **When an outage ends, ask what it destroyed, not just whether it stopped.**
  "The surface answers again" is not "the incident is over". The check that
  found this — probe the whole ledger and histogram the failures by
  `firstSeen` — costs two minutes and should run at the close of any data-layer
  incident. A date histogram turns "some pages are broken" into a cause.

- **An outage is a tempting explanation, and it makes real defects
  invisible.** The 2026-08-21 report recorded "`/archive` collapsed to 42 words
  with no JSON-LD (outage)". Re-measured this run with the archive healthy and
  serving 5,742 stories across 11 days, `/archive` **still** shipped zero
  JSON-LD. It was never the outage; the outage was just present at the time and
  absorbed the blame for three days. **Re-measure a symptom once the excuse is
  gone.**

- **A guard against a transient condition needs a bound, or it becomes a
  permanent wrong answer.** `f757bba` made a published-looking slug absent from
  the archive answer a retriable 5xx instead of 404, correctly, because batched
  writes (`persist-gate.ts`) opened a ~30-minute window where absence proves
  nothing. It had no upper bound, so 214 permanently-absent URLs inherited a
  permanent 500. The fix that solved a 30-minute problem created a forever
  problem. See [[2026-08-22-a-cost-fix-can-move-a-correctness-boundary]] — this
  is its sequel: the boundary moved again, and the guard that moved it did not
  say how far.

- **A gate that cannot go green stops being read — and this failure has two
  directions.** [[2026-08-21-an-outage-is-not-a-fact-about-the-world]] recorded
  the first: counting outage 5xx as "lost URLs" would bury a real 404 under
  noise, so GONE (4xx) and UNAVAILABLE (5xx) were split. This run found the
  second: UNAVAILABLE has no exit either, so the workflow was red every night
  since 2026-08-22 for a condition that can never clear. A third state, **LOST**
  (5xx and not seen alive for 3 days), is reported in full and does not fail the
  build. The guard that makes it safe is a **healthy-share threshold** (90%):
  during a real outage almost everything is 5xx, the share collapses, nothing is
  reclassified, and the gate goes red as before. **Any rule that downgrades a
  failure needs a condition that switches it off during a real one**, or a
  site-wide outage gets laundered into "those pages were lost anyway".

## The instrument broke first again — twice, in the same script

[[2026-08-21-the-instrument-breaks-first-and-quietly]] fixed `cwv-check.mjs`
measuring a 500 error page. One week later the same script had two more
defects, and the first explains a number the last weekly report published and
could not account for.

- **Chromium shares its socket pool across BrowserContexts, so only the first
  navigation of a run pays DNS+TCP+TLS.** Under 150 ms emulated latency, `/`
  reported TTFB **2,844 ms** and `/top-100`, two contexts later, **131 ms** —
  and *131 ms is below one emulated round trip*, which is only possible on a
  reused socket. Whichever page ran first absorbed the whole connection setup;
  the series was measuring list order. The 2026-08-21 run reported 2,842 ms and
  the report called the twentyfold disagreement with curl unexplained. **When
  two measurements disagree by an order of magnitude, the arithmetic of the
  faster one is the cheapest place to look: a latency below one RTT is proof of
  a warm connection, not evidence of speed.** Fixed with one throwaway warm-up
  navigation; `/` went 5,104 → 1,852 ms LCP and 2,844 → 102 ms TTFB in the same
  session, agreeing with curl.

- **A methodology change makes the old series incomparable, so mark it in the
  data.** History entries now carry `warmedConnection`. Without that flag the
  next run reads a 5,104 → 1,852 ms drop as a performance win and reports a
  fabricated success. **A fix to an instrument is a discontinuity in its
  series; record it where the next reader is a script, not only in prose.**

- **`redirect: "follow"` is not a liveness check.** `firstLiveStoryUrl()`
  required a 200 but followed redirects, so it accepted a URL that 308s to its
  canonical slug and baked an extra round trip into every story-page number.
  Story slugs are rebuilt whenever `pickLead()` re-selects the lead, so retired
  addresses are the *normal* case in the ledger. Asserting a status code means
  asserting the one the URL itself returns.

## Also from this run

- **An SEO win and a cost blowout can be the same commit.** The 402 was a
  Vercel Hobby **free-tier overage** — ISR Writes 238%, Fluid Active CPU 307%
  (read from the dashboard by a concurrent session; this run could not see it)
  — triggered by `3e8397a`, the 2026-08-19 commit that enabled ISR on the
  dynamic routes. That commit is recorded in `seo/BACKLOG.md` as one of the
  month's biggest wins: warm story TTFB went from a 557 ms median to
  110-125 ms. Caching a page is cheap per request and expensive per *write*,
  and a crawler sweeping ~3,000 archive URLs writes constantly. **Before
  celebrating a caching win, ask what it costs per crawl, not per visit** —
  and when the mitigation lands, its TTLs are a cost constraint that a later
  TTFB optimisation must not quietly tighten back. Same family as
  [[2026-08-22-a-cost-fix-can-move-a-correctness-boundary]], reversed: there a
  cost fix moved a correctness boundary, here a performance fix moved a cost
  boundary.

- **A 402 is a worse outage than a 5xx.** At 13:18 UTC production began
  answering `402 DEPLOYMENT_DISABLED` on every URL, `robots.txt` and all three
  sitemaps included. The 2026-08-20 incident at least kept `robots.txt` and the
  sitemaps up and answered stories with a documented, retriable 503 +
  `Retry-After`. A 402 is not a documented crawl signal at all, and nothing in
  the repository can improve it while it lasts, because nothing in the
  repository is being served.

- **"Not the code" needed splitting, and the first version of this file got it
  wrong.** CI passing at 13:13 UTC proved *this session's push* did not cause
  the outage, and that inference was sound — **check CI's own conclusion before
  suspecting your own push when a site goes down minutes after a deploy.** But
  it was then over-generalised into "purely owner/billing work", which was
  false: `3e8397a` caused the overage, five days earlier. The two questions are
  separate and both have to be asked. *Which deploy broke it?* is answered by
  CI and timestamps. *What consumed the budget?* is answered by usage metrics,
  and a slow-burn resource leak has no correlation with the deploy that trips
  it. Lifting the pause was the owner's; preventing the next one was always
  code's.

- **The push notification path is not reliable.** `PushNotification` returned
  "Mobile push not sent (Remote Control inactive)". The GitHub `[auto-alert]`
  issue email is the only delivery channel that actually reaches the owner, and
  `uptime.yml` requires exactly HTTP 200 — so it does catch a 402. Do not
  describe the push as the alerting path.

- **CI owns `data/`.** `url-survival.yml`, the coherence workflow and the CWV
  workflow each commit their own data file daily. A local run regenerates them;
  committing that copy would clobber CI's newer one (the local ledger was 2,015
  entries against CI's 3,618). Restore `data/` to HEAD, `git pull --rebase`,
  then commit only source. Related:
  [[2026-08-18-daily-and-weekly-loops-collide]].

Related: [[2026-08-21-an-outage-is-not-a-fact-about-the-world]],
[[2026-08-21-the-instrument-breaks-first-and-quietly]],
[[2026-08-22-a-cost-fix-can-move-a-correctness-boundary]].
