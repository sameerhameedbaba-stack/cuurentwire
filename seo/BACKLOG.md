# SEO Backlog

**Status 2026-08-24, updated ~14:10 UTC: the 402 outage is RESOLVED — the
owner approved the Vercel Pro upgrade in person and the site returned 200 on
every probed surface at ~13:55 UTC after ~37 minutes dark. Item 0 below is
CLOSED with the full record; item 0b is the phase-2 cost work.**

Rebuilt from this week's evidence. Every item names the command or fetch that
found it. Items closed this run were closed against a fresh measurement, not
against a write-up — except where the 402 outage cut live verification off,
which is said explicitly wherever it applies.

Statuses: OPEN / SHIPPED / CLOSED / BLOCKED(user). Verify a fix live before
flipping it to SHIPPED. Ranking rule: how much indexable, crawlable, citable
value a fix creates per unit of risk.

## Open — ranked

### 0. Production returned 402 DEPLOYMENT_DISABLED — CLOSED (resolved 2026-08-24 ~13:55 UTC)

**The whole site is off the air.** Measured 2026-08-24 13:18 UTC:

```
HTTP/1.1 402 Payment Required
Server: Vercel
X-Vercel-Error: DEPLOYMENT_DISABLED
```

Every URL, without exception: `/`, `/top-100`, `/latest`, `/politics`,
`/about`, `/archive`, a live `/story/` page, **and `robots.txt`,
`sitemap.xml`, `news-sitemap.xml`, `archive-sitemap.xml`, `/rss`,
`/llms.txt`** — 13 of 13 probed surfaces answer 402. `www.currentwire.us`
answers 402 too.

**Window.** The last green uptime probe ran **12:42 UTC** and passed. Every
measurement in this run's report was taken before that, against a healthy
site. First observed 402 at **13:18 UTC**.

**It is not the code.** The CI workflow for this run's commit completed
**success at 13:13 UTC**, and `DEPLOYMENT_DISABLED` is a Vercel
account/project state, not a build result. The most likely cause is a Vercel
spend or usage limit pausing the project — PLAYBOOK.md already records that
Vercel Hobby has no native spend limit and that Neon's paid usage-based plan
is billed through Vercel — but **that is inference and cannot be confirmed
from outside the dashboard.** Only the owner can read the actual reason.

**ROOT CAUSE — added after this report was first written, reported by a
concurrent session with dashboard access that this run did not have.** The
project was paused for exceeding the **Vercel Hobby free tier**, not for a
spend limit: **ISR Writes at 238%** and **Fluid Active CPU at 307%** of
allowance. The named trigger is commit **3e8397a (2026-08-19)**, which enabled
ISR on the dynamic routes — bots crawling ~3,000 archive story URLs burn a
write unit and CPU on every crawl. An emergency mitigation is being shipped by
that session (targeted per-slug revalidation replacing four dynamic-pattern
`revalidatePath` calls, plus longer TTLs on `/story/`, `/topic/`, `/source/`
and `/[category]`).

These figures were read from the Vercel dashboard by that session and are
recorded here on its authority — **this run did not and could not verify
them**, which is exactly why the paragraph above stopped at "inference".

**The uncomfortable part, and the reason it belongs in an SEO report:
3e8397a is recorded in this backlog as one of the biggest SEO wins of the
month.** "ISR was inert on every dynamic route" was backlog item 2 of the
2026-08-19 clear-out; fixing it took warm story TTFB from a 557 ms median to
110-125 ms, and `tests/unit/isr-route-config.test.ts` stands guard over it.
The speed win and the cost blowout are the same commit. Two consequences for
future runs:

- **Whatever TTL the mitigation lands on is a cost constraint, not a
  freshness one.** A later run optimising TTFB must not quietly tighten it
  back. There was 106-145 ms of warm TTFB headroom measured across every
  surface today, so the trade is affordable.
- **`isr-route-config.test.ts` may fail against the mitigation, and its
  premise would then be the thing that expired** — the same situation as
  `MEMORY/2026-08-22-a-cost-fix-can-move-a-correctness-boundary.md`. Read the
  premise before touching the assertion.

A TTL change alone may not hold, either: `/archive-sitemap.xml` went
**2,169 -> 5,891 URLs in two days** and the ledger is gaining 450-700 story
URLs a day. If crawler volume over archive pages is the cost driver, the
driver is still growing.

**RESOLUTION (2026-08-24, ~13:55 UTC).** The paragraph that stood here said
"Do NOT buy Pro — the $0 rule stands." That was this backlog's reading of the
standing rule, and the owner overrode it the same day, in chat, with the
options and prices in front of them: on the Hobby tier the blown 30-day usage
window meant **~3-4 weeks dark** (Vercel docs: "you will have to wait until
30 days have passed"), the hoped-for free 14-day Pro trial was not offered by
the flow, and the owner chose Pro anyway. **Vercel Pro is now active — $20/mo,
period 24 Aug-24 Sep 2026, card entered by the owner previously (Neon), no
agent touched payment details.** Site verified back: `/`, `robots.txt` and
all three sitemaps answered 200 at 13:55 UTC; total downtime ~37 minutes
(13:18-13:55). The $0 rule now has TWO owner-approved exceptions: Neon
(2026-08-21) and Vercel Pro (2026-08-24). Decision point: before **24 Sep**
the owner decides stay-Pro vs downgrade (downgrading earlier re-pauses the
site while the old usage window is still blown — do not suggest it before
mid-September).

**Consequence while it lasts.** This is worse than the 2026-08-20 archive
outage, because `robots.txt` and all three sitemaps are also 402. A 402 is
not a documented crawl signal the way 503 + `Retry-After` is; crawlers will
treat it as a generic failure. Nothing in the repository can improve the
signal, because nothing in the repository is being served.

**Alerting.** `uptime.yml` requires exactly HTTP 200 and fails on anything
else, so it will catch this on its next 30-minute run and open an
`[auto-alert]` issue, which emails the owner. A desktop/phone push was
attempted from this run and could not be delivered (Remote Control inactive),
so the GitHub issue email is the live delivery path.

### 0b. ISR cost, phase 2: decouple the story long tail from the dataset cache — OPEN

**What shipped 2026-08-24 (phase 1, same session that closed item 0):**
`vercel.json` ignoreCommand skipping builds for `seo/`, `docs/`, `data/`,
`.github/` and root-`*.md`-only commits (report commits were deploying ~12×/day
and every deploy wipes the whole ISR cache); the four dynamic-pattern
`revalidatePath` nukes removed from the cron and replaced with per-slug
revalidation of ≤150 live story paths, burst-gated to the ~30-min persist
cadence; segment `revalidate` raised on 28 pages (story 30 d, hubs/lists 1 h,
home/us/canada 15 min) with cost comments; the shared dataset entry's
`revalidate` floored at 1,740 s in `lib/cache/store.ts`. Estimated cut:
~5-10× on ISR writes and render CPU.

**Why that is not the end:** two adversarially-verified mechanics (workflow
run `wf_06774a4b-698`, this session) cap what TTLs can do:

1. **Lowest-revalidate-wins composition.** Every page that reads
   `getDataset()` inherits the dataset entry's 1,740 s revalidate — the
   30-day story TTL is clamped to ~29 min in practice
   (`node_modules/next/dist/server/web/spec-extension/unstable-cache.js`
   lowers the prerender store's revalidate to the entry's).
2. **Tag propagation.** `forceRefresh()` calls
   `revalidateTag(NEWS_CACHE_TAG, "max")` every effective run, and pages
   carrying the tag are invalidated wholesale — so every cached page still
   ages out within ~30 min regardless of segment config.

**The fix that makes Hobby-tier math work (needed if the owner ever
downgrades, and it cuts the Pro bill too):** give `/story/[slug]` (the
~3,600-URL long tail growing 450-700/day) a dataset read path with NO
`NEWS_CACHE_TAG` and no sub-hour revalidate — archived stories read the
archive tables (their `cachedRead` TTLs 1800/21600 need the same lift), live
stories can read the in-process/snapshot layer directly. Verify with
`x-nextjs-cache: HIT` surviving a cron cycle before trusting any quota
projection. Secondary levers from the same verification: static OG cards
(`/story/[slug]/opengraph-image` is a Satori render per crawler fetch —
a real CPU hog), `dynamicParams = false` on closed param spaces
(`/[category]`, `/top-10/[category]`) so junk probes 404 without a render,
and `s-maxage` on sitemap/RSS responses. Measure the real post-phase-1 burn
on the Vercel usage page after ~48 h (by 26-27 Aug) before deciding how much
of phase 2 to build.

### 1. 214 published stories are permanently gone, and the site still serves them a 500

**Found by probing all 2,015 local ledger URLs against production this run,
while the site was still up.** Result: **1,610 answer 200, 191 redirect, 214
answer 5xx.** Every one of the 214 was first seen on **2026-08-20 (174) or
2026-08-21 (40)** and **none on any other day** — precisely the window when
Neon's free tier was refusing all traffic on an exhausted egress quota.
Corroborated on the site itself:

| Archive day page | Stories listed |
|---|---|
| /archive/2026-08-18 | 659 |
| /archive/2026-08-19 | 666 |
| **/archive/2026-08-20** | **24** |
| /archive/2026-08-21 | 1,000 (capped) |
| /archive/2026-08-22 | 671 |
| /archive/2026-08-23 | 657 |

Those stories were live, were advertised in `/news-sitemap.xml`, were never
written to `story_archive`, and then aged out of the ~72 h live dataset. The
content exists nowhere. **No restore brings it back** — this is the durable
cost of the 2026-08-20 outage, and it was not visible in any report until now.

What was fixed this run: the *gate*. `url-survival` had been calling these
UNAVAILABLE ("the origin is having a bad day, retry") and failing every night
since 2026-08-22 for a condition that can never clear. See "Closed this run".

What is still open is the **status code**. These URLs answer a permanent 500:

- crawlers retry forever and eventually drop them anyway, so the 500 buys
  nothing;
- it costs crawl budget on a site whose indexing coverage is the
  second-biggest lever in the playbook.

The obvious fix — 404 or 410 them — is **not obviously right and must not be
rushed**, because the guard that produces the 500 is the one that fixed the
2026-08-22 Google News bug (`f757bba`): a published-looking slug absent from
the archive answers 5xx precisely because the ~30-minute write batching means
"the archive has not heard of it" no longer means "it never existed". Getting
this wrong in the eager direction re-creates a 404 on brand-new stories, on
the one crawl that decides Google News entry.

The missing ingredient is a **bound**, and the slug does not carry one:
`cluster.id` is `c` + `stableId("cluster:" + canonicalUrl)`, a content hash
with no timestamp (`lib/news/clustering/cluster.ts:655`). Candidate bounds
worth designing and reviewing before anything ships:

- ask the archive for its newest `firstSeenAt` and treat "the archive is
  demonstrably caught up" as licence to 404 an unknown slug;
- have the persist-gate's public-but-not-yet-archived registry answer the
  question directly, since it already exists to carry clusters across a batch.

Contained in the meantime, and checked rather than assumed: **0 of the 214
appear in `sitemap.xml`, `news-sitemap.xml` or `archive-sitemap.xml`.** The
site is not asking anyone to fetch them.

### 2. Surface coherence: a live story can serve a stale archived copy

**Open `[auto-alert]` issue #2, failing since 2026-08-23. Reproduced this
run.** `node scripts/surface-coherence.mjs`: 20 pages, 700 cards, 174
clusters, 348 story-page fetches, **2 violations, 2 warnings**. Both
violations are `archive-vs-live` — a `/story/` page rendered from the archive
while list surfaces showed the same cluster as live:

| Cluster | Story page rendered from | Listed live on |
|---|---|---|
| `c5a7f5a95321f` | `archive:2026-08-24T12:30:13Z` | `/` |
| `c0fc056bd72e8` | `archive:2026-08-22T07:03:24Z` | `/ai` |

`resolveStoryRequest` checks the live dataset first, so this means the story
page's live read missed a cluster its list surfaces had — cache skew between
surfaces, held by ISR until revalidation.

**Severity measured, not assumed.** The second URL, fetched live: **200**,
self-referential canonical, valid `NewsArticle`, 406 words, honest dates. The
cost is staleness, not a broken signal — `dateModified` is frozen at 08-22 and
`isBasedOn` shows 1 source, so a story that has since gained coverage
under-reports it and never bumps its modified date.

Deliberately **not** fixed this run. This is the story-resolution and ISR
path, which produced both of the last two incidents (`d060817`, `f757bba`); a
rushed change there costs more than two stale pages. It needs a design and a
review.

### 3. `/source/<slug>` hubs carry no durable per-publisher facts

**The clearest competitor gap this run found, and it is measurable on both
sides.** `/source/bbc-news` is 200, indexable, `BreadcrumbList` + `ItemList`,
737 words — and essentially all 737 are headline text from 35 story links. The
title is "BBC News — Latest stories". There is no prose about the publisher and
no `Organization`/`Periodical` schema for the publisher itself. `/source/espn`
is 310 words, 13 stories.

Against that: AllSides publishes bias ratings for **1,400+ outlets** as
dedicated per-outlet reference pages, and Ground News source pages carry bias,
factuality and ownership per outlet (both verified by crawl and search this
run — see the report). Those pages rank for "&lt;outlet&gt; bias" and
"&lt;outlet&gt; media bias" queries, which are durable, non-news, evergreen
demand.

CurrentWire deliberately publishes **no** bias or factuality rating and its
authority tiers are explicitly not one — that is a standing editorial position
and this item does not propose changing it. The gap is that the source hubs
publish *nothing durable at all*, so they compete only for the publisher's own
brand name, where the publisher always wins.

Every input already exists and is already computed: tier and its rationale,
cadence, category mix, first seen, story count, share of multi-source stories.
Same shape as the `/methodology/*` pages, whose figures are computed at render
from production functions so they cannot drift from the code.

Carried from last week's top 5, where it was ranked 4 and described as "the
largest content gap on the board". Unchanged since, now with competitor
evidence attached.

### 4. Story pages have no outbound topic links — RE-MEASURED 2026-08-24, still open

Measured on 12 live stories sampled across `/news-sitemap.xml`: outbound
`/story/` links **median 4, zero on none of them** (the 2026-08-19 "More in
{Category}" rail is holding — it was zero on 39 of 40 on 2026-08-18). Outbound
`/topic/` links are **median 0, absent on 9 of 12**.

Unchanged for a third week, so it keeps its rank. Topic hubs are exactly the
surface that needs inbound links: 40 sit in `sitemap.xml` and they flip
indexable as they accumulate stories.

Two smaller story-template defects measured alongside it, same sample:
**9 of 12 titles exceed 60 characters** and **4 of 12 meta descriptions still
end mid-sentence** (53% on 08-18, 23% after the formatter fix, 25% on 08-22).
The description residue is summaries whose first sentence alone exceeds the
limit — a summarizer input-length question, not a formatter bug.

## Watching, not yet work

- **A site-wide 4xx outage reads as a broken permanence promise.** Noted
  while the 402 was live and not yet fixed. `url-survival` classifies any 4xx
  as GONE, so during this outage it will report `GONE=<the whole ledger>` and
  fail with *"the published URLs never 404 guarantee is broken"*. Failing is
  correct — a site serving nothing must go red — but the message will point
  the next reader at a permanence regression that did not happen. The LOST
  path is unaffected (it only ever considers 5xx and network errors), so
  nothing gets laundered. The fix, when someone touches this file next, is the
  same shape as `RUN_HEALTHY_SHARE`: when essentially every URL returns the
  same 4xx, say "the origin is refusing to serve" rather than naming the
  guarantee.

- **A one-off 500 on `/` during the Playwright suite.** The first full run
  this session failed one assertion — `security.spec.ts` got **500** from `/`.
  The same spec passed alone immediately after, and a full re-run went
  107/107. Recorded rather than dismissed: an intermittent 500 on the homepage
  would matter, and `MEMORY/2026-08-18-daily-and-weekly-loops-collide.md` says
  to diagnose with a control run before believing a Playwright failure —
  which is what was done. If it recurs, it is real.
- **`/archive-sitemap.xml` grew 2,169 -> 5,891** in two days while the ledger
  gained ~450-700 URLs/day. Consistent with the feed-list expansion (98 feeds)
  plus the thin-story policy's 72 h/2-source/history rule admitting more
  stories, but the arithmetic was not reconciled this run. The health check
  fails above 45,000, ~5,000 short of the 50,000 cap, so the ceiling is
  guarded. Re-measure next week; a count that keeps doubling needs an
  explanation, not a shrug.
- **Publisher image weight drifted up.** `seo-health` passes: 15 images,
  1,503 KB, median 52 KB, **max 448 KB** — against median 79 KB / max 144 KB
  on 2026-08-21. The median improved and the max tripled, so one host is
  serving something large. Becomes work if the max crosses 500 KB (which fails
  the check for capped hosts).
- **`/most-covered` is at 25 items**, up from 5 on 2026-08-22 and 12 on
  2026-08-19. The feed expansion fixed the thinness that was logged here for
  two weeks. Keep watching that it does not fall back.
- **1 duplicate normalized title in 643** news-sitemap entries, 0 duplicate
  slugs. Inside the designed precision-over-recall contract. Not filed.

## Closed this run

Everything below passed the full gate set (887 unit tests, tsc, eslint, build
with an unchanged route table, 107 Playwright tests) and is pushed to `main`
as `c124d70`. **Live verification of the four page-level items was cut off by
the 402 outage** — the deploy could not be served — so they are marked SHIPPED
on build-and-test evidence and must be re-checked live once the site is back.
Two of the five were verified by running the changed script against production
before the outage, and those say so.

### The URL-survival gate could not go green — SHIPPED, verified live

See open item 1 for the cause. `scripts/url-survival-lib.mjs` adds a third
state: **LOST** (5xx and not seen alive for 3 days) is reported in full every
run and does not fail the build, guarded by `RUN_HEALTHY_SHARE` so a site-wide
outage — where the healthy share collapses — reclassifies nothing and stays
red. Run against production before the 402:
`GONE=0 UNAVAILABLE=0 LOST=214`, exit 0, against `UNAVAILABLE=214`, exit 1
from the same probe minutes earlier.
Guard: `tests/unit/url-survival-classify.test.ts` (10 tests).

### The CWV probe was measuring page order — SHIPPED, verified live

Two defects in the same script, one week after the last two were fixed in it.

**Connection warm-up.** Every URL gets a fresh `BrowserContext`, but Chromium
shares its socket pool across contexts, so only the first navigation pays
DNS+TCP+TLS. Under the 150 ms emulated latency `/` reported TTFB **2,844 ms**
while `/top-100`, two contexts later, reported **131 ms** — below one emulated
round trip, which is only possible on a reused socket. The 2026-08-21 run
reported 2,842 ms and could not explain the twentyfold disagreement with curl.
After a throwaway warm-up navigation, same session against production:
`/` LCP **5,104 -> 1,852 ms**, TTFB **2,844 -> 102 ms**, agreeing with curl's
135 ms. History entries now carry `warmedConnection` so the discontinuity is
machine-visible — **the drop across that boundary is the instrument, not the
site, and next week's run must not read it as a win.**

**Redirect target.** `firstLiveStoryUrl()` probed with `redirect: "follow"`,
so it accepted a URL that 308s to its canonical slug and baked an extra round
trip into every story-page number in the history. Story slugs are rebuilt
whenever `pickLead()` re-selects the lead, so retired addresses are the normal
case, not an edge one. Now `manual` — the next run skipped a 308 and a 307 and
measured a real canonical URL.

### `/news-desk` had no JSON-LD — SHIPPED, live check pending

Open since 2026-08-19 and named in two weekly reports. It is the URL
`NewsMediaOrganization.masthead` points at, so the Organization schema named a
page that did not identify itself. Now `WebPage`, along with `/privacy`,
`/terms` and `/copyright`, which were bare for the same reason.

### `/archive` had no JSON-LD — SHIPPED, live check pending

Blamed on the outage in the 2026-08-21 report ("collapsed to 42 words with no
JSON-LD"). Re-measured with the archive healthy: `/archive` was serving 5,742
stories across 11 days and **still shipped zero JSON-LD**, while the
`/archive/<date>` pages beneath it have carried `BreadcrumbList` + `ItemList`
since 2026-08-19. It was never the outage. Now `CollectionPage` +
`BreadcrumbList`, suppressed when the archive reads empty so an outage cannot
produce a cacheable `numberOfItems: 0`.

*The lesson worth keeping: an outage is a tempting explanation for any
measurement taken during one, and it made a real defect invisible for three
days. Re-measure a symptom once the excuse is gone.*

Guards for both: `tests/unit/trust-page-jsonld.test.ts` (33 tests) and
`scripts/seo-health.mjs`, now checking 11 pages against live HTML instead of 6.

### llms.txt was describing a smaller site — SHIPPED, live check pending

5,175 -> 7,256 bytes. Four whole page families were missing (`/top-10` and its
9 section variants, `/briefing` plus dated archives,
`/reports/media-coverage` weekly reports, `/ai`) along with 14 sections. All 48
URLs it now claims were fetched and answered 200 before the outage. The
failure contract was corrected: it promised a 5xx means "ask again later",
which is not true of the 214 in item 1, so it now says so.

### Thin category pages — CLOSED 2026-08-24, fixed by the feed expansion

Logged for two weeks: `/climate` 3 items / 133 words, `/culture` 3 / 137,
`/science` 5 / 152. Re-measured this run: **`/climate` 13 items / 599 words,
`/culture` 13 / 623, `/science` 13 / 541**, and every one of 24 sections
answered 200, was indexable, and carried 12-80 story links. Not fixed by
anything the SEO loop did — the 98-feed expansion did it.

## Known and accepted — not work, but do not "fix" these

- **The operator identity line on `/about`** is deliberately deferred. Business
  decision, not an oversight.
- **`/topic/*` hubs below the thin-collection bar are `noindex, follow`.** They
  flip indexable as they accumulate stories. Verified again this run:
  `/topic/donald-trump` is `noindex, follow`. Working as designed.
- **`/general` and `/search` are noindexed.** Verified live this run
  (`noindex, nofollow` on both). `/general` is the internal low-confidence
  bucket; `/source/reuters` is `noindex, follow` for the same thin-collection
  reason.
- **Merge 308s and `/story/<clusterId>` 307s show as "Page with redirect" in
  GSC.** That is the URL-permanence guarantee doing its job — 191 of 2,015
  ledger URLs are redirects and all resolve 200.
- **`/top-100` and `/latest` are `force-dynamic`.** They must read
  `searchParams`. Their canonical unfiltered documents carry an edge-only cache
  directive instead; both measured `X-Vercel-Cache: HIT` at 109-128 ms TTFB
  this run.
- **`static.politico.com` images cannot be resized.** Six query shapes returned
  the identical 4,944,055 bytes on 2026-08-19. Re-probe only if Politico
  changes CDN.
- **The keyless PageSpeed Insights API returns HTTP 429 with a per-day quota of
  zero.** Confirmed again this run. `cwv-check.mjs` does not depend on it. A
  key would only add CrUX field data, which needs traffic this site does not
  have yet.

## History

Earlier shipped work (2026-08-15 baseline through 2026-08-22) is recorded in
`seo/reports/`. The 2026-08-19 backlog clear-out, the 2026-08-20 image-weight
fix, the 2026-08-21 outage response and the 2026-08-22 news-sitemap 404 fix all
have their own entries there with the live verification attached.
