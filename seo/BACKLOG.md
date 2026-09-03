# SEO Backlog

> **PRECEDENCE, for the scheduled runs.** This file now carries several dated
> blocks, each with its own list. They are NOT alternatives — read them in this
> order and the first one that speaks wins:
>
> 1. **REPAIR SESSION 2026-09-04** (immediately below) — the current work
>    queue is its "NEXT, IN THE RELEASE-RISK REVIEW'S ORDER" list, and its
>    "VERIFIED NOT A DEFECT" list is binding: do not re-open those.
> 2. **STRATEGY SHIFT 2026-09-01** — the strategic frame (Google is a
>    background re-earn; Bing/AI, owned audience, distribution and speed carry
>    the next six weeks). Its 1-6 list is superseded on ordering by (1) but
>    still governs WHY an item matters.
> 3. **PRIORITIES REBUILT 2026-08-31** and everything below it — the standing
>    record. Its verdicts hold unless a later block overturns them; several are
>    refutations that cost a full run each, so read before re-opening anything.
>
> The single rule that outranks all of the above: **do not create a new
> problem while fixing an old one.** Verify the outcome, never a proxy; test
> the boundary a change moves; never claim a fix without evidence from the
> same run.

**REPAIR SESSION 2026-09-04 (owner: "get everything fixed... do not create
more problems while fixing the existing ones"). Everything below is verified
against production or against a reproduction, never against a write-up.**

SHIPPED AND VERIFIED:
1. `8a32620` — four monitoring defects. The [auto-alert] #9 false alarm
   (a build the ignoreCommand SKIPS writes no deployment record; the silence
   rule read that as a dead integration and sent the owner to read a log of a
   build that never ran). The watch now judges the newest CODE-CHANGING commit
   via git, using a mirror of the ignore script's pathspecs guarded by a
   drift test. **A bug this fix introduced was caught in verification before
   shipping**: git emits the commit date in the committer's offset while
   GitHub emits UTC, and the rule compared them as strings, which inverted the
   verdict on real data — both ends fixed, pinned by a test. Also: exit 2
   (could-not-check) no longer goes red like exit 1; the lost-push race that
   was discarding a url-survival/surface-coherence measurement per day; the
   anti-auto-disable guard extended from 3 of 9 workflows to all 9 from two
   mutually-protecting workflows. Verified: deploy-watch run #7 success, zero
   open auto-alert issues.
2. `b8e33e7` — four wrong figures corrected, including one asserted in code
   (`seo-health.mjs` claimed sharding was "years away ... ~5,000 URLs of
   runway"; it is weeks). See the correction block on the growth item below.
3. `26b3148` — three on-page defects:
   - **Story meta descriptions collapsing to 2-9 characters.** Leading
     abbreviations ("U.S.", "Rep.") break the sentence regex so it starts
     mid-token. Reproduced exactly, then fixed by asserting prefix + substance
     invariants rather than guessing an abbreviation list. All 8 pre-existing
     assertions untouched; 4 new tests.
   - **The LCP element started at opacity 0.** `.section-in` on the homepage
     hero section meant Chrome would not name it as LCP until the fade
     finished. **Measured PSI-to-PSI (never mixed with the local Playwright
     probe): before 5,951 / 6,052 / 6,720 ms; after 3,030 / 4,127 ms — every
     after-run faster than every before-run; score 71/71/58 -> 84/74.** Still
     above the ~2,500 ms Discover threshold, so this item stays open.
   - The archive sitemap's silent 50,000 truncation now logs.
4. Stale 10-day-old git worktree removed (was polluting lint and grep). It was
   clean with no unique commits — checked before removing.

VERIFIED **NOT** A DEFECT — do not "fix" these:
- Trust-page masthead showing a stale date. It is a Client Component using
  America/New_York; a real browser renders it correctly and it matched ET
  exactly when checked. Only `curl` (no JS) sees the build-time value.

NEXT, IN THE RELEASE-RISK REVIEW'S ORDER (do not reorder without re-reading
its interaction list):
- Hub/report description literals over 160 chars (unasserted, low risk).
- Briefing description ceiling — BLOCKED until a headline-preservation test
  exists; as specified it is a measured production break.
- Story `<title>` clamp — deliberately last of the copy set, no measured loss.
- Classifier: instrument `generalOrphanPct` first, then hub vocabulary
  (a TAG, cannot change `articleSection`). Singleton category inheritance is
  LAST and blocked on narrowing the `history` clause.
- Archive sitemap: **shard routes additively first**, while the flat urlset
  still serves; flip `/archive-sitemap.xml` to a `<sitemapindex>` and rewrite
  the seo-health assertion in ONE commit. **Do NOT use Next's
  `generateSitemaps`**: it binds only to the `sitemap.(js|ts)` convention,
  forces `/.../sitemap/[id].xml`, and its generated wrapper hardcodes a 200
  with `must-revalidate` — there is no path to the 503 + Retry-After outage
  contract this route gained after 2026-08-21.
- `/publishers` + disclose the `WEEK_ROWS_LIMIT` cap currently published as a
  story count on /reports/media-coverage.

**NEW FINDING 2026-09-04, FIXED THE SAME RUN — the Bluesky poster shared one
story twice because a rewritten headline gives it a new URL.** The daily
channel check read the live feed and found
"Gloria Steinem, trailblazing journalist and activist, dies at 92" (11:27 UTC)
and "Feminist icon Gloria Steinem dies at 92" (16:33 UTC) posted five hours
apart. They are ONE story: both URLs end `-c6f6dcadc62b0`. Dedup is stateless
and reads the account's own feed, but it compared **URL strings**, and a story
slug is derived from its headline, so a rewrite reads as a new story. Costs a
slot out of the ~8/day ceiling and shows followers the same story twice.

Fixed by keying the ledger on the cluster id (`dedupKey` in the new
`scripts/bluesky-post-lib.mjs`) — the same fix `archiveRowCacheKey` made for
the archive row cache on 2026-09-01, resting on the same verified property:
every published story slug ends with its own cluster id. A URL with no
well-formed token keeps its normalised URL as its key, so section pages and
external links behave exactly as before. Five tests, including a drift guard
that parses `CLUSTER_ID_RE` out of `lib/database/archive.ts`, because the
poster runs under plain node in CI and cannot import the TypeScript module.

**Not yet verified live** — the proof is the absence of a duplicate over the
next rewrite, so the next run should re-read the feed rather than assume it.

**NEW FINDING 2026-09-04 (daily crawl sample) — the classifier ignores the
source article URL, which is the highest-precision free signal available.**
`lib/news/classification/category.ts` reads headline and description text only
(grep: the file contains no reference to a source URL). Publishers put their
own section in the path, and it is editor-assigned rather than inferred.

Unambiguous case, live now:
- <https://currentwire.us/story/alternative-transfer-awards-left-on-the-shelf-best-bargain-hunters-top-data-pick-c121fa07b0722>
  `articleSection` = **Culture**. Its only source is
  `espn.com/**soccer**/story/...` and the piece hands out football transfer-window
  awards. The text-only vocabulary sees "awards", "trophies" and "left on the
  shelf" and lands in Culture; the word soccer never appears in headline or
  description, so the sports keyword list at config/categories.ts:294 cannot
  fire.

Probable second case: <https://www.theverge.com/**tech**/988648/ugreen-magflow-pro-magnetic-wireless-power-bank-10k-liquid-cooling>
(a gadget review) is filed **Business**.

**Rate, stated honestly.** 38 stories sampled from the news sitemap; 10 carried
a recognisable section token in a source URL; 4 of those disagreed with our
section. Only 2 of the 4 are defects — the other two are an Nvidia/Hugging
Face acquisition and an AI-in-schools ban, where business and technology are
both defensible, and multi-source stories legitimately span sections. So this
is roughly a 5% defect rate on a 38-story sample, which is a signal to
investigate, NOT a measured site-wide rate.

**Where the fix goes:** `lib/news/` with benchmark coverage, never the
templates. Treat the URL path as one weighted signal, not an override — a
publisher section is a hint about the desk, not about the story, and
`/news/` or `/2026/09/` paths carry nothing. Build the labelled set from URL
paths first and check it against the existing classification benchmarks before
changing any weight. Sits with the other classifier items above, AFTER
`generalOrphanPct` instrumentation, because the same measurement harness will
tell us whether this is 5% or 0.5% of the corpus.

**CHANNELS SESSION 2026-09-01 (owner clicking, live-verified): items 3, 4
and 5 of the shift queue below are DONE or resolved.**
- **Bluesky: LIVE end-to-end.** @currentwire.bsky.social (login
  support@currentwire.us), profile + brand avatar set, first post verified
  on the public API (SCOTUS-ballroom story, link card + thumbnail).
  `bluesky-post.yml` posts the newest unshared /rss story every 3 h
  (~8/day ceiling, stateless dedup via own feed). Secret
  BLUESKY_APP_PASSWORD took three attempts to land — the workflow's
  publicly-readable assert step (2a37b2f) is how a missing secret is
  diagnosed without log access; keep that pattern. Manual fire: touch
  `.github/triggers/bluesky` and push.
- **Newsletter: form LIVE sitewide** (footer, plain HTML POST to
  Buttondown — no key, no client JS). Buttondown account `currentwire`
  (login support@currentwire.us, mail at mail.hostinger.com) is in
  standard new-sender review, "a few hours to a day"; review form
  submitted 2026-09-01. Subscribers can sign up NOW; sending unlocks on
  approval. THEN: daily RSS-to-email automation (paid feature or API —
  check API availability on free tier once approved; the /settings/api
  URL 404s while under review).
- **Telegram: SKIPPED by owner** ("skip telegram") — do not re-raise
  unless the owner does.
- **Bing PubHub: DOES NOT EXIST anymore** (bing.com/pubhub redirects
  REDIRERR to the homepage) — Bing news inclusion is automatic via
  Webmaster signals, already in place. Do not hunt for an application.
- Daily loop: verify one bluesky-post run per day is green and eventually
  add its referral traffic to the weekly scoreboard; watch the Buttondown
  approval email in the owner conversation (owner checks mail, not us).

**STRATEGY SHIFT 2026-09-01 (owner-directed: "include changing strategy. i
wont wanna fail") — see the new section at the top of `seo/STRATEGY.md`; it
REPRIORITIZES this backlog and sits ABOVE the 2026-08-31 ranking below.**
Google web search is now a background re-earn, not the near-term delivery
channel. Execution queue for daily/weekly runs, in strict order:

1. **LCP 6.0s → under 2.5s** (PSI-verified via cwv.yml, never local probes).
   The one big automatable ranking lever left; gates Discover.
2. **First monthly most-covered report + publisher league table** (BET 2
   pulled forward — the GEO/AI-citation surface and link magnet; was
   Sprint 2, is now current). Folds in the 08-31 topic-hub finding where
   the same template work overlaps.
3. **Auto-poster infrastructure** for Bluesky + Telegram (env-var creds,
   graceful no-op until keys exist) so the owner's one batched session is
   paste-a-key-and-done. Check X free-tier write quota before building X.
4. **Newsletter plumbing** (provider-agnostic RSS-to-email prep; signup
   links land once the owner creates the account).
5. **Bing PubHub application prep** (assets/answers ready for the owner's
   click-through) + pull Bing AI Performance numbers into the weekly
   scoreboard.
6. CTR pass on the three ranking pages (existing item, unchanged).

Reporting contract (owner-directed, 2026-09-01): **no found/fixed messages
to the owner.** One weekly scoreboard (total visitors across channels, GSC
clicks/impressions/position, Bing + AI numbers, newsletter subs,
referrals); between scoreboards, contact the owner only for outages or
decisions. Checkpoints: Sep 8 (Google slide stopped?), Oct 15 (M1).

**PRIORITIES REBUILT 2026-08-31 (weekly deep run, score 87 -> 83/100 — the run was revised DOWN twice; the earlier "86 -> 86" written here was never corrected and stood wrong for four days).**
Everything below the "Ranked now" block is the accumulated record and its
verdicts still stand — several of them are refutations that cost a run each, so
read before re-opening anything. Ranking rule unchanged: how much indexable,
crawlable, citable value a fix creates per unit of risk.

## Ranked now — rebuilt from 2026-08-31 evidence

## 00e. Spend: budget raised to $45 on 2026-09-03 — the pause risk is CLEARED, the burn is not

**DONE, verified on the dashboard:** `On-Demand Budget $8.09 / $45 (18%)`,
Notifications: On, **Pause Projects: On** (deliberately kept). The owner typed
the team-name confirmation himself — the final spend authorisation was blocked
for the agent, which is the correct boundary. Nothing else on the billing page
was touched: no card added, no payment method changed, no add-on toggled.

**The urgency was real and this run under-called it.** The report told the owner
"~41 hours of headroom, tomorrow is comfortable", extrapolating from the
cycle-average $2.65/day. One hour later the meter read **$8.08 of $10 (81%)**,
up from $5.42 — the true rate at that moment was far higher than the average,
and the cap was hours away, not days. **Lesson for future runs: a cycle-average
is not a current rate, and must never be used to tell the owner how long
something is safe to leave.** Measure the delta between two readings instead.

**Most likely cause of the spike, and it is testable:** the 22:41 UTC deploy was
the first in three days, and **every deploy wipes the ISR cache**. Every crawler
request since then re-rendered a cold page — precisely ISR Writes plus Fluid
Active CPU, the two lines already at $6.30 and $5.83. If that is right it is a
one-off refill burst that decays as the cache warms, not a new baseline. The
next run must take **two readings a few hours apart** and report $/hour, not
guess from the cycle total.

**Still open, and now the single biggest lever:** the Add-Ons table shows
**Observability Plus ENABLED** (`Included + $1.20/1M events`) — that is the
$8.66 line, 34% of the bill, and it is one toggle on the billing page. It buys
telemetry about the app and nothing for readers or rankings. **Needs the owner's
explicit yes** (account setting). Turning it off is worth roughly $27/month at
the current event rate.

<details>
<summary>Original entry (2026-09-03, before the budget was raised)</summary>

### SCHEDULED OUTAGE: the site auto-pauses when on-demand hits $10 — OWNER, URGENT

**Re-read 2026-09-03 with the Spend Management panel open, and it is worse than
"watch". This is a dated, self-inflicted outage.**

```
On-Demand Budget    $5.42 / $10 (54%)
Notifications       On
Pause Projects      On
```

The dialog's own wording: *"Pause Production Deployments — Pause production
deployments for all projects on this team, **making them unavailable to
visitors**."* So the budget is not a warning line, it is a **kill switch**, and
the site is 54% of the way to it with **21 days left in the cycle**.

**Timing.** The $20 included credit is fully spent. Infrastructure has run
$25.22 over ~9.5 days (~$2.65/day), and every dollar from here is on-demand.
$4.58 of headroom ÷ ~$2.65/day = **~1.7 days**. On-demand was observed moving
$5.21 → $5.32 → $5.42 within ~40 minutes of this run (usage lags up to an hour,
so treat that as noisy, not as a $7/day rate). Either way the site pauses on
roughly **2026-09-04/05** unless the budget is raised or the burn drops.

This is the same failure class as 2026-08-24 (`402 DEPLOYMENT_DISABLED`, whole
site dark) — the difference is that this time it is scheduled, visible in
advance, and preventable.

**OWNER ACTION (only you can — it is a billing setting):** Vercel → Settings →
Billing → Spend Management → Configure → **set the On-Demand Budget to $45**.

**Why $45, and why a bigger number does not mean a bigger bill.** The budget is
not a spending plan — Vercel charges actual usage, so the number only decides
*when the site is switched off*. Sizing it:

| scenario | on-demand for the full cycle |
|---|---|
| nothing improves ($2.65/day × 21.5 days + $5.42) | **~$62** |
| duplicate cron was the doubling (burn halves) | **~$34** |
| that, plus the Observability cut | **~$25** |

$45 covers the two realistic scenarios outright, and even in the do-nothing case
buys **~15 days** of runway — far more than the ~3 days needed to measure the
post-deletion burn and act. It also still bounds a runaway bug at $45 rather
than removing the ceiling. **Do not** raise it above ~$50 and **do not** turn
Pause Projects off; an unbounded cap on a site that has twice run away is the
one genuinely dangerous setting here.

**The target to hold us to: $0 on-demand.** Every cycle includes $20 of credit.
At today's $2.65/day the month costs ~$82; at **under $0.65/day the credit
covers everything** and the true bill returns to the $20 subscription. That is
the number the next runs are working toward, not "afford $62". Keep
Notifications on. **Do not turn Pause Projects off casually** — it is the only
thing standing between a runaway bug and an unbounded bill; raising the number
is the safer move than removing the cap.

**But raising it by $10 is not a fix.** At the current rate the full cycle needs
roughly **$62 of on-demand** on top of the $20 subscription. A $20 budget buys
about four more days. The burn rate itself has to come down — that is our work,
not the owner's, and it is the rest of this item.

### Where the money actually goes (cycle to date)

| Line | Usage | Charge | Share |
|---|---|---|---|
| Observability Events | 7.21M | **$8.66** | 34% |
| ISR Writes | 1.57M | **$6.30** | 25% |
| Fluid Active CPU | 45 h | **$5.83** | 23% |
| Build CPU Minutes | 7 h | $1.48 | 6% |
| Fast Origin Transfer | 21 GB | $1.26 | 5% |
| Fluid Provisioned Memory | 115.19 GB·h | $1.22 | 5% |
| Function Invocations | 394.93K | $0.24 | 1% |
| ISR Reads / images / edge CPU | — | $0.24 | 1% |
| **Infrastructure** | | **$25.22** | |

Within-plan and costing nothing: Fast Data Transfer 11 GB / 1 TB, Edge Requests
819.18K / 10M. The problem is compute and cache writes, not bandwidth.

### The lever to check first: the duplicate project was running everything twice

`cuurentwire` was deleted 2026-09-03 (item 00d). It was a second project on the
same repo — so it built on every push **and carried the same `vercel.json`,
including the `crons` block**. If its cron was live, the 15-minute refresh has
been running **twice an hour, every hour**, doubling the ISR writes, function
invocations and Fluid CPU that make up 48% of the bill.

**That is a hypothesis, not a finding** — it was not verified before the project
was deleted, and it cannot be now. But it predicts something testable: the daily
burn should drop sharply from 2026-09-03. **The next run must read
on-demand charges again and compare $/day before and after the deletion.** If it
roughly halves, the spend problem is largely already solved and the budget
question shrinks with it.

### Cuts available if it does not halve, cheapest first

1. **Observability Events, $8.66 and the single largest line.** Telemetry about
   the app, with zero reader-facing value, billed at $1.20/1M. Turning it down
   is a project setting — **needs the owner's say-so, not a code change**.
2. **ISR Writes, 1.57M ≈ 165K/day across ~15K URLs** — about 11 regenerations
   per URL per day, which is far more than the content changes. Worth measuring
   against the revalidate TTLs. **Handle with care**: the playbook's ISR cost
   discipline warns that tightening these to chase TTFB re-created the
   2026-08-24 outage, so this needs measurement first, not intuition.
3. **Fluid Active CPU, 45 h** — falls with (2), since most of it is rendering.

### Automating this so it never surprises anyone again

Reading these numbers currently requires the owner's Chrome. A free Vercel
**read-only API token** (owner creates once, ~1 minute) would let a GitHub
Action pull on-demand charges daily and open an `[auto-alert]` issue at, say,
70% of budget — the same pattern as `deploy-watch.yml`. Worth the one-time ask:
without it, "are we about to be paused?" is only answerable by a human opening a
dashboard, which is exactly the kind of dependency this project keeps getting
burned by.

<details>
<summary>Original framing (2026-09-03, before the Spend Management panel was read)</summary>

### Vercel spend is tracking ~4x the subscription — WATCH, do not act yet

Read from the Vercel usage page 2026-09-03 (cycle **Aug 24 – Sep 24**, ~9.4 of
31 days elapsed), first time these numbers have been pulled since Pro was bought:

| Line | Usage | Charge |
|---|---|---|
| Observability Events | 7.21M | **$8.66** |
| ISR Writes | 1.57M | $6.30 |
| Build CPU Minutes | 7 hours | $1.48 |
| ISR Reads | 468.39K | $0.19 |
| Image Optimization (3 lines) | — | $0.03 |
| **Infrastructure subtotal** | | **$25.22** |
| Credits applied | | −$20.00 |
| Pro subscription | | $20.00 |

**The $20 included credit is fully consumed with 21 days left in the cycle**
(on-demand charges $5.21 and rising). At ~$2.68/day of infrastructure the cycle
projects to roughly **$83 infrastructure** — about **$63 on-demand on top of the
$20 subscription**.

Two things to weigh before anyone changes a setting:

- **The largest line is Observability Events ($8.66), not ISR Writes.** That is
  telemetry about the app, not the app serving readers — and it outranks the ISR
  writes the playbook's cost discipline has been watching. Probably the cheapest
  thing to turn down, and it costs no reader-facing behaviour.
- **The projection is not a measurement.** This cycle contains the 402 outage,
  49 hours of failing deployments (7 hours of Build CPU, much of it on builds
  that crashed) and unusually heavy verification traffic from these runs. A
  flat-rate extrapolation over an atypical 9 days is weak evidence.
- Item **00d** (the duplicate `cuurentwire` project building on every push) feeds
  directly into the Build CPU line and is the first thing to fix here.

Per the playbook a new quota wall is **logged for the owner, not paid past**;
nothing was changed on the account. **Action: the Monday deep run re-reads this
against a full week of normal operation before recommending anything.**


</details>

**0a. CLOSED 2026-09-04 — SUBMITTED AND ALREADY READ.** The owner said "access
chrome and get it done", so this was submitted through Search Console
(sc-domain:currentwire.us, OVYA account, authuser=1) rather than left on the
owner's list. Google accepted it and read it the SAME DAY: the Sitemaps report
now shows `https://currentwire.us/archive-sitemap.xml` — Submitted Sep 4,
Last read Sep 4, **Status Success, 16,973 pages discovered**. Sitemap-submitted
URLs went from 953 (618 + 335) to **17,926**, an 18x increase in what Google
knows about through sitemaps.

Do not mistake this for an indexing win yet: *discovered* is not *indexed*.
Google now has the URLs and will crawl and judge them over weeks; the
indexation number is the one to watch, and page value still governs the
outcome. What is closed is the 17-day blind spot where 92% of the site was
invisible to Google's sitemap pipeline. Re-check the Sitemaps report and the
Pages report weekly from here.

The original finding, kept for the record:

**`archive-sitemap.xml` HAD NEVER BEEN PROCESSED BY GOOGLE — 16,869 URLs (re-measured live 2026-09-03; the 13,593 figure quoted here for days was three thousand light),
92% of everything this site publishes.** Found
2026-08-31 only because the owner pushed back on an indexing figure in the
weekly report. GSC's Sitemaps report lists **two** sitemaps:

```
news-sitemap.xml    Submitted Aug 14   Last read Aug 24   618 discovered
sitemap.xml         Submitted Aug 14   Last read Aug 24   335 discovered
                                                    total 953
GSC indexed pages                                         951
archive-sitemap.xml  16,869 URLs         in robots.txt      ABSENT FROM GSC
```

**953 submitted, 951 indexed.** That is not proof of causation — Google knows
~1,700 URLs beyond the sitemaps — but indexation tracking submitted-sitemap
membership to within 0.2% is the strongest lever on this board. Both sitemaps
were also **last read Aug 24, seven days ago**.

`PLAYBOOK.md`'s coverage map has asserted since 2026-08-24 that all three are
submitted. **Every run since verified that the file serves 200, which is not
the same question.** Fix: submit `https://currentwire.us/archive-sitemap.xml`
in GSC → Sitemaps → "Add a new sitemap". Cannot be automated from here — the
extension cannot click Search Console's controls (see below) — and the loop
must not assume it is done: **re-check the Sitemaps report reads three rows.**

*Honest caveat to weigh first: Google is already declining pages it has
crawled (item 0b). Submitting 16,869 more thin URLs to a site with a value
problem may grow the "Discovered/Crawled – not indexed" buckets rather than
the indexed one. It is still worth doing — Google cannot index what it has not
been told about — but expect it to expose the value problem, not solve it.*

**0b. Google is de-indexing the site at scale, and it accelerated this week.**
GSC Page indexing (`Last update: 8/28`): **951 indexed, 1,720 not indexed.**
The bucket that moved is **"Crawled – currently not indexed": 10 → 562** —
Google fetched those pages and declined them. "Discovered – not indexed"
429 → 785. This is Google's own quality verdict, and it correlates exactly
with the −83% week-over-week impression collapse.

**Checked, and it is NOT the site noindexing itself:** the thin-story policy
(`lib/seo/story-indexing.ts`) noindexes single-source stories past a 14-day
window with zero GSC impressions, and the site turned 14 days old during this
window — the obvious suspect. Probed the **33 oldest archived story URLs**
live: **33 of 33 serve `index, follow`**, and "Excluded by noindex" is flat at
211 (the deliberate ones). Do not re-investigate the thin-story policy as the
cause.

This is STRATEGY BET 2 arriving as a measurement instead of a thesis: an
aggregator's thin pages are being refused at scale. It makes item 1 (durable
hub value) the response, not a nice-to-have — but nothing on this list fixes
a value verdict quickly, and the report should stop implying otherwise.

**0c. Nothing in this repo watches indexation or sitemap processing.** Which is
how 0a went unnoticed for a week and 0b for days. `seo-health.mjs` checks that
sitemaps serve 200 and parse; no check asks *did Google read it* or *is the
indexed count falling*. The GSC API exposes both (`sitemaps.list` gives
`lastDownloaded` and `contents`; the indexation sweep already runs). Add both
to `gsc.yml` with a fail on: a sitemap unread for >72 h, or indexed pages down
>10% week over week. **This is the item that would have caught the other two.**

1. **Topic hubs carry nothing durable, and collapse to noindex when the news
   cycle moves on.** NEW, and it is the week's clearest measured gap. Live
   today: `/topic/artificial-intelligence` 2,012 words / 33 links / indexable,
   but `/topic/donald-trump` **79 words / 2 links / noindex**,
   `/topic/ukraine` **30 / 0 / noindex**, `/topic/elon-musk` **31 / 0 /
   noindex** — the three highest evergreen-demand entities on the list.
   Competitor side measured the same day: Ground News topic pages carry ~20-25%
   durable non-headline content (cumulative article count, "Covered Most By"
   publisher list, related topics, topic prose). **Every one of those inputs
   already exists here** — cumulative counts from the 12,524-URL archive,
   per-publisher breakdowns from `lib/news/source-profile.ts`, entity
   co-occurrence — and none of them needs the bias rating this site refuses to
   publish. Same `hubStats` shape as the `/source/<slug>` profile that shipped
   2026-08-25 and worked (item 4). Converges with the 15 hubs GSC reports as
   "URL is unknown to Google" and with the **~Sep 22 consolidation decision**:
   a hub with durable facts is defensible, a 30-word keyword filter over a 72 h
   window is the doorway-adjacent shape Google may be right about.
2. **Category flap — `c31fffb88ca32` alternates business -> politics ->
   business -> politics across four dataset generations.** NEW, and it is the
   real defect the coherence probe had been hiding under 16 non-defects (see
   item 3 and the 08-31 report). Classifier-deep, so per the playbook it is
   engineered upstream with benchmark coverage, not patched in a template.
   `tests/unit/category-stability.test.ts` is the existing guard to extend.
3. **The homepage takes 9.3 seconds of main thread before it paints — and it
   is NOT the images.** NEW, measured 2026-08-31 including after the fix that
   was supposed to help. Post-deploy on a 412x823 mobile viewport under the
   4x/1.6 Mbps throttle:

   ```
   responseStart        120 ms    server is fast
   responseEnd          410 ms    all 338 KB of HTML delivered
   domInteractive     9,684 ms    <- the gap, with the bytes already in hand
   loadEvent         14,649 ms
   decodedBodySize  343,029 bytes
   FCP            9,332-11,944 ms;  LCP tracks it (12,664-14,060 ms)
   ```

   **The eager-image fix shipped this run did exactly what it claimed and did
   not help:** eager images 4 -> 1, image requests 6 -> 5, image bytes
   592,537 -> 437,713, all verified live — and LCP was unchanged inside its
   (very wide) variance band. **Do not re-run that play on `/top-100`,
   `/top-10`, `/most-covered` or `HubPage` on speed grounds**; the homepage
   result says it would not buy what it looks like it buys. Keep the fix
   itself — fewer full-size off-screen downloads is right regardless, and
   `tests/e2e/seo.spec.ts` guards it.

   The real target is main-thread cost: parsing 343 KB of HTML and hydrating a
   large React tree. Largest single script is GA's `gtag.js` at **173,356
   bytes** (the only one reporting a content-length; the Next chunks reported
   0 and were not individually sized). Two threads, both needing measurement
   before any build: (a) how much of the 60-link homepage payload must be in
   the first response, and (b) whether `gtag.js` should move off
   `strategy="afterInteractive"` — that trades analytics fidelity on quick
   bounces, so it is an owner-visible decision, not a silent one.
   **Discover eligibility depends on LCP < 2.5 s and this is nowhere near it**,
   which is why it outranks the CTR work below.

   **PARTLY ADDRESSED 2026-09-02 (`6c63626`) — and the payload was measured
   properly for the first time, which corrects two numbers in this item.**
   Splitting the homepage document by section: **62% of it (213,382 of 343,323
   bytes) is the RSC flight payload**, not markup — the serialized React tree
   Next embeds and parses on the main thread during hydration. And the page
   carries **270 links, not 60**. The "60-link payload" thread above was
   sized against the wrong number; re-derive before acting on it.

   Shipped from that: the dead-image placeholder was crossing the client
   boundary as a rendered node, so ~1,045 bytes of SVG shipped per image to
   show one — 6.6% of document bytes across nine pages (see the shipped block
   below). **This is a contribution, not the fix**: 25 KB off a 343 KB page
   does not move a 9.7 s `domInteractive`, and no run should report LCP as
   solved on it. The remaining threads are unchanged — (a) how much of the
   270-link payload must be in the first response, (b) `gtag.js` off
   `afterInteractive` (still an owner-visible decision, not a silent one) —
   plus a new (c): the flight payload is ~55% of every page, so the general
   question is which server-rendered subtrees must cross the client boundary
   at all. `ShareActions`, `NavBar`, `MobileMenu`, `ThemeToggle` and
   `MastheadDate` are the only other client components; they are few and
   small, so (c) is likely a small board, worth one measurement pass.
4. **CTR rescue on the pages that already rank** — unchanged since 08-25, still
   509 query impressions to 3 clicks, and still the item with the most direct
   evidence. Named targets and guardrails in the 08-28 status block below.
   **Blocked on fresh GSC data** (the Monday workflow did not fire; see owner
   blockers in the 08-31 report), so it moves when that lands.
5. **92% of Google's crawl requests are not HTML, and discovery is 5%.** NEW,
   from the **GSC Crawl stats** report — read for the first time this run (see
   below: the dashboards are reachable at `/u/1/`, they were never actually
   blocked). 90 days: **80,800 requests, 354 MB, 162 ms average response,
   200s at 99%**; by purpose **Refresh 95% / Discovery 5%**; by file type
   **Other 92% / HTML 5%**; by Googlebot **Desktop 92% / Smartphone 3%**.
   The 08-25 backlog reasoned its way to "the actual constraint is CRAWL
   DEMAND on a young domain" and shipped story->hub links on that theory —
   this is the first direct evidence, and it says the theory was right.
   **Next step is measurement, not a build:** the file-type row does not say
   *which* files, and the obvious suspects (a 3.27 MB `archive-sitemap.xml` (measured 2026-09-03)
   growing daily, three sitemaps, RSS + 11 category feeds, a per-story Satori
   OG render) are all cheap to check. If it is the sitemaps, the `s-maxage`
   lever parked in item 0b stops being theoretical. The Desktop/Smartphone
   skew is recorded, not diagnosed — one reading is not a trend.
6. **Meta descriptions overshoot on 5+ list pages** — NEW, and it is this
   loop's own overcorrection from 08-28. Measured live: `/briefing` **273
   chars**, `/reports/media-coverage` 235, `/most-covered` 178, `/energy` 173,
   `/obituaries` 166, against the ~155-160 Google renders. Small and safe.
7. **Story titles over 60 chars: 34 of 39 (87%)** — re-measured 08-31 on the
   widest sample yet. The description half of old item 5 is REFUTED and closed
   (see item 5); the title half keeps its rank and is untouched by that
   refutation.
8. **The news sitemap still advertises retired slugs.** `seo-health` logged
   **2 of 639** rename races on 08-31 and 1 of a separate 40-URL sample
   answered 307. The loop mechanism is closed (item 1) so these resolve rather
   than cycling, but the third candidate fix in item 1 — have the generator
   advertise only self-canonical URLs — is still the clean answer on the one
   surface Googlebot-News judges as a whole.

   **PARTLY REFUTED 2026-09-01, and the refutation is the more useful half.**
   Today's `seo-health` failure looked like exactly this item — a news-sitemap
   URL 308-ing to a different story id — and the feed turned out to be RIGHT.
   `/api/stats/archive-sources?ids=…` reported the advertised cluster
   `c9e0f30ebe2a1` as `merged: false` and its redirect target
   `c343d2e6168bf` as `merged: true`: the sitemap was advertising the
   surviving canonical URL and the **story route** was redirecting the
   survivor to the merged-away duplicate. So "advertise only self-canonical
   URLs" would have *suppressed a correct entry* here. Keep this item for the
   genuine rename races it names, and do not reach for the generator fix until
   a cross-check against archive standing shows the feed is the wrong side.
   The route-side cause is fixed — see the shipped block below.
9. **Trust pages serve a build-frozen masthead date.** NEW, measured, and
   deliberately NOT ranked for a fix yet. All 12 are fully static with no
   `revalidate` (confirmed in the build route table) and served `Age: 222,545 s`
   (2.6 days) rendering "Friday, August 28, 2026" on 2026-08-31.
   `MastheadDate` is already a Client Component precisely for this, so
   hydration corrects it for humans and for Googlebot; **the exposure is
   non-JS crawlers only**, which now matters more than it did because Bing
   reports 69 AI citations. The fix (`revalidate` on 12 previously-static
   pages, ~240 ISR writes/day) buys a cosmetic correction with new ISR spend,
   which is the cost control the playbook protects. Recorded with its number so
   a future run can decide; do not ship it without re-reading that constraint.

**FRESH GSC 2026-08-31 — workflow data (`30ed70f`), and the 28-day rollup is
MISLEADING. Read the weekly trend, not the window.** 28 days: 32 clicks /
1,943 impressions / 1.6% CTR / position 32.7 / 298 queries, against the 08-21
baseline of 12 / 1,080 / 1.1% / 21.3. That looks like growth and is not:

| Week | Clicks | Impressions |
|---|---|---|
| Aug 15-21 | 26 | **1,641** |
| Aug 22-28 | 6 | **282** |

**-83% impressions, -77% clicks week over week.** 1,641 of the 28-day total's
1,943 impressions (84%) come from Aug 15-21, before the outages; the peak day
was Aug 16 at 438. Daily since: 19 (Aug 27), 6, 7, 2, 0 — `lagDays: 3`, so the
last three firm up later, but Aug 27-28 do not. `explained: true` (the incident
ledger covers it) means explained, **not over**. Milestone M1 reads 32 and is
moving away on the current rate. **A future run must not quote the 28-day
rollup as a trend — this one nearly did.**

Striking distance came back **unchanged** on fresh data: same 26 entries, same
top three (espn nba coverage cuts 69i/0c pos 9; jd vance 19i pos 7.2; trump bbc
14i pos 12.4). Stable across four days, which strengthens the CTR case.
`newsRows: 0` confirmed fresh. Indexation sweep unchanged: `indexed 1,
not-crawled 22, crawled-not-indexed 11`.

Page indexing report, same session: **Indexed 1,520.** Not indexed 793 —
Discovered-not-indexed **429**, noindex-by-design 211, 404 **69**, redirect 69,
crawled-not-indexed 10, **5xx 2**, alternate-canonical 2, duplicate 1.

**So "Google de-indexed 11 of 12 indexed hub/category pages" is TRUE but was
never site-wide** — it was measured by a 34-surface evergreen sweep. The site
has 1,520 indexed pages and the story pages earn the clicks. Keep the hub work
(item 1) for what it is: a real problem on a small, high-value slice. Do not
repeat the collapse framing. Also: 5xx is down to **2**, so the outage-era
poison is gone, and only 69 of the 205 tombstones have registered as 404 yet.

The **429 Discovered-not-indexed is the crawl-stats finding from the other
side** (item 5): Google knows the URLs and has not spent budget fetching them.

*Per-query positions could NOT be pulled from the dashboard — its metric
toggles do not respond to the extension's synthetic clicks — so the
striking-distance list stays the 08-27 API one until a workflow run lands.*

**Re-authenticating `gh` through Chrome does not work — do not retry it.**
The device flow reaches GitHub's "Authorize GitHub CLI" screen with the code
accepted and the correct account, and the Authorize button never submits;
GitHub raises its own "Uh oh! There was an error while loading" banner. The
same shape appears on Search Console's metric toggles. **These SPAs ignore the
extension's synthetic clicks.** Three fresh device codes, two tabs,
click/Enter/Space — same wall every time. Plain navigation and text entry DO
work, which is how the dashboards above were read.

**SOLVED a better way 2026-08-31 — a run no longer needs `gh` to refresh its
own data.** `gsc.yml` and `cwv.yml` now carry a **push-path trigger**: change
`.github/triggers/gsc` (or `cwv`) and push, and the workflow runs. No auth, no
dashboard click, no `workflow_dispatch`. Verified the same minute it shipped —
both workflows fired on `event: push`. `.github` is excluded from
`vercel.json`'s `ignoreCommand`, so the trigger files never cause a deploy.
This also covers the *other* half of the problem, which was never about auth:
the Monday schedules simply did not fire.

`gh auth login` in a terminal is still worth one owner minute (it restores
authenticated issue reads and `gh run` inspection), but it is **no longer
blocking anything**.

**The trigger immediately exposed a latent bug worth keeping in mind.** Both
workflows fired correctly and both FAILED — every data step succeeded and only
the commit-back failed. Each ended in a bare `git push`, so a concurrent write
to `main` rejects it non-fast-forward and the run **discards work that already
cost real quota** (a Search Console API pull; a full Playwright measurement).
It was latent for as long as the two ran alone on Mondays 23 minutes apart;
firing both in one push, with a docs push landing between them, made three
writers on one branch. Both now rebase onto `origin/main` and retry 5 times
with jittered backoff, and emit `::error::` naming the work as *generated but
unsaved* if they truly cannot land.

*Worth generalising: a scheduled job that writes back to the repo is a writer
on a shared branch, and "it has never collided" is a property of the schedule,
not of the job. Any new workflow that commits results needs this loop.*

**The GSC dashboards were never blocked — do not report them as blocked again.**
Search Console answers "you don't have access to this property" on the default
Chrome profile because the property belongs to `ovyajewels@gmail.com`, not
`sameerhameedbaba@gmail.com`. **Both accounts are signed into the same Chrome
and the second one is `/u/1/`.** Use
`https://search.google.com/u/1/search-console/...` and everything opens.
Verified 2026-08-31: Manual actions **no issues detected**, Security issues
**no issues detected**, and the full Crawl stats report (item 4 above) — the
first time any run has read all three.


</details>

</details>

## 00. PRODUCTION HAS NOT SHIPPED CODE SINCE 2026-08-31 21:39 UTC — **CLOSED 2026-09-03, VERIFIED LIVE**

**RESOLVED. Production is shipping again, and it needed no owner action after
all.** The cause was ours, not Vercel's: `vercel.json`'s inline ignoreCommand
diffed against `VERCEL_GIT_PREVIOUS_SHA` (the last *successful* deploy), Vercel
builds from a shallow clone, and once `f8805af` aged out of that clone git
answered `fatal: bad object` and exited 128. Vercel reads any exit code other
than 0/1 as a build error — so the deploy failed, the last successful deploy
stayed `f8805af`, and the next deploy diffed against the same missing object.
A self-locking deadlock. Fixed by `94c7246`, which moves the logic into
`scripts/vercel-ignore-build.sh` and guarantees it can only ever exit 0 or 1.

That also explains the 4–7 second failures this entry flagged as "no build is
being attempted" — correct observation, and the ignoreCommand crash is why.

**Verified live 2026-09-03 in the Vercel dashboard and against production**
(not inferred — the whole point of this entry):
- `currentwire` → Deployments: `94c7246` **Ready**, badged **Production**.
  Every deployment beneath it is `Error` at 4–5 s, back through `f8805af`.
- Production no longer serves `<meta name="twitter:site" content="@currentwire">`
  (the `1425534` fix, stranded 27 minutes).
- `Daily briefing by email` now appears in the served HTML — the footer
  newsletter form from `72e30e7`, stranded since 08-31. **This entry's own
  staleness probe now passes.**
- Response headers carry `form-action 'self' https://buttondown.com`, so 00c
  is live too and the signup will actually submit.

All three days of stranded commits shipped in one build. The remaining item
below (two projects wired to one repo) is unchanged and still worth doing —
`cuurentwire` builds on every push and bills against the same on-demand
budget — but it is now a cost cleanup, not an outage.

<details>
<summary>Original entry, kept for the record</summary>

### (as filed 2026-09-02) PRODUCTION HAS NOT SHIPPED CODE SINCE 2026-08-31 21:39 UTC

**The site is UP and healthy. It just cannot deploy, and nothing noticed for
over 24 hours.** Found 2026-09-02 while trying to verify that day's own fix.

Proof, and it is not inference. `components/layout/Footer.tsx:38` renders
`<NewsletterSignup />` **unconditionally** — no env flag, no condition — and it
was added by `72e30e7` at 2026-08-31 21:39 UTC. Production's footer renders
everything around it (Corrections, Editorial Standards, Methodology, News Desk,
the wordmark, the tagline) and the form's own label, `Daily briefing by email`,
appears **zero** times in the served HTML. Second, independent check: the
homepage's `/_next/static/immutable/chunks/*.js` filenames are **byte-identical
before and after** today's push — a rebuild cannot leave content-hashed chunk
names unchanged.

**Code commits that never reached production** (the rest touched only `seo/`,
`data/` or `.github/`, which `vercel.json`'s ignoreCommand correctly skips):

| commit | UTC | what is not live |
|---|---|---|
| `72e30e7` | 08-31 21:39 | newsletter signup form in the sitewide footer |
| `53ad4b1` | 08-31 22:27 | archive-row cache re-key — **yesterday's fix** |
| `6c63626` | 09-01 22:03 | flight-payload placeholder fix — today's |

**This retroactively breaks a verification claim, and the loop should own it.**
The 2026-09-01 report marked `53ad4b1` SHIPPED and "verified live" because the
frozen `308` was gone afterwards. That report also wrote down, correctly, that
*"a deploy wipes the ISR cache, so the frozen 308 would have cleared on any
deploy"* — and the actual explanation is worse than the caveat it hedged
against: there was no deploy, and the symptom cleared for some third reason.
The mechanism is still proven by its unit tests; **the live claim was wrong.**

**It is not the code.** `ci.yml` — typecheck, lint, unit tests AND
`npm run build` — is `success` on every one of these commits, including today's.
The failure is on Vercel's side and is invisible from here.

**Why nothing caught it, which is the part to fix:**
1. `uptime.yml`, `seo-health.yml` and `url-survival.yml` all probe **the site**,
   and the site is fine — it serves fresh news the whole time, because the cron
   and ISR keep feeding a *stale build*. No check asks "is production running
   the commit I pushed?"
2. The GitHub deployments API is useless here: **two** Vercel projects
   (`currentwire` and `cuurentwire`) both report `failure` for **all 30** recent
   deployments, so "failure" has meant nothing for days and cannot be alerted on.

**OWNER ACTION (~2 minutes, only you can do it):** open the Vercel dashboard →
the CurrentWire project → Deployments, open the newest failed one and read the
build log. Also check Settings → Git for whether two projects are still wired to
this repo and disconnect the stale one. Push notification sent 2026-09-02.

**Automatable follow-up for the next run, once deploys work again:** have
`uptime.yml` assert a build identity, not just liveness — e.g. expose the
commit SHA in a response header or a tiny `/api/version` and fail when it has
not changed across a deploy that should have changed it. That is the check
whose absence made a 24-hour shipping outage invisible.

### Detector SHIPPED 2026-09-03 — `deploy-watch.yml` (the follow-up above, done better)

**The outage itself is still OPEN and still owner-only.** What is now closed is
the blindness: `.github/workflows/deploy-watch.yml` + `scripts/deploy-watch.mjs`
run every 3 hours and open an `[auto-alert]` issue when pushed commits are not
reaching production.

**It needed no `/api/version` after all, and that matters.** The proposal above
would have required *shipping a change to detect that changes cannot ship* —
circular, and dead on arrival during the very outage it was for. Instead it
reads GitHub's deployments API, which needs nothing from the site.

**This corrects a factual claim in item 00 as written.** That entry says the
deployments API "is useless here: both projects report `failure` for all 30
recent deployments, including ones that demonstrably shipped." Re-measured
2026-09-03, one status call per deployment:

```
f8805af  2026-08-31T12:45:29Z  Production – currentwire   success   <- what production serves
4b64c6e  2026-08-28T22:35:31Z  Production – currentwire   success
72e30e7  2026-08-31T21:39:53Z  Production – cuurentwire   failure   <- first one that did not
…every deployment after 72e30e7                            failure
```

The signal is clean and always was. The 09-02 run appears to have read the
deployment *records* without resolving each one's status, so everything looked
alike. Nothing else in item 00 changes — the site is up, CI is green, and only
the Vercel dashboard can say why a build fails.

**Which build production is serving, pinned exactly** (better evidence than the
absent-footer argument, which only proves "not the newest"): `f8805af` touched
`public/llms.txt`, a byte-comparable static asset. Live `/llms.txt` is
byte-identical to the repo at `f8805af` and differs from `f8805af^`. Production
is running `f8805af`, from **2026-08-31 12:43 UTC**.

**One more fact for the owner, and it narrows the dashboard hunt a lot:** every
failing deployment's status is written **0–1 seconds** after the deployment
record is created, whereas `f8805af`'s success came ~99 s after its push. A
Vercel build cannot install dependencies and run `next build` in under a
second. **No build is being attempted** — the deployment is rejected up front.
So the answer is unlikely to be in the build log at all; it is more likely a
project/account-level condition (billing state, a paused project, a broken Git
connection, a deployment limit). Look at the deployment's *error banner* and at
Settings → Git / the account's billing state before scrolling build output.

Detector verified 2026-09-03 against a stub replaying the real recorded API
shapes: outage → exit 1 naming the stranded commits, healthy → exit 0, dead
endpoint → exit 2 (deliberately distinct: a rate limit must never page the
owner as an outage), preview deployments ignored. Unit tests:
`tests/unit/deploy-watch-lib.test.ts` (15 cases).

</details>

## 00d. Delete the duplicate `cuurentwire` Vercel project — **DONE 2026-09-03, VERIFIED**

**DELETED 2026-09-03 at the owner's explicit instruction, after the audit
below.** Vercel confirmed with `?projectDeleted=cuurentwire`.

**Post-delete verification — production untouched:**

| check | result |
|---|---|
| `https://currentwire.us/` | **200** |
| `https://www.currentwire.us/` | 308 → apex (expected) |
| `https://currentwire.vercel.app/` | 200 |
| `https://cuurentwire.vercel.app/` | **404 — duplicate gone** |
| `/rss` | **50 items — Neon reads fine** |
| `currentwire` cron | `/api/cron/news-refresh`, **Enabled**, 0,15,30,45 |

The database was never attached to the deleted project, so nothing had to be
migrated. `scripts/deploy-watch-lib.mjs` comments updated in the same commit;
its 15 unit tests still pass, since the `"Production – cuurentwire"` strings
there are synthetic fixtures rather than live lookups.

The audit that justified it:

**What `cuurentwire` holds** (checked page by page, not assumed):
- Domains: **`cuurentwire.vercel.app` only.** No custom domain.
- Storage: **none connected** — the Storage tab shows the empty "Connect to a
  Database" state. `neon-cobalt-school` is a *team* resource, offered but not
  attached.
- Env vars: 3 duplicates from Aug 14 — `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`,
  `ADMIN_SECRET`.
- Cron: **`/api/cron/news-refresh` enabled on `0,15,30,45 * * * *`.**

**What `currentwire` holds** (i.e. nothing is lost):
- All three domains — `currentwire.us`, `www.currentwire.us`,
  `currentwire.vercel.app` — all Production.
- `neon-cobalt-school` (Neon – Launch) connected for Production + Preview.

**Two active harms, which is why this is worth doing rather than tidy:**
1. **A duplicate crawlable copy of the whole site.**
   `https://cuurentwire.vercel.app/` returns **200**, serves the full site and
   sends **no `x-robots-tag: noindex`**. It does emit
   `<link rel="canonical" href="https://currentwire.us">`, which is the only
   thing preventing this from being a straightforward duplicate-content
   problem. On a domain where only 12 of 34 evergreen surfaces are indexed,
   spending crawl budget on a second copy of every URL is the opposite of what
   we need.
2. **A duplicate cron, 96×/day, against a project with no database.** It runs
   `/api/cron/news-refresh` every 15 minutes and cannot reach Neon, so it burns
   function invocations against the same on-demand budget and is the likely
   source of the dashboard's "Error Anomaly" alerts.

**Nothing depends on the project existing.** `scripts/deploy-watch-lib.mjs`
matches on the `"Production"` prefix generically and collapses per-SHA with
"any success = shipped", so one production record per commit instead of two
still works — and gets *more* accurate, since the collapse currently forgives
a failing duplicate on purpose. The `"Production – cuurentwire"` strings in
`tests/unit/deploy-watch-lib.test.ts` are synthetic fixtures and keep passing.
Update that file's comment when the project is gone.

**Steps:** Vercel → project **`cuurentwire`** (the double-u typo spelling, NOT
`currentwire`) → Settings → Advanced → Delete Project → type the project name
to confirm. Verify afterwards that `https://currentwire.us/` still serves 200
and that `https://cuurentwire.vercel.app/` stops resolving.

## 00c. The newsletter form was blocked by our own CSP — SHIPPED 2026-09-03, **NOW LIVE**

Found this run by reading production's response headers. The sitewide CSP said
`form-action 'self'` while `components/layout/NewsletterSignup.tsx` posts to
`https://buttondown.com/...`. Browsers block a cross-origin form submission the
`form-action` directive does not name, and **nothing is logged server-side** —
the footer signup would have subscribed nobody, silently, from the moment it
went live. It has never actually run in a browser, because it has never shipped
(item 00), so no one would have noticed until subscriber counts stayed at zero.

Fixed in `config/csp.ts` (extracted from `next.config.ts` so the policy is
testable at all). The guard in `tests/unit/csp.test.ts` reads the form's own
`action` attribute out of the component and requires the policy to name that
origin, so switching providers cannot silently re-open it; proved by restoring
the defect and watching it fail. Verified on a real local production build:
`form-action 'self' https://buttondown.com` served, form rendered.
**Confirmed on production 2026-09-03** once item 00 cleared: live response
headers carry `form-action 'self' https://buttondown.com`, and the footer form
renders. It has still never been submitted by a real visitor, so the first
actual subscription remains unproven.

## 00b. Three `data/` files are compiled into the app, and `data/` is excluded
from deploys — **SHIPPED 2026-09-04 (`0058fa6`)**

`scripts/vercel-ignore-build.sh` now ANDs a second diff over
`COMPILED_DATA_FILES` (the three files below), so a commit touching only one
of them builds while `:(exclude)data` still swallows the ~12x/day report
commits. Boundary measured with the real script against real history, before
and after:

| commit | touches | before | after |
|---|---|---|---|
| `9ee4cc9` `bf493b7` `520caef` | `data/gsc-url-signals.json` (+ other data/) | **0 = skip** | **1 = build** |
| `593e369` | `data/lost-stories.json` + `tests/` | 1 = build | 1 = build |
| `c7f2825` | `data/cwv-history.json` (not compiled in) | 0 = skip | **0 = skip** |
| `70facbf` | `.github/triggers/cwv` | 0 = skip | **0 = skip** |

The cost control is intact: the two files that are not compiled into the
bundle still skip. The three that are changed 13 times between them in the 30
days to 2026-09-04, so the price is about one extra deploy a fortnight.

`scripts/deploy-watch-lib.mjs` mirrors the new list as
`BUILD_INCLUDED_DATA_FILES` and the existing drift test now parses BOTH lists
out of the shell script — without that, the watch would stop expecting a
deployment record for a commit Vercel does build, which is the same false-alarm
class as [auto-alert] #9. Three new behavioural tests drive the real script
over a throwaway repo: compiled-in data file builds, tombstone-only commit
builds, other-data-file still skips.

Two comments that asserted the wrong thing are corrected rather than deleted:
`lib/seo/gsc-signals.ts` (which described the gap) and
`.github/workflows/gsc.yml`, which claimed the weekly commit "triggers a
Vercel deploy — that is intended". It did not, from 2026-08-24 until this
commit; it does now.

<details>
<summary>Original entry (2026-09-02)</summary>

### Three `data/` files are compiled into the app, and `data/` is excluded from deploys

Found 2026-09-02 as a side-effect of item 00. `vercel.json`'s ignoreCommand has
excluded `data` since 2026-08-24 (ISR cost control — report commits were
deploying ~12×/day and every deploy wipes the ISR cache; the playbook protects
this and it must NOT simply be dropped). But three files under `data/` are
**static imports compiled into the bundle**:

| file | imported by | governs |
|---|---|---|
| `data/gsc-url-signals.json` | `lib/seo/gsc-signals.ts` | the thin-story **noindex** policy |
| `data/lost-stories.json` | `lib/news/story-resolution.ts` | tombstoned 404s vs crawl-poisoning 500s |
| `data/benchmark-history.json` | `app/admin/status/page.tsx` | admin display only |

`scripts/gsc-report.mjs` writes nothing outside `data/`, so **the weekly GSC
commit never deploys.** Verified by evaluating the real ignoreCommand against
the last three gsc-bot commits — `520caef`, `30ed70f`, `e9f6a36` — all exit
**0 = skip**. `lib/seo/gsc-signals.ts` asserted the exact opposite in a comment
("the weekly commit triggers a deploy and every page sees the same report");
that comment is corrected in this run's commit.

**What it actually costs.** Production serves whatever copy of these files was
compiled into the last build that shipped for some *other* reason. For the GSC
signals the staleness fallback fails safe — a deployed report past
`GSC_SIGNALS_MAX_AGE_DAYS` (14) counts as NO data and the policy noindexes
nothing — so the thin-story policy is mostly **inert**, not wrong. That also
reconciles a loose end in item 0b: the 33-URL sweep that found "33 of 33 serve
`index, follow`" is exactly what an inert policy looks like, so it is weaker
evidence of "the site is not noindexing itself" than it was read as. For
`lost-stories.json` the failure is sharper: a tombstone commit touching only
`data/` would never take effect, and today's worked only because it happened to
touch `tests/` too.

**The fix, and why it is not shipped today.** Do not drop `:(exclude)data`.
AND a second check onto the ignoreCommand so it skips only when both are quiet:

```
git diff --quiet PREV HEAD -- . ':(exclude)seo' ':(exclude)docs' \
  ':(exclude)data' ':(exclude).github' ':(exclude)*.md' \
&& git diff --quiet PREV HEAD -- data/lost-stories.json \
     data/gsc-url-signals.json data/benchmark-history.json
```

Deliberately **not shipped 2026-09-02**: deploys were already failing that day
(item 00), and changing deploy configuration during a deploy incident adds a
second variable to a problem that has only one. Ship it once builds are green,
and verify by making a `data/gsc-url-signals.json`-only commit and confirming
it deploys.

**SHIPPED 2026-09-02 (`6c63626`) — the dead-image placeholder every image
shipped and one image showed.** The homepage's known 9.3 s of pre-paint main
thread (item 3) had no named cause; splitting the document instead of guessing
found one. **62% of the homepage HTML (213,382 of 343,323 bytes) is the RSC
flight payload**, not markup — the serialized React tree Next embeds and parses
on the main thread during hydration — and its key census pointed straight at
the defect: 112 `stroke`, 84 `x1`/`y1`/`x2`/`y2`, 29 `cx`/`cy`, i.e. ~28 copies
of line-and-circle geometry on a page that displays one placeholder.

Cause: **every prop a Server Component passes to a Client Component is
serialized into the flight payload, rendered or not.** `RemoteImage` is a
Client Component and `StoryImage` handed it
`fallback={<CategoryPlaceholder …/>}` — a ~1,045-byte element tree per image,
to be shown only if that publisher's CDN had killed the asset. Measured live
before the deploy, counting the escaped fingerprint (in the payload) against
the unescaped one (in the markup):

```
/                                28 serialized,  1 shown
/top-100                         25 serialized,  0 shown
/most-covered                    25 serialized,  0 shown
/topic/artificial-intelligence   31 serialized, 17 shown
/politics /technology /us         4 serialized,  0 shown  (each)
                     120.4 KB of 1,833 KB across nine pages = 6.6% of bytes
```

`RemoteImage` now takes the resolved category **label** (~26 bytes) and renders
the art itself. Passing the `CategoryId` instead — the obvious alternative —
would have pulled `config/categories.ts`, 26 KB of classifier keyword
dictionaries, into the browser bundle and lost more than it saved; the label is
resolved server-side deliberately.

**Guarded twice, and the reason is worth keeping.** The natural guard is an
e2e payload assertion, and it passes for the wrong reason: with no news API key
the dev server Playwright drives serves fixture stories whose art is all LOCAL
placeholder SVG, so `RemoteImage` never renders in CI and the assertion is
vacuous. `tests/unit/story-image-flight-payload.test.ts` drives the remote
branch directly and fails naming the offending prop; proved by reintroducing
the defect and watching it fail. Both are in the tree.

**STATUS: MERGED, NOT LIVE — do not mark SHIPPED.** Item 00 above: production
has not deployed since 2026-08-31 21:39 UTC, so this commit is on `main` and in
CI but is not serving. Re-measured live at 22:2x UTC after the deploy window,
and the pre-fix numbers came back **unchanged** — `/` 28 serialized, `/top-100`
25, `/most-covered` 25 — which is itself part of the evidence for item 00.
**The next run must re-run this measurement once deploys work and only then
flip this to SHIPPED**; the expected result is serialized ≈ shown on every row.

**Honest scope even once it lands: this is a contribution to item 3, not a fix
for it.** ~25 KB off a 343 KB page does not move a 9.7 s `domInteractive`, and
no run should report LCP as solved on it.

**NEW, OPEN 2026-09-02 — the deploy signal this repo exposes is a constant
`failure`, so nothing can tell a broken deploy from a good one.** Found while
trying to confirm `6c63626` had shipped. GitHub's deployments API lists **two**
Vercel project integrations on this repo — `Production – currentwire` and
`Production – cuurentwire` (the typo spelling) — and **both report `failure`
for every recent production deployment**, including `a065053` and `0fa5ae6`,
which demonstrably shipped and were verified live by the runs that pushed them.
Each status lands within a second of the deployment being created, far too fast
to be a build result.

Consequences, both bad: a run cannot use the deployments API to know when its
own push is live (this run tried and was misled), and **a genuinely failed
deploy would look exactly like every successful one**, so nothing alerts. The
site being correct today rests on Vercel's real project deploying fine and the
GitHub-side status being noise.

Not fixed here because the cause is in Vercel project settings, not the repo:
most likely one dead/duplicate project integration still wired to the repo, and
possibly a broken status callback on the live one. **Owner-adjacent** — it
needs the Vercel dashboard (Settings → Git) to see which projects are connected
and disconnect the stale one. Cheap and worth doing; until then, verify deploys
by fetching the site, never by reading deployment status.

**NEW, OPEN 2026-09-02 — this loop can rate-limit itself off its own site, and
it looks exactly like an outage.** Polling the homepage for a deploy (a
40-iteration loop with no sleep, then one every 15 s, on top of ~20 measurement
fetches) made Vercel's bot mitigation answer **403 `X-Vercel-Mitigated:
challenge` on every surface** — `/`, `robots.txt`, `sitemap.xml`,
`news-sitemap.xml`, `archive-sitemap.xml`, `/rss` — for a browser UA, a
Googlebot UA and plain curl alike, serving a "Vercel Security Checkpoint"
interstitial. Mitigated: `uptime.yml` now takes a push-path trigger
(`81f0270`) so any run can get a second opinion from GitHub's IPs in about a
minute instead of guessing or waiting out an irregular schedule. Two open
questions a later run should answer, neither urgent: whether
`scripts/seo-health.mjs` (which chases every news-sitemap URL — 740 today) is
close to the same threshold, and whether the mitigation rule has any chance of
catching real crawlers. Full write-up:
`MEMORY/2026-09-02-verifying-too-hard-looks-exactly-like-an-outage.md`.

**NEW, OPEN 2026-09-01 — the news-sitemap merge gate reads standing through a
30-minute cache whose key cannot see a merge.** Found by the post-fix
`seo-health` run, which now reports it as a tolerated note rather than burying
it: `…-c10f7079a8181` is advertised in `/news-sitemap.xml` while
`/api/stats/archive-sources` marks the cluster merged.
`getNewsSitemapArchiveStatus` shares the `readFirstSeenEntries` entry
(`FIRST_SEEN_TTL_S = 1800`), whose cache key is the **sorted live cluster-id
set**. That key's own comment argues the staleness is harmless because "any
dataset change alters the id set" — but a merge flips
`merged_into_cluster_id` on an existing row **without changing the live id
set** (the merged-away cluster stays in the ~72 h live dataset), so the stale
`merged: false` is served for up to 30 minutes on the one feed Googlebot-News
judges as a whole.

Same family as the fix shipped below, opposite half: that one was *one row,
many keys*; this one is *one key, stale field*. Candidate fix, cheap: split the
merged-ids read out of the first-seen read and give it a short TTL (~60 s).
first_seen is write-once and can keep its 1,800 s; the merged query is indexed
(`story_archive_merged_into_idx`), returns 0–5 rows, and the route is already
CDN-bounded at `max-age=300`, so it adds at most one small query per region per
5 minutes. **Measure the current note rate over a few runs before building** —
today it is 1 of 692, which may not justify the change on its own.

**SHIPPED 2026-09-01 (`53ad4b1`) — one archive-row cache entry per STORY,
not per URL alias.** `findArchivedStory` was `cachedRead` keyed by the raw
lookup string, so a single `story_archive` row was cached once per alias —
canonical slug, bare cluster id, and every retired slug a rename left behind —
each entry with its own independent 6-hour `ARCHIVE_ROW_TTL_S`. When
`merged_into_cluster_id` flips, entries filled before the flip keep serving the
old direction, and nothing reconciles them because **neither is stale in its
own key's terms**. Measured live 2026-08-31 22:10-22:20 UTC, three URLs of one
story, three verdicts, all cache `HIT`s:

```
/story/<slug>-c9e0f30ebe2a1   308 -> ...-c343d2e6168bf   (archive: merged=false)
/story/<slug>-c343d2e6168bf   200                        (archive: merged=true)
/story/c9e0f30ebe2a1          307 -> <slug>-c9e0f30ebe2a1
```

It surfaced on the worst possible feed: `/news-sitemap.xml` advertised the
canonical survivor, and Googlebot-News fetches that within minutes of
publication and follows what it advertises — so a fresh story's canonical URL
was handing the News crawler a permanent redirect to a duplicate.
`archiveRowCacheKey()` now normalises the lookup to the story's cluster-id
token (every published slug ends with its own id, verified against all 1,660
ledger URLs), so all aliases share one entry and cannot disagree; a slug with
no well-formed id token keeps its own key and the old behaviour. It **removes**
reads rather than adding them, so it is free against the ISR/database budget.
9 new unit tests (`archiveRowCacheKey` + alias consistency).

*Verification caveat, stated because this loop has been caught by it before
(item 1): a deploy wipes the ISR cache, so the frozen 308 would have cleared
on any deploy. The live check confirms the symptom is gone; the **mechanism**
is proven by the unit tests and by the archive cross-check, not by the flip.*

**Closed by the 2026-08-31 run:** the archive-sitemap growth reconciliation
(dated work since 08-26 — the "doubling" was the write-stall recovery, the
settled rate is ~701/day and the 45,000 warn line is ~46 days out, see the
report); the publisher-image-weight watch (max back to 189 KB from 830 KB on
08-29, so that outlier was transient); and the coherence probe's permanent red
(item 3).

---

**Status 2026-08-28 later session: Bing Webmaster's SEO recommendations
read with the owner and answered (f3fb112, live-verified).** Four findings:
(1) meta descriptions too short (8 pages) — FIXED: all public category
descriptions (they double as the section dek), /canada and /contact
rewritten to ~140-160 chars; also serves the Google hub-de-indexation
work, since richer deks make category pages less thin. (2) img without
meaningful alt — FIXED: the two card variants passing alt="" now pass the
story title, like every other card. (3) "multiple h1" (6 pages, High) —
STALE: every flagged page serves exactly one h1 since the Aug 24 retitles,
verified live; expect Bing to clear it on next crawl, do not re-fix.
(4) "lacks inbound links from high-quality domains" — the standing
off-page track (Product Hunt launches Sep 1; Feedly + SaaSHub live);
no new action. Do not re-investigate these from the Bing dashboard.

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

### 3. Surface coherence — the alert was mostly a FALSE RED, split 2026-08-31 (`surface-coherence.mjs`)

**Read this before acting on `[auto-alert]` #2.** The 08-29 fix below was
correct but incomplete: every `archive-vs-live` disagreement still FAILED the
build, including the ones the probe's own cause label called staleness or skew.
Measured 2026-08-31, first run of the day: **16 violations, of which
`resolution: 0`** — 14 list-side staleness, 1 story-side, 1 skew.

Those are the site's cost controls working, and it was checked rather than
assumed: `/[category]` carries `revalidate = 3600` and the cron deliberately
does not revalidate the dynamic category pattern (that nuke is what blew the
Hobby tier on 08-24 and the playbook protects its absence). `/business`
answered **`Age: 3020`** — inside its own 3,600 s window — while carrying two
of the flagged clusters. So the gate had been red every night since 08-23 for
the site behaving as designed, and it was burying the one class that is a bug.

**Now:** only a same-generation disagreement fails; the rest are reported as
`findings` counted by cause, with `findingsByCause` and `stampCoverage` in
`data/coherence-report.json`. The silent-pass risk is guarded in the file's own
idiom — if the `cw-live-dataset-version` regex rots, everything would classify
as "unknown" and pass forever, so stamp coverage below `MIN_COVERAGE` fails as
`extraction-blind`. Measured: **16 of 16 archive renders carried the stamp.**

**Payoff, on the re-run: `violations=1 findings=4`** — and the survivor is a
genuine **category flap** (`c31fffb88ca32`, business -> politics -> business ->
politics). Issue #2 stays open, correctly, for that. It is now item 2 in the
ranked block above.

*The lesson, and it is the third time this loop has learned a version of it: a
gate that fails on a deliberate design decision does not just cry wolf, it
hides the real thing underneath. See `MEMORY/2026-08-21-the-instrument-breaks-first-and-quietly.md`.*

#### The freshness fix underneath it — SHIPPED 2026-08-29 (`a0d26f0`)

**The cause was a freshness gap, not a resolution bug, and it was hiding in
an arithmetic mismatch nobody had checked.** The cron burst marked
`dataset.clusters.slice(0, 150)` for re-render — always the same top 150 by
ranking score. Measured this run on `/api/stats/coverage`: **the live dataset
holds 726 clusters.** So **576 live story pages (79%) had no freshness
mechanism at all.** The story route carries a 30-day ISR TTL (item 0b), and
an archive-rendered page performs no tagged read, so
`revalidateTag(NEWS_CACHE_TAG)` never reached them either.

A page that rendered from the archive during the window in which its cluster
was not yet in the live snapshot therefore kept serving that archived copy
indefinitely: `dateModified` frozen, `isBasedOn` under-reporting every
publication that picked the story up afterwards — on the site's only indexed,
click-earning surface.

**Reproduced before fixing.** `node scripts/surface-coherence.mjs`: 20 pages,
700 cards, 188 clusters, 376 story fetches, **2 violations, 1 warning**, both
violations `archive-vs-live` and both listed live on `/`:

| Cluster | story page stamped | listed live on |
|---|---|---|
| `c4b6eeba54567` | `archive:2026-08-28T16:01:03.494Z` | `/` |
| `c13b7d189668c` | `archive:2026-08-28T21:00:08.244Z` | `/` |

Checked rather than assumed: both `/story/<id>` aliases 307 to exactly the
slug `/` links, so this is **not** a rename or an id mismatch, and
`getClusterBySlugWithVersion` is an exact scan over `dataset.clusters`
(`lib/news/queries.ts:348`) — if the cluster were in the snapshot the render
read, it would have hit. The renders were simply old and nothing re-rendered
them.

**The fix keeps the cost bound exactly where it was.** `LIVE_REVALIDATE_MAX`
stays 150 marks per burst — the billed quantity is unchanged, which the
playbook's ISR-cost constraint requires — and
`selectRevalidationSlugs` (`lib/news/revalidation-window.ts`) spends it
better: a fixed head of 100 (what readers and Google News see) plus a
rotating 50-URL slice of the tail, cursor derived from the clock so the
serverless cron stays stateless. Every live story is re-rendered within
**13 bursts ≈ 6.5 hours** at the measured ~2 bursts/hour, against never.
9 unit tests pin it (`tests/unit/revalidation-window.test.ts`), including
full-cycle coverage of all 726 and the unchanged per-burst bound.

**Shipped with the diagnostic that was missing.** The live snapshot an
archive render consulted was already computed and thrown away
(`app/story/[slug]/page.tsx`), which is exactly why this alert stayed
unreadable for six days. Archive-rendered pages now stamp
`cw-live-dataset-version`, and `surface-coherence.mjs` labels every
`archive-vs-live` violation with its cause: *resolution* (missed a cluster
the same generation was showing — a real bug) versus *staleness* (an older
render, which the rotation now heals). A future run must not re-diagnose
this from the violation alone; read the label.

**The stamp corrected this item within minutes of shipping — read this before
acting on the violation.** Re-probed on production right after the deploy,
both clusters above stamped `cw-live-dataset-version:
20260828T221542Z-d00266` — and **neither cluster is in the live dataset any
more**: absent from force-dynamic `/latest` (same generation) and from a
freshly prerendered `/` (`20260828T222628Z`, Age 0). So those two story pages
were **CORRECT** and the cached LIST pages were the stale side, the opposite
of what this item assumed for six days. Surfaces legitimately read dataset
entries up to ~29 minutes apart (the 1,740 s floor in `lib/cache/store.ts`),
so a cross-generation disagreement is skew, and only a **same-generation**
disagreement is a resolution bug. `classifyArchiveVsLive` in the probe now
says which of the three it is.

**Post-fix re-run, 22:28 UTC — violations 2 -> 1, and the survivor is the
class the rotation heals:**

```
VIOLATION c92e8ee37fe9e  storyVersion archive:2026-08-28T12:31:08Z
  liveVersionAtRender 20260828T221542Z-d00266   listSurfaces /business (r1,r2)
  cause "story-side staleness: an older render, healed by the rotating
         revalidation window"
```

**Honest limit on today's verification:** the rotation reaches the whole tail
in ~6.5 h, so that survivor is not expected to clear inside one run.
`[auto-alert]` #2 should be judged on the NEXT scheduled coherence run — and
judged on the `cause` label, not on the violation count alone, since
list-side skew will keep producing violations that are nobody's bug.

#### Original finding (2026-08-23, kept for the record)

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

**REFUTED 2026-08-29 — the junction is NOT the driver, and the fix for it was
built, measured and thrown away. Do not rebuild it.** The mechanism was found
in the code exactly as described: `stripHtml` deliberately converts block
boundaries to newlines
(`lib/news/normalization/normalize.ts:162`), `cleanDescription` splits on
them — and then **destroys them with `kept.join(" ")`**
(`lib/news/normalization/boilerplate.ts:234`), so `metaDescription`
(`lib/utils/text.ts:82`) finds no sentence end and falls back to a
mid-phrase cut.

That reads like the whole story, and the measurement says it is not. A
boundary-preserving join (append a stop only where a fragment ends with no
punctuation at all) was implemented and run over **real feed data pulled
this run — 24 curated feeds, 268 normalized descriptions through the actual
pipeline** (`parseItems` -> `normalizeArticle` -> `metaDescription`):

| | descriptions | over 155 chars | clipped mid-sentence |
|---|---|---|---|
| current | 268 | 113 | **52** |
| boundary-preserving join | 268 | 113 | **51** |

One description in 268. The clipped cases are overwhelmingly **genuine
single sentences longer than 155 characters** — NPR's feed writes them by
house style, and it dominated the sample. The standfirst-concatenation
examples recorded above are real but rare in the current feed mix.

So the remaining question is no longer "restore the boundary" but "is a
mid-phrase `…` worth trading a third of the snippet for", which the
2026-08-26 clause-boundary experiment already answered NO for 4% coverage.
**Item 5's description half is downgraded: it is not a CTR defect worth
engineering.** The title half (85% over 60 chars) is untouched by this and
keeps its rank.

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
- **`/archive-sitemap.xml` growth — RECONCILED 2026-08-31, alarm cancelled.**
  12,524 URLs today. Two independent measurements agree and they explain the
  scare: per-day `<lastmod>` counts from the served sitemap show
  **Aug 26: 366** (the 14 h silent write stall), **Aug 27: 1,607** and
  **Aug 28: 1,417** (the catch-up burst after `e1b4cfb` fixed it), then
  **Aug 29: 711, Aug 30: 681, Aug 31: 408 in 12 h**. Totals cross-check:
  11,122 on Aug 29 -> 12,524 today is **+701/day**. So the "+1,100/day
  sustained" reading was the recovery refilling the archive, not runaway
  growth, and the settled rate is back inside the original 450-700/day band.
  The health check fails above 45,000, which at this rate is **~46 days out
  (mid-October)**, not the ~30 days feared. Back to a watch item; re-measure
  monthly.

  > **THIS READING WAS WRONG, corrected 2026-09-03 with a live measurement.**
  > The 701/day figure was taken during a lull and the promised monthly
  > re-measurement was never scheduled, so nothing would have caught it.
  > Measured live today: **16,869 URLs, 3.27 MB**, with per-day `<lastmod>`
  > counts of **1,608 (Sep 1) / 1,621 (Sep 2) / 1,627 (Sep 3)** — the rate
  > roughly DOUBLED on the very day this was downgraded to a watch item. At
  > ~1,620/day the 45,000 hard `fail()` in `scripts/seo-health.mjs` lands
  > around **2026-09-21** and the 50,000 protocol cap around **2026-09-24**.
  > That is ~17 days, not six weeks, and it will take the daily health gate
  > red with it. The code comment guarding it claimed sharding was "years
  > away" with "~5,000 URLs of runway"; that is corrected in place.
  > **Promoted from a watch item to scheduled work.**
- **Publisher image weight drifted up, then came back.** `seo-health`
  passes. 2026-08-24: 15 images, 1,503 KB, median 52 KB, **max 448 KB**.
  **2026-08-25: 15 images, 1,410 KB, median 74 KB, max 235 KB** — the
  448 KB outlier is gone, so it was one host on one day, not a trend.
  Becomes work if the max crosses 500 KB (which fails the check for capped
  hosts). **2026-08-29: 15 images, 2,256 KB, median 82 KB, max 830 KB** —
  the max has crossed 500 KB and `seo-health` still passes, so the host
  carrying it is not one of the capped ones. **2026-08-31: 15 images,
  1,525 KB, median 91 KB, max 189 KB** — the 830 KB outlier is gone, so it
  was one host on one day, exactly as the 448 KB one was on 08-24. Do not
  grow the cap list on a single day's max: both excursions cleared by
  themselves within two days. It takes two consecutive readings over
  500 KB to be a trend.
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
