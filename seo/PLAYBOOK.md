# CurrentWire SEO Playbook

Living strategy for organic growth of https://currentwire.us (Google, Bing, Google
News/Discover, AI search). Owned by the automated SEO loop; updated whenever we
learn something. See `BACKLOG.md` for prioritized work and `reports/` for run logs.

## Hard constraints

- **$0/month, forever.** Free tools and free keyless API tiers only. Never enter
  billing details, never sign up for trials that convert, never upgrade. If a free
  tier runs out, stop using it and log it in BACKLOG.md.
- **White-hat only.** No cloaking, no fabricated schema/authors/dates/reviews, no
  link schemes. Excerpts stay short and attributed — publisher copyright is respected.
- **No fabricated metrics.** Every number in a report comes from a real fetch, API
  response, or crawl performed that run.
- **Automation-first.** The owner does not operate this. Anything recurring must run
  by itself (Vercel cron, GitHub Actions, scheduled tasks) or be dropped.

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
  llms.txt present. Fails loudly on regression.
- **Daily (agent):** scheduled task runs the daily loop from this playbook — read
  MEMORY/ + BACKLOG.md, verify yesterday's stories flowed to sitemaps/IndexNow,
  crawl samples for schema/canonical/category regressions, fix top backlog items,
  write `reports/<date>.md`.
- **Weekly (agent):** deep run — full re-audit with fresh 0–100 score, CWV pass,
  competitor content-gap snapshot (free crawls + web search), llms.txt refresh,
  BACKLOG re-prioritization.

## Search engine coverage map (verified 2026-08-19 — keep current)

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
