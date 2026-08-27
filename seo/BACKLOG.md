# SEO Backlog

**Status 2026-08-28 manual session (owner asked why performance keeps
worsening): gsc.yml run #6 dispatched, data lands through Aug 27, and an
adversarial multi-agent review REFUTED the "decline fully explained, all
fixed" verdict.** What survived: the Aug 20 collapse is the outage
(impressions 410 -> 93, -77%), the tombstoned outage URLs have **fully
dropped out of Google's impression data** (0 of 205 ids appear in
`gsc-url-signals.json`), and production is verified healthy live (cron
beating, newest news-sitemap entry 37 min old, 672 entries). What did NOT
survive, three findings, in rank order:

1. **ACTIVE: Google de-indexed 11 of 12 indexed hub/category pages between
   the Aug 25 and Aug 27 URL-Inspection sweeps — without re-crawling them**
   (`lastCrawlTime` Aug 15-16 identical in both sweeps; only `/` remains
   indexed). This is index-selection re-evaluation — most plausibly the
   site-level trust drop propagating — NOT a crawl failure. Per the standing
   verdict (2026-08-25): do not resubmit sitemaps, do not add links; the
   levers are uninterrupted uptime + page value. Now in
   `data/incidents.json` (kind "google") so trend dips self-explain. This
   data point arrives early for the **~Sep 22 hub-consolidation decision**
   — if the next sweep shows no recovery, the consolidation case
   strengthens.
2. **NEW ITEM — CTR pass on the pages that already rank (CTR bucket,
   sanctioned by STRATEGY §3).** 509 query impressions -> 3 clicks. The
   named targets, each with impressions and near-zero clicks:
   `c5a295c6ce624` ("espn nba coverage cuts", 69 impr, pos 9, 0 clicks —
   the single largest impression pool on the site), `cb3392289511d`
   ("jd vance hometown book response", 19 impr, pos 7.2, 0 clicks),
   `cf03400ab04ec` ("trump bbc lawsuit judge change", 14 impr, pos 12.4),
   plus a SERP-presentation check on the **position-1, 0-click** page for
   "oswaldo pirela ice detention". Execution = the already-sanctioned
   per-story title/description override (PREFIX-experiment infrastructure);
   guardrails apply (no fake freshness, no "sources" wording).
3. **Complete-day series is not a flat bottom**: erosion continued through
   Aug 23 (impressions 93 -> 72 -> 55 -> 41, position 49.8 -> 79.7), a small
   Aug 24 uptick (49), and partial Aug 25 (71) already exceeds complete
   Aug 24 despite lag undercounting — a weak stabilization hint, judge only
   after Aug 25-27 finalize (~Aug 30). The Aug 22-23 erosion is
   mechanistically consistent with Google progressively dropping the 214
   dead outage URLs (lagged fallout, now annotated via the de-indexation
   incident above).

**Status 2026-08-27 daily run: production answers 200 everywhere and has
done all day — and it was quietly failing to KEEP anything.** The permanent
archive took its last row at **07:00:30 UTC and then nothing for 10 hours**
(measured through `/api/stats/archive-sources`), exactly as it had for 14
hours the day before. Stories published inside those windows get no archive
row, so they have no permanent URL, never enter `/news-sitemap.xml` (which
is gated on archive standing — the feed fell to **132 entries on Aug 26**,
newest entry 14.4 h old) and are never pinged to IndexNow. Root-caused to
two rules that only opened the write gate when a drifting refresh tick
happened to land in a 5-minute window, and **fixed in `e1b4cfb`** (item 0c).
Three `[auto-alert]` issues are open — **#4 and #5 were opened 2026-08-26
07:31/07:32 UTC and no run had seen them until today** (the daily loop runs
before that hour): #5 (seo-health) is **already stale** — the local run
against production passes all checks — and #4 (url-survival) was **the
tombstones reporting themselves as broken promises**, now fixed. #2
(coherence) remains open and is item 3.

**Status 2026-08-26 daily run: production is HEALTHY, and a crawl-breaking
redirect loop was found, root-caused and cleared.** `/`, `/news-sitemap.xml`,
`/archive-sitemap.xml` and `/rss` all 200. `node scripts/seo-health.mjs`
against production failed on 1 of 643 news-sitemap URLs — a genuine
**infinite 307 loop** between two slugs of cluster `c73a14a645aa9` — and
passed all checks again after the fix deploy (`SEO health: ALL CHECKS
PASSED`, exit 0). See item 1 below: the loop is cleared but the mechanism
that produces it is still live. `[auto-alert]` issue **#1 (url-survival) is
resolved** — the 2026-08-25 workflow run is `success`, which is the first
run to exercise `c124d70`, so the LOST fix is now proven in CI and not just
against a local probe. Issue **#2 (surface coherence) remains open** and is
item 3.

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

**STRATEGY ADOPTED 2026-08-24: `seo/STRATEGY.md` is now the master plan**
(full-spectrum: on-page, off-page, technical, competitors, keywords; 10-agent
analysis + adversarial red-team). Daily runs execute the current sprint's
[automated] items from its §3 roadmap — Sprint 1 runs Aug 24–Sep 6. Its §2
guardrails override any older idea in this file. Already shipped from
Sprint 1 (2026-08-24): GSC query instrumentation (scripts/gsc-report.mjs now
pulls ["query"] web+news and ["page","query"] web → data/gsc-queries.json
with the striking-distance inventory; first data lands on the next gsc.yml
run). Sprint-1 status as of 2026-08-24 late session: (1) news-sitemap
integrity — IN FLIGHT in a separate session (the one open item); (2)
indexation check — SHIPPED as scripts/gsc-indexation-check.mjs, runs in
gsc.yml after the report (URL Inspection sweep over 34 evergreen surfaces →
data/gsc-indexation.json with the first bucket split; first data next
Monday run or manual dispatch); (3) retitle wave 1 — SHIPPED (homepage
defaultTitle, stable /briefing title, dated briefings via briefingMetaTitle
without fake-freshness "today", 9 category seoTitles, /most-covered
META_TITLE split from the plain h1, /latest, /reports/media-coverage both
pages; tests updated with premise notes); (4) story cards — VERIFIED
ALREADY SATISFIED (og card is self-generated 1200×630, listed FIRST in
NewsArticle image, max-image-preview:large set site-wide; no change
needed — publisher-photo hotlinking stays an owner legal decision, not
taken); (5) internal-link rewire — SHIPPED (homepage "Today" pill nav to
/briefing /top-10 /most-covered /reports/media-coverage; footer already
carried sitewide links); (6) Publisher Center — DONE by owner 2026-08-24:
publication "CurrentWire" created under the ovyajewels@gmail.com Google
account (the GSC-owner account — see MEMORY), auto-suggested from the
verified property, US/English. Retitle effects are judged against the
indexation buckets once (2) produces data — do not conclude anything from
impressions before ~2 weeks post-deploy.

**FIRST INDEXATION DATA — 2026-08-25 00:29 UTC, and it reorders the work.**
`scripts/gsc-indexation-check.mjs` ran for the first time (GSC run #4,
commit 3e071cc). Result: **12 of 34 evergreen surfaces are indexed, 22 are
NOT.** Indexed: `/`, `/latest`, `/topics`, `/sources`, `/us`, `/canada`,
`/politics`, `/business`, `/technology`, `/climate`, `/culture`, `/sports`.
NOT indexed: `/briefing`, `/top-10`, `/most-covered`, `/world`, `/health`
("Discovered — currently not indexed"), `/reports/media-coverage`,
`/science`, `/energy`, `/space`, `/obituaries` ("URL is unknown to Google"),
and **all 15 topic hubs**.

**Mechanically we are clean — verified live, not assumed:** every one of
those URLs is in `sitemap.xml` (342 URLs), every one serves
`robots: index, follow` with `max-image-preview:large`, every one renders
2,000–8,300 words, and the hubs carry internal links from `/topics` which
IS indexed. So this is not a bug to fix. It is Google declining to spend
index budget on a 1-month-old domain's aggregated list pages — a
value/authority verdict, exactly the thesis behind STRATEGY BET 2.

**Consequences, and they are concrete:**
1. **Retitles cannot work on the 22 unindexed pages** until indexing
   happens — the reviewer's correction, proven by our own data within
   hours of shipping. The retitles that DO apply are the homepage and the
   9 category pages (indexed) plus story pages (indexed and earning).
2. **The work splits by bucket, permanently.** Indexed surfaces
   (homepage, categories, ~521 story URLs) → packaging/CTR work. Unindexed
   surfaces (hubs, briefing, top-10, most-covered, reports) → they need
   ORIGINAL VALUE, not better titles. That is BET 2 (data moat) and the
   Sprint-3 hub explainer blocks, and both just became more urgent than
   any further retitling.
3. Do NOT respond by adding more internal links or resubmitting sitemaps —
   both are already correct, and doing more of a thing that is not the
   constraint wastes runs.

**FIRST QUERY DATA — same run (data/gsc-queries.json): 217 web queries,
26 in striking distance, and a clear CTR failure.** We rank **position 1**
for "oswaldo pirela ice detention" (12 impressions, 0 clicks), **position
9** for "espn nba coverage cuts" (69 impressions — our single most-shown
query, 0 clicks), **7.2** for "jd vance hometown book response" (19, 0),
**12.4** for "trump bbc lawsuit judge change" (14, 0). Four page-one
queries, ~114 impressions, zero clicks. Story pages ARE indexed and ARE
ranking; their titles are not earning the click against the BBC/ESPN beside
them. **The Sprint-2 CTR-rescue job is now the highest-value item with
evidence behind it** — trigger on the striking-distance list, not on
impressions alone. Also: `newsRows: 0` — the News surface returns no query
rows at all, confirming Google News shows us essentially nothing. And
"current events" sits at position 96 (9 impressions) with a typo variant
"curren events" at 97.3 — real demand, we are nowhere, which validates the
Sprint-3 `/current-events` build.

**CTR/INDEXING FIX ROUND — 2026-08-25, adversarially reviewed before
shipping (workflow wf_26d0393b-f8f, 6 agents).** The red team REFUTED the
first design and materially corrected the diagnosis; both are recorded so
no run re-litigates:

- **Diagnosis correction.** "Four page-one queries, zero clicks" was
  partly noise: excluding the position-1 query, P(0 clicks) ≈ 19% —
  ordinary variance. /story/* aggregate CTR is actually 1.32% (22 clicks /
  1,672 impressions, 490 URLs), and the single-source cohort out-CTRs the
  multi-source cohort (1.46% at pos 23.7 vs 0.45% at pos 47.8). The real
  , verified problem is narrower: our snippet is a COPY — clustering sets
  summary = lead.description, so both our title AND description are the
  publisher's own words next to the publisher's own result.
- **KILLED: the title qualifier.** Arithmetically inert — it required
  headline ≤48 chars + 2+ publications; the corpus median headline is
  71–74 chars and ~6 of 1,885 stories qualify (0.32%), including ZERO of
  the four measured queries. Do not resurrect an append-style title
  qualifier; a PREFIX-style experiment ("N outlets: …") on a 20-30 story
  subset is the only sanctioned variant, logged for a future run.
- **SHIPPED instead (all red-team-approved):** (1) multi-source story
  descriptions now lead with our coverage breadth ("N reports from M
  publications, compared side by side" — "compared" gated on rendered
  corroborated details, press-release clusters excluded, wording avoids
  the probe-anchored word "sources"); reaches ~6% of story pages, framed
  honestly as marginal. (2) Hub-line honesty fix: the pipeline admits
  untracked publishers, so "N of the 69" could exceed 69 — hubStats now
  splits trackedPublishers and the copy adapts. (3) Cap-honesty "Showing
  the top 40" line on hubs past HUB_PAGE_LIMIT. (4) ItemList schema no
  longer declares more items than it emits (top-100 declared 100, listed
  30). (5) Story pages now link their topic HUBS in the "In this story"
  rail — the crawl path from indexed pages into the hubs.
- **Fix B reframe (per red team):** "Discovered — currently not indexed"
  means Google has NOT FETCHED the page, so on-page content cannot flip it
  directly; the hub coverage snapshots are quality hygiene on a 4-8 week
  horizon. The actual constraint is CRAWL DEMAND on a young domain — hence
  the story→hub links. **Scheduled decision (weekly run, ~Sep 22 = 4
  weeks):** if hubs are still unfetched, consolidate the 15 hubs into the
  strongest 6-8 and 301 the rest — 15 keyword-filter pages over one
  ~750-cluster corpus is a doorway-adjacent shape Google may simply be
  right about. MIN_CLUSTERS_FOR_INDEX=3 is too low a bar for "hub".
- **Measurement (replaces the naive CTR bar):** the multi-source
  description cohort (sourceCount≥2, identifiable retrospectively) is
  compared against its own pre-2026-08-25 CTR at the 2- and 4-week marks;
  hub progress is measured by URL-Inspection bucket transitions
  (not-crawled → crawled → indexed) in data/gsc-indexation.json, run to
  run. /story/* aggregate CTR is NOT a success metric — it was 1.32%
  before the change.

**THE DECLINE, ROOT-CAUSED WITH DAY-LEVEL DATA — 2026-08-25 (first
data/gsc-daily.json pull).** The owner's "we are losing performance" is
confirmed and explained. Daily web series: impressions climbed to a peak of
438 (Aug 16) and clicks to 6 (Aug 19, position ~21). **On Aug 20 — the
first full day of the Neon egress outage — impressions collapsed 410 → 93
(-77%) in one day**, then 72/55/41/47, while average position exploded
21 → 50 → 69 → 71 → 80. That is Google fetching 5xx story pages and
demoting the site, not seasonality. The Aug 24 402 outage reinforced it.
No unexplained component: every declining day is annotated by the incident
ledger. **The active poison found and killed today:** the ~211 stories
whose archive rows were never written during the outage still answered a
permanent retriable 500 (the batched-write unavailable shield has no time
bound) — with a healthy database, verified live 2026-08-25. Fixed by
tombstoning: data/lost-stories.json (205 ids) + isLostStorySlug() in
story-resolution.ts answers an honest 404 in every archive state; tests in
archive-outage.test.ts. Recovery expectation (honest): crawl-trust dips of
this kind take 2-6 weeks of consistent 200s to unwind; the daily series +
incident ledger now measure it without owner involvement.

**360° checklist audit 2026-08-24** (`seo/CHECKLIST-360.md` is the verdict
map — consult it before re-investigating any "have we considered X"): three
queued adoptions — (a) Google Preferred Sources: owner checks whether
currentwire.us can be selected (Google app/search settings), then the site
adds the preferred-source button near the header/footer [owner ~5 min +
automated]; (b) IndexNow pings for UPDATED and MERGED story URLs, not just
new ones (pair with the cron's per-slug revalidation list); (c) image
sitemap — deferred until the new GSC "image" surface (shipped) shows real
Google Images impressions.

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

### 0c. The archive write burst was firing a few times a day, not twice an hour — SHIPPED 2026-08-27 (`e1b4cfb`, `ab2ac21`, `c88e8ab`)

**The most expensive kind of failure this site can have: every public
surface healthy, and nothing being kept.** Found 2026-08-27 by reading the
newest `<news:publication_date>` in `/news-sitemap.xml` (that date is the
archive's `first_seen_at`, so it dates the last successful database write)
and confirming against `/api/stats/archive-sources`:

| day | last archive row | dry for | news-sitemap |
|---|---|---|---|
| 2026-08-26 | `07:31:39Z` | **14 h** | 643 -> **132** entries, newest 14.4 h old |
| 2026-08-27 | `07:00:30Z` | **10 h** (and counting when found) | 254 entries, newest 10.1 h old |

Both days show the same shape: a cluster of bursts between 03:00 and 07:00
UTC (Aug 27: `03h:693 04h:26 05h:16 06h:18 07h:10` rows), then nothing.

**What each stalled hour costs.** A story with no archive row has no
permanent home: when it ages out of the 72 h live dataset its URL answers
the deliberate retriable 500 and eventually joins `data/lost-stories.json`.
Six were already there on 2026-08-26 (`unavailable 500` in the survival
probe). This is the exact mechanism that permanently lost 205 stories in the
2026-08-20 outage and cost 77% of impressions. It also starves Google News
(the sitemap gate) and silences IndexNow (pings only happen inside a burst).

**Root cause — three layers, each found by fixing the one above it.**

1. `app/api/cron/news-refresh/route.ts` returned EARLY whenever the dataset
   was younger than `RSS_REFRESH_MINUTES`, so `shouldPersistNow()` was only
   ever consulted on ticks that also refreshed.
2. `lib/database/persist-gate.ts` opened the gate, on a cold instance, only
   in minutes 0-4 and 30-34 — a window narrower than any beat above five
   minutes is guaranteed to catch.
3. **Nothing was calling the endpoint at all.** `vercel.json` carried one
   daily `0 6 * * *` cron (a Hobby-plan artifact — that tier allows a single
   daily cron) and the 5-minute beat the code is written around came from an
   EXTERNAL scheduler that no longer reaches production. Measured after
   layers 1-2 were already fixed and deployed: the dataset sat unchanged
   from 18:23:52 to 18:48:53 against a 15-minute refresh interval, zero
   archive rows were written after 17:43, and 11 of the 50 stories in `/rss`
   had no archive row. With no beat, the burst could only fire when traffic
   happened to regenerate the cache inside the persist window — which is the
   entire 03:00-07:00 pattern: a wandering coincidence, never a schedule.

**Fixed:** the cadence guard skips the REFRESH only, never the burst; the
cold window is caller-aware (cron half the cycle — `persist-gate.test.ts`
proves exhaustively that any beat <= 15 min lands in one; producer stays on
minutes 0-4/30-34 because it runs on cache-missing traffic and the wide
window made it write in 12 distinct minutes of one window); and the site now
has its own quarter-hourly Vercel cron, `0,15,30,45 * * * *`, whose ticks
land on minutes 0 and 30 inside the window. 96 invocations/day against the
288/day a 5-minute beat implies — below the cost the code was written for,
and the ~2 bursts/hour (~48/day) the ISR comment already assumes.

**Verified live, in two stages:**

```
17:32  news-sitemap 228 entries, newest 07:00:30Z (631 min old)
17:37  news-sitemap 715 entries, newest 17:35:48Z (1 min old)   <- gate fix
       530 rows written in the 17:00 hour; today 763 -> 1,293 archived
18:48  archive rows since 17:44: 0                              <- no scheduler
18:54  c88e8ab deployed, Vercel cron registered
19:00  109 rows written on the minute-0 tick                    <- scheduler fix
19:07  50 of 50 stories in /rss have an archive row (was 39/50)
19:00 / 19:31 / 20:00  109 / 41 / 39 rows — the cadence, three bursts running
```

**Detection shipped with it** (a stall was invisible to every existing
check: URLs 200, dataset fresh, sitemap over the 50-entry floor):
`.github/workflows/uptime.yml` and `scripts/seo-health.mjs` now fail when
the newest news-sitemap publication date is over 4 hours old. The uptime
probe reuses the sitemap it already downloads — no extra request, no
database read.

### 0d. The url-survival gate had gone permanently red on the site's own tombstones — SHIPPED 2026-08-27 (`e1b4cfb`)

`[auto-alert]` **#4**, opened 2026-08-26 07:31 UTC: *"FAIL: 212 previously
published URL(s) return 4xx — the published URLs never 404 guarantee is
broken"*. Reproduced locally against production, then checked id by id:
**all 212 URLs map to exactly the 205 cluster ids in
`data/lost-stories.json`** (7 are renamed slugs of the same ids) — the
deliberate 404s this loop shipped on 2026-08-25 to stop those stories
serving a crawl-poisoning 500. Zero unexplained 404s.

So the gate was failing every night for the site behaving exactly as
designed, which is the same defect the GONE/LOST split was written to
prevent, arriving from a third side. `classifyResults()` now has a
**TOMBSTONED** class: a 4xx whose cluster id is listed in
`data/lost-stories.json` is reported and does not fail the build. Any other
4xx still fails; a 5xx on a tombstoned id is still an outage; and tombstones
are excluded from `RUN_HEALTHY_SHARE` entirely so a growing list can never
suspend LOST classification for unrelated 5xx. Six new unit tests.

### 1. A stale cached redirect can pair with a fresh one and form an infinite loop — SHIPPED 2026-08-28 (`9dc666f`), verified live

**Fixed by re-rendering the slug each rename retires.** The burst already
reads the archive per cluster id, so the rename is free to detect:
`readArchivedClusterSlugs()` returns the stored slug per id (and
`findNewClusterIds` is now derived from it — one query, both answers),
`archivePublicDataset` records the slug each upsert retires, and the cron
burst calls `revalidatePath('/story/<retired slug>')` for each. The frozen
307 is purged at the moment the slug becomes an alias, so it can never
outlive its target; a two-way flap re-renders both sides, so neither can
freeze pointing at the other. 8 new unit tests, including the flap and the
"archive did not answer" case.

**Measured before writing code, because the fix is only worth it if renames
are common: 5 of 178 archived live stories were slugged differently in the
live dataset than in the archive at one instant**, and across the 22:00 UTC
burst **8 of ~690 news-sitemap stories were renamed in 32 minutes** (~15/h).
Headline flapping is the normal case, exactly as this item said.

**Live verification** — every one of those 8 retired slugs, probed right
after the burst:

```
307 age=0   MISS         -> current canonical OK   (x6)
307 age=0   REVALIDATED  -> current canonical OK
307 age=752 STALE        -> current canonical OK
```

Not one frozen `HIT` pointing at an outdated slug, and no loops:
`scripts/seo-health.mjs`, which chases every news-sitemap URL hop by hop,
passed. (`MISS` alone cannot distinguish "purged by the burst" from "never
cached"; the `REVALIDATED` row is the one that shows the entry existed and
was marked.)

Cost: single digits per burst against the 150 canonical revalidations the
same burst already performs, and only when a headline actually changes.

The original analysis follows, unchanged.

#### Original finding (2026-08-26)

**Found 2026-08-26 by `scripts/seo-health.mjs`, which had been reporting it
as an unreadable `TypeError: fetch failed`.** One of 643 news-sitemap URLs
307-redirected to a second slug of the SAME cluster, which 307-redirected
straight back:

```
/story/multiple-people-dead-including-kids-in-shooting-and-fire-at-montana-home-c73a14a645aa9
  <-> /story/multiple-people-killed-in-shooting-at-montana-home-also-set-on-fire-officials-sa-c73a14a645aa9
```

Traced by hand: A -> B -> A -> B for as many hops as were followed. A
crawler never reaches a page. This was live on **`/news-sitemap.xml`** — the
feed Googlebot-News fetches within minutes of publication and judges as a
whole — which makes it strictly worse than the item-3 staleness.

**Root cause, measured from cache headers rather than inferred:**

| URL | `Age` | `X-Vercel-Cache` | redirects to |
|---|---|---|---|
| slug A | **17,547 s (~4.9 h)** | HIT | slug B |
| slug B | 325 s (~5 min) | HIT | slug A |
| `/story/c73a14a645aa9` (fresh) | — | **MISS** | **slug A** |

The fresh render says the canonical slug is **A**, so B is behaving
correctly. A is a **stale cached redirect frozen ~5 hours earlier**, when the
lead headline — and therefore the canonical slug — was B. Cluster slugs are
rebuilt whenever `pickLead()` re-selects the lead, so a headline that flaps
back and forth is the ordinary case, not an edge one. Observed twice in one
session: the `mike-lindell-...` pair swapped direction between two health-check
runs minutes apart.

**Why the stale entry survives so long, and this is the part to fix:**
`resolveStoryRequest` returns `{ kind: "redirect" }` from the live branch
*before* any tagged data read, so the redirect response carries no
`NEWS_CACHE_TAG`. `forceRefresh()`'s `revalidateTag(NEWS_CACHE_TAG, "max")`
therefore never invalidates it, and it inherits the 30-day `/story/[slug]`
segment TTL from item 0b. A redirect can outlive by weeks the slug it points
at; pair one with a fresh redirect pointing the other way and the result is a
permanent cycle.

**The instance is cleared, by accident of deploy.** Pushing `9fd5991` wiped
the ISR cache (every deploy does — item 0b), and slug A came back as **200
`age 3`** with B correctly 307ing to it. Verified live. **That is a symptom
cure, not a fix:** the next headline flap re-creates it, and the next wipe
happens whenever someone deploys.

**Shipped this run: detection only** (`9fd5991`). `seo-health.mjs` now chases
the chain hop by hop instead of using `redirect: "follow"`, so a cycle
reports itself as `REDIRECT LOOP` naming both URLs, and retries once on a
genuine transport error (each attempt gets a fresh timeout signal). The check
went green after the loop cleared, so it tracks reality in both directions.

**Deliberately NOT fixed this run**, for the reason item 3 gives: this is the
story-resolution + ISR path that produced `d060817` and `f757bba`, and the
candidate fixes all touch the ISR cost controls the playbook protects as a
hard constraint. Candidates for a run that can design and review it:

- give redirect responses a short TTL (or the `NEWS_CACHE_TAG`) so a stale
  redirect cannot outlive its target — the cheapest correct fix, but it adds
  ISR writes on the long tail and must be costed against item 0b;
- make the redirect target authoritative rather than snapshot-derived: store
  the canonical slug per cluster id at persist time and redirect only to
  that, so two renders can never disagree;
- have the news-sitemap generator advertise only self-canonical URLs (it
  already gates on archive standing), which contains the damage on the one
  surface that matters most without touching resolution.

### 2. 214 published stories permanently gone — CLOSED 2026-08-25: tombstoned, now clean 404s

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

### 3. Surface coherence: a live story can serve a stale archived copy

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

### 4. `/source/<slug>` hubs carry no durable per-publisher facts — SHIPPED 2026-08-25, verified live

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

**SHIPPED 2026-08-25 as `7457912`, verified on production after deploy.**
`lib/news/source-profile.ts` computes the facts from the dataset already in
memory (no new IO, no added ISR cost — the `hubStats` contract), and
`/source/[slug]` renders them as a coverage-profile block. Live evidence,
fetched after the deploy landed:

```
/source/bbc-news
title  BBC News — coverage and corroboration | CurrentWire   (was "… — Latest stories")
desc   BBC News coverage: 33 stories in the current window, 5 also carried by
       other publications, each linked to the original reporting.
words  870 -> 1040
schema CollectionPage, about={"@type":"Organization","name":"BBC News",
       "url":"https://bbc.com"}, publisher=CurrentWire,
       numberOfItems 30 = 30 emitted
```

The rendered profile on that page: *"In the current snapshot CurrentWire is
tracking 33 reports from BBC News across 33 stories published over the past
33 hours. 5 of them are also carried by at least one other publication
CurrentWire ingests, and BBC News is the account this site leads with on 33.
The most widely corroborated is … carried by 5 publications. Across the
corroborated stories, the publication reporting the same stories most often
is The Guardian (2 shared). Sections filed in: General (11), World (7),
Sports (4), Business (3), Health (3), Politics (3)."*

**The editorial position is unchanged and is now stated on the page**: the
tier links to `/methodology/publisher-tiers` and the copy says in words that
CurrentWire publishes no bias or factuality rating. `collectionPageSchema`
refuses any rating property on the `about` node, and `publisher` stays
CurrentWire — an e2e test asserts both directions, because markup naming the
publisher as the page's publisher would misrepresent who wrote it.

Thin hubs are unaffected by design: `/source/reuters` and
`/source/associated-press` have no stories in the window, so they render no
profile block at all and stay `noindex, follow` (both verified live, 200).

Guards: `tests/unit/source-profile.test.ts` (12) and
`tests/e2e/source-hubs.spec.ts` (4).

### 5. Story pages have no outbound topic links — IMPROVED 2026-08-25, still open

Measured on 12 live stories sampled across `/news-sitemap.xml`: outbound
`/story/` links **median 4, zero on none of them** (the 2026-08-19 "More in
{Category}" rail is holding — it was zero on 39 of 40 on 2026-08-18). Outbound
`/topic/` links are **median 0, absent on 9 of 12**.

Unchanged for a third week, so it keeps its rank. Topic hubs are exactly the
surface that needs inbound links: 40 sit in `sitemap.xml` and they flip
indexable as they accumulate stories.

**RE-MEASURED 2026-08-25 on 5 live stories sampled across
`/news-sitemap.xml`: outbound `/topic/` links are median 1, present on 3 of
5** (1, 0, 0, 4, 1), against median 0 and absent on 9 of 12 the day before.
`674502f` — the "In this story" hub rail — did move it, so the item is no
longer "unchanged"; it stays open because 2 of 5 stories still carry none,
which is what happens when a story matches no hub vocabulary. Small sample:
5 stories, not 12. Re-measure on a wider sample before claiming a trend.

Two smaller story-template defects measured alongside it, same sample:
**9 of 12 titles exceed 60 characters** and **4 of 12 meta descriptions still
end mid-sentence** (53% on 08-18, 23% after the formatter fix, 25% on 08-22).
The description residue is summaries whose first sentence alone exceeds the
limit — a summarizer input-length question, not a formatter bug.

**RE-MEASURED 2026-08-26 on 40 story pages sampled through
`/news-sitemap.xml`, and it is much worse than the 25% recorded above:
17 of 40 (43%) meta descriptions end mid-sentence**, and **34 of 40 (85%)
titles exceed 60 characters**. Both sit on the story pages, which are the
site's only indexed, click-earning surface, so this is squarely the
Sprint-2 CTR question.

**A clause-boundary fallback was built and measured against real inputs, and
is NOT recommended as-is.** `NewsArticle.description` in the page JSON-LD
carries the FULL summary while the meta tag carries the clipped one, so 49
real summaries were harvested as an evaluation corpus (22 over the 155-char
limit — 45%, matching the live rate). Cutting at the last clause boundary
(`,` `;` `:` em/en dash) that keeps >=50% of the budget, instead of
mid-phrase, changed **only 2 of 49** and cost ~60 characters of snippet on
both:

```
BEFORE [155] (The Conversation) — Thai Buddhism involves daily rituals and collective
             acts of worship, unlike the individual-focused emphasis on meditation often found…
AFTER  [ 89] (The Conversation) — Thai Buddhism involves daily rituals and collective
             acts of worship…
```

Cleaner, but 4% coverage for a third of the snippet is not obviously a CTR
win and should not be sold as one.

**The real mechanism, visible in the corpus and not previously recorded:** a
large share of the clipped descriptions are an RSS standfirst concatenated
to the article body **with no punctuation between them**, so the sentence
splitter finds no boundary at all and the whole thing is one oversized
"sentence":

```
…as US requests extradition FBI agents raided the Ibiza, Spain…
…smoke reaching Malaysia and putting Singapore on alert Suwadi…
…will harm smaller grocers A New York City business group sued…
```

That is a summary-construction defect (clustering sets
`summary = lead.description`), not a formatter one, and it degrades the
visible page copy as well as the meta tag. Detecting the junction is the
hard part — the obvious "lowercase word followed by a capitalised word"
heuristic false-positives on ordinary mid-sentence proper nouns
("reaching Malaysia and"). Needs design; filed here rather than guessed at.

### 6. `general` is the largest section for three tier-A publishers — NEW 2026-08-25

**Surfaced by the source-hub profile shipped this run, then corroborated
independently.** The "Sections filed in" line on the new `/source/` hubs
reads the cluster category of every story a publisher filed in the window:

| Source hub | Top sections (live fetch, 2026-08-25) |
|---|---|
| `/source/bbc-news` | **General (11)**, World (7), Sports (4), Business (3), Health (3), Politics (3) |
| `/source/cbc-news` | **General (17)**, Politics (10), Business (4), Culture (1), Health (1), Science (1) |
| `/source/the-guardian` | **General (11)**, World (9), Politics (7), Climate (6), Business (4), Sports (3) |
| `/source/npr` | Business (5), Politics (5), Climate (4), Culture (4), General (4), Health (3) |

Corroborated on a separate probe that did not use those pages: 22 story
pages sampled at even intervals through `/news-sitemap.xml`, read from their
`NewsArticle.articleSection` — **3 of 22 (14%) are `General`**, and
`/general` itself lists 27 stories. One is plainly misfiled:
`https://currentwire.us/story/settler-attacks-threaten-the-west-banks-final-christian-village-cd6dbaa9e7839`
serves `articleSection: "General"` and is a World story by any reading.

**Why it is an SEO problem and not just untidy.** `/general` is
`noindex, nofollow` on purpose — it is the internal low-confidence bucket
(recorded under "Known and accepted"). A story routed there therefore
appears on **no indexable category page at all**: it loses the category
listing, the category's internal-link path, and the topical grouping that
`articleSection` is supposed to give it. The playbook ranks wrong categories
as a data-quality defect precisely because they poison category relevance;
this is the same defect, one step worse, because the destination is
deliberately invisible.

**Not fixable from templates**, per the playbook's rule that classifier
defects are engineered upstream: the fix belongs in `lib/news/` with
benchmark coverage (`data/benchmark-history.json`, 313 validated stories),
not in a page component. What a future run needs first is the **share over
time** — one day's fetch cannot say whether 14% is the designed
low-confidence rate or a regression. The source hubs now publish that share
continuously, so it is measurable without new tooling.

Ranked below item 5 only because the measurement is one day old; if the next
run reproduces `General` as the top section for tier-A publishers, it
outranks everything except an outage.

**REPRODUCED 2026-08-26 — and the framing above is now corrected in two
directions. Read this before acting on the item.**

*The share is real and larger.* 40 story pages sampled at even intervals
through `/news-sitemap.xml`, read from `NewsArticle.articleSection`:
**9 of 40 (23%) are `General`** — tied with Sports as the largest single
section, against 3 of 22 (14%) the day before. Nearly all nine are plainly
misfiled by any reading: an Artemis II livestream story, a European rights
court ruling on Turkey, a Montreal airport death, two Dolly Parton pieces,
a Buddhism explainer.

*But 23% is BELOW the designed rate, so this is NOT a regression.* The
313-story validated benchmark in `data/benchmark-history.json` records
`realGeneralCount: 109` of 313 — **34.8%**. Re-running `classifyCategory`
over `data/local/real-stories.json` + `truth.tsv` this run reproduces the
recorded figures exactly: **73.2% exact, 5.4% wrong-specific, 110 general
(35.1%)**. The live 23% is the designed precision-over-recall contract
operating normally, not something that broke. **Do not open this as a
regression again without comparing against 35%.**

*What IS worth fixing, quantified:* of those 110 general verdicts, the human
truth set labels only 43 genuinely general — **67 of 313 (21%) are stories a
reviewer gave a specific category and the classifier routes to a noindex
bucket.** Split by the guard that produced them:

| Path to `general` | misroutes | top score would have been correct |
|---|---|---|
| nothing scored at all | 28 | 0 |
| below `MIN_PRIMARY_SCORE` | 29 | **18** |
| exact tie | 10 | 4 |

**REFUTED this run — do not resurrect it: relaxing the ambiguity guard.**
Four variants were simulated against the truth set (sole-scorer-wins,
`MIN_PRIMARY_SCORE` 2 -> 1, clear-margin-wins, and a world-excluded
variant). Every one buys ~2 points of exact accuracy and **roughly doubles
wrong-specific errors, 5.4% -> 9.3-11.2%**. That is the wrong trade here and
the asymmetry is the reason: a `general` verdict only *withholds* a story
from a category page, while a wrong specific verdict *actively publishes* it
onto an indexable one. The playbook ranks wrong categories as the defect
that poisons category relevance.

**Keyword patching was also tried and rejected.** Mining the truth set for
terms concentrated >=85% in one category and present in >=2 misroutes returns
almost entirely one-news-cycle proper nouns — "uss abraham lincoln", "selena
gomez", plus spurious stopword hits like "don" and "long". Adding those
overfits a 313-story snapshot. The only durable candidate surfaced was
`israeli` -> world (3/3).

**Severity re-measured, and it is narrower than "invisible" but real.** All
nine live `General` stories were checked against all 14 indexable section
pages: **7 of 9 appear on no indexable category page at all**; 2 are rescued
because `CategoryResult.all` keeps the tied runners-up and
`getCategoryData()` lists them in the `related` rail
(`lib/news/queries.ts:592` selects `c.lead.categories.includes(category)`).
The story pages themselves stay `index, follow` and keep earning — the loss
is the category listing and its internal-link path, not the story.

**New finding, and it cuts against the guard's own purpose.** That same
`all` rail means an ambiguity-rejected candidate still reaches an indexable
page. The Dolly Parton *philanthropy* story is listed on **`/health` and
`/science`**. So the guard protects `articleSection` while leaking the very
categories it rejected onto the category pages it was meant to protect.
Whether the `related` rail should read `all` at all is a real design
question and is the most promising thread here — it is cheap, it is
template-adjacent rather than classifier-deep, and it needs no accuracy
trade.

*The honest summary for whoever picks this up:* the cheap fixes are measured
and refused. Real movement needs either better signals (the shadow
`local-minilm` hybrid at 78.3% exact is the existing candidate, already
measured in `tests/shadow/`) or a decision about the `all` rail — not a
threshold nudge.

**THE `all` RAIL IS DECIDED AND SHIPPED 2026-08-28 (`015e2b9`), verified
live.** The "most promising thread" above was right, and the live leak was
far larger than the 2026-08-26 sample suggested.

*Measured on production BEFORE the fix* — 9 category pages, their "Related
coverage" rails read, then every listed story fetched for its real
`NewsArticle.articleSection`: **all 9 pages were leaking, 24 general-bucket
placements across 54 rail slots.** `/health` was the worst — **6 of 6** rail
slots were general-bucket stories, including "Talking Shop with Kelly
Rowland". The double-placement mechanism is visible in the data: one Jemima
Kirke fashion interview sat on `/culture` AND `/politics`; one emission study
on `/science` AND `/world`; one Maui wildfire story on `/health` AND
`/climate`. A two-way tie lists the story on both pages and at most one can
be right.

*Measured against the 313-story truth set:* the tie path produced **40
category-page placements, 31 of them (77.5%) not matching the human label**.

*The fix, at the source as the playbook requires.* In
`lib/news/classification/category.ts` the ambiguity guard now returns
`all: ["general"]` on every path; the tied ids move to a new
`rejectedCandidates` field that is diagnostics-only and routes nothing.
`getCategoryData` additionally refuses any general-bucket cluster in the
rail, because ~10,000 archived articles still carry `categoriesAll` computed
under the old rule and the invariant should not depend on data vintage.

*Accuracy is untouched, because `primary` is untouched* — re-run this run
over `data/local/real-stories.json` + `truth.tsv`: **73.2% exact, 5.4%
wrong-specific, 110 general (35.1%)**, reproducing the recorded benchmark
figures exactly. Leaked placements **40 -> 0**. Three new tests pin it
(`tests/unit/classification.test.ts`) plus a queries-level invariant in
`tests/unit/category-integrity.test.ts`, whose synthetic dataset already
reproduced the leak and now fails without the guard.

*What this does NOT fix, stated plainly:* the 67-of-313 misroute rate that
sends specific stories to a noindex bucket is untouched — this closes the
leak in the other direction (rejected categories reaching indexable pages),
which is the half that was actively publishing wrong signals. The remaining
half still needs better signals, not a threshold nudge. **Item 6 stays OPEN
for that reason.**

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

- **The Playwright suite is flaky under its default worker count — IT
  RECURRED, and it is load, not a site bug.** Logged on 2026-08-24 as "a
  one-off 500 on `/`" with the note *"if it recurs, it is real"*. It
  recurred. Measured 2026-08-25 across **five full runs** of the same
  unchanged tree: three failed and **each failed a DIFFERENT test** —
  `seo.spec.ts` "the sitemap lists the reference pages", `briefing.spec.ts`
  "/briefing serves today's briefing", `top-10.spec.ts` "the internal general
  bucket has no top-10 page" — and **every one of them passed when its own
  spec was run alone** (38/38, 10/10, and the suite green twice at 111
  passed). A run at `--workers=2` was also green. A failure that moves to a
  different test on every run, and disappears when the same tests run with
  less concurrency, is the harness saturating, not a defect in any of those
  pages.

  Two consequences worth keeping. (1) **The gate is noisy**, so a single red
  Playwright run is not evidence of a regression — control-run it, as
  `MEMORY/2026-08-18-daily-and-weekly-loops-collide.md` says. (2) **Pinning
  workers in `playwright.config.ts` is the obvious fix and is NOT ranked
  work yet**, because the failure detail was never captured: the artifacts
  were wiped by the passing re-runs before they could be read, so whether
  these are 500s or timeouts is still unknown. Capture that first — a
  config change that hides an intermittent 500 would be the worst possible
  outcome.
- **RESOLVED 2026-08-26: the `url-survival` LOST fix is proven in CI.** The
  2026-08-25 07:10 UTC run is `success` (16 min), the first run to exercise
  `c124d70`, and `[auto-alert]` issue #1 is no longer open — only #2
  (surface coherence) remains. Original note follows.

- **The `url-survival` LOST fix has not yet been proven in CI.** The last
  two workflow runs are `failure` (2026-08-23 07:03 UTC, 2026-08-24 07:30
  UTC) and both predate `c124d70`, which shipped later that day. The fix was
  verified by running the script against production (`GONE=0 UNAVAILABLE=0
  LOST=214`, exit 0), so the code is known good; what is unproven is the
  workflow. The 2026-08-25 run is the first that exercises it — check it,
  and only then consider closing `[auto-alert]` issue #1.

- **`/archive-sitemap.xml` grew 2,169 -> 5,891** in two days while the ledger
  gained ~450-700 URLs/day. Consistent with the feed-list expansion (98 feeds)
  plus the thin-story policy's 72 h/2-source/history rule admitting more
  stories, but the arithmetic was not reconciled this run. The health check
  fails above 45,000, ~5,000 short of the 50,000 cap, so the ceiling is
  guarded. **Re-measured 2026-08-25: 6,658** — +767 in one day, which is
  ordinary ledger growth (450-700/day) and NOT a continuation of the
  doubling. The 2,169 -> 5,891 jump was the outage recovery refilling the
  archive, not a runaway. Keep watching, but the alarm is downgraded.
  **2026-08-26: 8,036** — +1,378 in one day, roughly double the 450-700/day
  ledger rate and the second-largest single-day jump recorded. Not yet
  reconciled against feed growth. The health check still fails above 45,000,
  so the cap is guarded, but at this rate that is weeks not months: worth an
  arithmetic reconciliation on the next weekly run.
- **Publisher image weight drifted up, then came back.** `seo-health`
  passes. 2026-08-24: 15 images, 1,503 KB, median 52 KB, **max 448 KB**.
  **2026-08-25: 15 images, 1,410 KB, median 74 KB, max 235 KB** — the
  448 KB outlier is gone, so it was one host on one day, not a trend.
  Becomes work if the max crosses 500 KB (which fails the check for capped
  hosts).
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
