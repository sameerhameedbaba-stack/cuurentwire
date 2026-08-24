# CurrentWire SEO Playbook

Living strategy for organic growth of https://currentwire.us (Google, Bing, Google
News/Discover, AI search). Owned by the automated SEO loop; updated whenever we
learn something. See `BACKLOG.md` for prioritized work and `reports/` for run logs.

## Hard constraints

- **$0/month, with ONE owner-approved exception.** Free tools and free keyless
  API tiers only. Never enter billing details, never sign up for trials that
  convert, never upgrade. If a free tier runs out, stop using it and log it in
  BACKLOG.md. Exception (owner-approved 2026-08-21, in person): the Neon
  database runs on the paid usage-based Launch plan to end the egress-quota
  outage. Runs must never add other paid services, and never upgrade anything
  further — a new quota wall gets logged for the owner, not paid past.
- **Database spend cap: $30/month, owner-set 2026-08-21.** Vercel Hobby has no
  native spend limit (that is a Pro feature — do not buy Pro for this).
  Enforcement: (1) the Monday deep run checks month-to-date cost at
  vercel.com → Integrations → Neon → Invoices/Usage (via the owner's Chrome
  when available) and puts the number in its report — if it exceeds $15,
  flag it loudly as an owner item that week; (2) realistic worst case is
  ~$19/mo (0.25 CU compute that never sleeps + <1 GB storage), so a reading
  above that means something is actually wrong (runaway autoscaling or
  egress) — investigate, don't just report; (3) the true hard ceiling
  (autoscaling max 0.25 CU in the Neon console) is BACKLOG item — console
  access is blocked by a Neon SSO account mixup, fix via Neon support.
- **White-hat only.** No cloaking, no fabricated schema/authors/dates/reviews, no
  link schemes. Excerpts stay short and attributed — publisher copyright is respected.
- **No fabricated metrics.** Every number in a report comes from a real fetch, API
  response, or crawl performed that run.
- **Automation-first.** The owner does not operate this. Anything recurring must run
  by itself (Vercel cron, GitHub Actions, scheduled tasks) or be dropped.

## North star (owner goal, set 2026-08-21)

The owner's target is the "Amazing / Elite" tier of a month-3 news-site
benchmark: **50,000+ clicks/month, 1M+ impressions, 5%+ CTR** — typically
reached via Google News placement or Discover.

Measured baseline the day the goal was set (GSC, last 28 days, real fetch):
**12 clicks, 1,080 impressions, 1.1% CTR, avg position 21.3.** The site is
~1 month old. That gap is closed by compounding, not by a single change, so
runs work toward the *current milestone* and report progress against it with
real GSC numbers — never claim a tier without data:

1. **M1: 100+ clicks/28d** ← current milestone
2. M2: 1,000+ clicks/28d
3. M3: "Good" tier — 3,000+ clicks/28d
4. M4: "Great" tier — 10,000+ clicks/28d
5. M5: "Elite" — 50,000+ clicks/28d, 5%+ CTR

Biggest levers, in order of expected impact right now: (1) **uptime** — zero
archive outages and alert delivery that actually reaches the owner (an outage
like 2026-08-21's takes 99% of story URLs off the air); (2) indexing
coverage — get crawled-not-indexed pages indexed (internal-link rail, content
depth); (3) **Discover eligibility** — CWV "good" (LCP < 2.5s), large images,
strong headlines; Discover is the only realistic route to Elite-tier volume
for a young aggregator; (4) thin-page content depth; (5) backlinks via the
off-page track; (6) publishing volume and time. Speed is a standing owner
concern: never ship anything that measurably regresses CWV.

## What this site is (context for every run)

- News aggregator: ranks a Top 100 for US/Canada, publishes summary story pages at
  `/story/<slug>` that cite original publishers (`isBasedOn` in NewsArticle JSON-LD).
- Story URLs are permanent: live → 308 merge-pointer → archived 200 → 404 never
  (verified daily by `.github/workflows/url-survival.yml`).
- Refresh: Vercel cron every 30 min + 5-min shared cache; every public dataset is
  archived to Neon Postgres.
- Category quality and dedup are actively engineered and benchmarked against 313
  manually validated production stories (see `data/benchmark-history.json` and
  `/admin/status`). Real-headline accuracy is the only accuracy we quote.

## Site-specific priorities (ranked)

1. **Indexing speed** — valid Google News sitemap (48 h window, ≤1000 URLs),
   sitemap coverage for ALL live story URLs (recent + archive), RSS per category,
   IndexNow pings on publish (free, keyless protocol; Bing consumes it).
2. **Structured data** — Organization/NewsMediaOrganization + WebSite/SearchAction
   sitewide; ItemList on ranked pages; NewsArticle with honest dates + `isBasedOn`
   on story pages; BreadcrumbList. Never FAQPage/HowTo (no rich results). All JSON-LD
   must parse and validate.
3. **Thin/duplicate-content defense** — summaries stay short and attributed; unique
   value is the ranking (position, coverage breadth, methodology links, related
   stories). Any page that is 90%+ syndicated text gets flagged.
4. **Data quality** — wrong categories poison category-page relevance; dedup failures
   create duplicate titles. These are engineered upstream (clustering + classifier
   benchmarks with CI gates); the SEO loop only *monitors* for regressions on live
   pages and files bugs, it does not re-fix the classifier ad hoc.
5. **E-E-A-T** — About, Methodology, Editorial Standards, Corrections, News Desk
   pages crawlable, interlinked, and referenced from Organization schema
   (publishingPrinciples / correctionsPolicy / masthead). Operator identity line on
   /about is intentionally deferred (business decision) — do not "fix" it.
6. **AI search (GEO)** — `/llms.txt` current, answer-first summaries, citable pages.
7. **Performance** — Core Web Vitals via free keyless PageSpeed Insights API;
   fixes land in the Next.js code (images, fonts, JS payload).
8. **Internal linking** — related stories, topic hubs, breadcrumbs, category
   cross-links.

## Operating cadence (all automated)

- **Continuous (site itself):** news sitemap + sitemaps regenerate from live data;
  IndexNow pinged for new story URLs on each refresh.
- **Daily:** deterministic SEO health check (GitHub Actions) — sitemaps valid,
  news-sitemap fresh, RSS valid, robots reachable, JSON-LD parses on sampled pages,
  llms.txt present. Fails loudly on regression — but "loudly" means the workflow
  goes red, and nothing yet routes that to a person. Detection latency is
  therefore up to ~24 h, bounded by the next agent loop, not by the check.
  Measured three times now (2026-08-17, 2026-08-18, 2026-08-20). Do not describe
  this alerting as real-time; BACKLOG.md item 3 is the open work.
- **Daily (agent):** scheduled task runs the daily loop from this playbook — read
  MEMORY/ + BACKLOG.md, verify yesterday's stories flowed to sitemaps/IndexNow,
  crawl samples for schema/canonical/category regressions, fix top backlog items,
  write `reports/<date>.md`.
- **Weekly (agent):** deep run — full re-audit with fresh 0–100 score, CWV pass,
  competitor content-gap snapshot (free crawls + web search), llms.txt refresh,
  BACKLOG re-prioritization.

## Search engine coverage map (verified 2026-08-24 — keep current)

How every engine gets CurrentWire's results. The owner's rule: results must
reach ALL search engines, not just Google, at $0 and zero recurring effort.

| Engine | How results arrive | Status |
|---|---|---|
| Google (Search + News + Discover) | GSC-verified; sitemap.xml + news-sitemap.xml + archive-sitemap.xml submitted; News eligibility is automatic (no submission program exists anymore) | ✅ automatic |
| Bing | Bing Webmaster Tools verified (GSC import, 2026-08-19), 3 sitemaps submitted; IndexNow pings every new story within ~30 min | ✅ automatic |
| DuckDuckGo | Sources results from Bing — covered by the Bing work above; no own submission program | ✅ via Bing |
| Yahoo | Powered by Bing | ✅ via Bing |
| Yandex, Naver, Seznam | Consume the IndexNow protocol; our single ping to api.indexnow.org distributes to all participating engines | ✅ automatic |
| Brave Search | Independent index built from user browsing (Web Discovery); no submission program exists — nothing to do | ✅ nothing possible |
| AI engines (ChatGPT, Perplexity, Claude, Gemini) | robots.txt allows all crawlers (verified: User-Agent * / Allow /); llms.txt published; citable permanent URLs | ✅ automatic |

Maintenance: the daily seo-health check already verifies robots.txt, the three
sitemaps, and the IndexNow key file — any regression here fails loudly.

Re-verified 2026-08-24 by fetch, before that day's outage: `robots.txt` 200
advertising all three sitemaps with `User-Agent: *` / `Allow: /`,
`sitemap.xml` 200 (340 URLs), `news-sitemap.xml` 200 (633 entries, oldest
publication date 46.97 h against the 49 h grace), `archive-sitemap.xml` 200
(5,891 permanent URLs, recovered and grown from 2,169 on 2026-08-22), the
IndexNow key file 200 serving its own key, `llms.txt` 200, `/rss` and 11
category feeds 200, and `www` 308 to the apex. `seo-health.mjs` passed all 20
checks. Every row of the table above holds.

**Standing caveat, added 2026-08-24.** This map describes how results are
*designed* to reach each engine. It says nothing about whether the site is
answering. At 13:18 UTC on 2026-08-24 every URL in the table above — including
`robots.txt` and all three sitemaps — began answering **402
`DEPLOYMENT_DISABLED`** because Vercel disabled the deployment. That is a
strictly worse crawl signal than the 2026-08-20 archive outage, which kept
`robots.txt` and the sitemaps up and answered story URLs with a documented,
retriable 503 + `Retry-After`. A 402 is not a documented crawl signal at all,
and no code change can improve it, because no code is being served. A run that
finds this must treat it as an owner-blocking outage and say so at the top of
its report — see `seo/BACKLOG.md` item 0.

## Owner time budget (standing rule, set 2026-08-19)

The owner spends AT MOST 15-20 minutes per week on SEO, all of it on the
weekly off-page checklist (Thursday run). Everything else must be fully
automatic or it doesn't ship. Checklists are capped at 2-4 actions; an empty
week is reported honestly as "nothing this week". Owner submission email:
support@currentwire.us.

## Verification method (before marking anything done)

Fetch the live URL after deploy and check the actual output: parse JSON-LD, validate
sitemap XML, confirm HTTP status codes. Gates before any push: vitest, tsc, eslint,
build, Playwright (`tests/e2e/seo.spec.ts` covers SEO basics). Never mark a BACKLOG
item done from code inspection alone.

## Free stack (validated 2026-08)

Keyless: PageSpeed Insights API (low volume), IndexNow, our own crawls (curl),
schema validation by parsing. Free with user-created keys (owner action, listed in
reports when needed): Google Search Console API, Bing Webmaster API. Excluded
(paid/billing-gated): SE Ranking, DataForSEO, Ahrefs, Google Cloud NL, Custom
Search, Ads Keyword Planner.

## Honest expectations

Aggregators face a thin-content ceiling; the unique-value work (ranking
methodology, hubs, coverage-breadth data) is what breaks it. First measurable
movement typically 2–6 weeks. These loops do technical SEO, indexing speed, schema,
content quality, and monitoring — they do not build backlinks or guarantee rankings.
