# SEO Backlog

**Status 2026-08-21 (weekly deep run): five open items, one of them the only
thing on this list the owner can act on.** The backlog was empty on 2026-08-20.
It is not empty now, and nothing on it was invented to fill space — every item
below names the command or fetch that found it during the 2026-08-21 weekly run
(`reports/2026-08-21-weekly.md`).

Statuses: OPEN / SHIPPED / CLOSED / BLOCKED(user). Verify a fix live before
flipping it to SHIPPED. Ranking rule: how much indexable, crawlable, citable
value a fix creates per unit of risk.

## Open — ranked

### 1. The permanent story archive is unreachable — BLOCKED(owner)

**This is the whole story of the week, and the only owner action on this file.**

The Neon Postgres archive stopped answering some time after 2026-08-19 22:20
UTC. Measured 2026-08-20 22:0x UTC:

| Surface | Healthy (2026-08-20) | Now |
|---|---|---|
| `/archive-sitemap.xml` | 2,793 permanent story URLs | **503**, `Retry-After: 3600` |
| Published `/story/` URLs | 1,329 live, 0 dead | **1,322 of 1,329 answering 5xx** |
| `/archive/<date>` | `/archive/2026-08-18` = 623 story links | 404 |
| `/archive` | day-bucket browse | 42 words, no JSON-LD |
| Live `sitemap.xml` story URLs | 200 of 200 | **195 of 200; 5 answer 500** |

The 5 failures in the *live* sitemap are the part that grows. `sitemap.xml` is
rendered from a dataset snapshot, and every refresh rotates more stories out of
the live window and into an archive that cannot answer — so the share of URLs
the site actively advertises and cannot serve increases for as long as the
outage lasts.

**The status code is now the diagnosis** (shipped in `d060817` by the daily
loop): a 503 means the archive is configured and failing, so `DATABASE_URL` is
set on the deployment and the database itself is not answering. A missing env
var would have produced a 200 with an empty `<urlset>` instead. That narrows
the owner's check to the Neon project, not to Vercel's environment settings.

Owner action, about five minutes, no payment: open the Neon console, check
whether the project is suspended, over its free-tier compute allowance, or
otherwise stopped, and resume it. Nothing in this repository can restore it.

Everything the *site* can do is already done: it emits retriable signals rather
than permanent ones, so no crawler is being told a permanent URL is gone.
Recovery needs no deploy — the surfaces re-populate once the database answers.

### 2. Story pages answer 500 during the outage; the sitemap route answers 503

`app/archive-sitemap.xml/route.ts` returns `503` with `Retry-After: 3600` and
`Cache-Control: no-store`. A published `/story/` URL in the same outage returns
a bare **500** — verified on five live-sitemap URLs and six ledger URLs, all
500, plus one 504 from the edge.

Both are retriable and neither says "gone", so the property that matters holds.
But 503 with `Retry-After` is the signal Google documents for temporary
unavailability, and 500 is the one that reads as a broken page. The two routes
should agree. This is a refinement of a fix that is already correct on the
decisive point — rank it accordingly, and do not let it delay item 1.

### 3. Nothing routes a red monitor to a human

`seo-health.yml` failed at **2026-08-20T07:27:37Z** and `url-survival.yml` at
**2026-08-20T07:09:02Z** (`gh run list`). Both fired correctly, on the first
morning of the outage. Nothing acted on either for roughly **15 hours**, until
the daily agent loop ran and found the outage independently.

This is the third occurrence of the same failure: 2026-08-17 and 2026-08-18
also failed silently for two days (`reports/2026-08-18-weekly.md`). The alarms
work. The delivery does not — and `gh` cannot read this repo's Actions logs
(HTTP 403, admin rights required), so the loops reproduce the checks locally.

Free options worth evaluating, in preference order: confirm whether GitHub's
default scheduled-workflow-failure email already reaches the owner's address;
add a step that opens a GitHub issue on failure, since issue notifications
route differently from Actions notifications; or accept the agent loops as the
delivery mechanism and state the detection latency honestly (up to about 24
hours) instead of implying it is minutes.

### 4. `/news-desk` is the one masthead page with no JSON-LD

Verified live: `curl -s https://currentwire.us/news-desk | grep -c
'application/ld+json'` returns **0**, against **1** for `/about`. The
2026-08-19 clear-out typed six trust pages (`/about` AboutPage; `/methodology`,
`/editorial-standards`, `/corrections` WebPage; `/contact` ContactPage;
`/topics` CollectionPage) and missed this one — and `/news-desk` is the page
`NewsMediaOrganization.masthead` points at, which makes it the worst one to
miss. It is otherwise healthy: 200, 312 words, indexable, with
`max-image-preview:large` present.

`/privacy`, `/terms` and `/copyright` also carry none. Lower value, same fix.

### 5. Seven of twelve sampled story pages have no outbound topic links

Measured this run across 12 live story pages sampled from `/news-sitemap.xml`:
outbound `/story/` links are **median 4, and zero on none of them**. The
2026-08-19 "More in {Category}" rail is holding, and that was the single
biggest finding of the 2026-08-18 weekly run, when 39 of 40 pages had zero.

Outbound `/topic/` links are **median 0, absent on 7 of 12**. Topic hubs are
exactly the surface that needs inbound links: 24 of them sit in `sitemap.xml`,
they flip indexable as they accumulate stories, and story pages are where their
link equity would have to come from. Same defect class as the story-link dead
end, one hop up, and a smaller job than that fix was.

## Watching, not yet work

- **`/most-covered` is running 5 items** (ItemList and rendered links both 5;
  it was 12 on 2026-08-19). Not a defect — coverage breadth on this site is
  limited by the ingest feed list, and the page states that on itself. It does
  mean the site's most differentiated page is thin on any given day.
  Re-measure weekly; it becomes work if it stays at 5 while the feed list grows.
- **Thin category pages**: `/climate` 3 items / 133 words, `/culture` 3 / 137,
  `/science` 5 / 152, against `/politics` 13 / 639. Same cause. Do not pad them.
- **One dedup recall miss**, recorded rather than filed:
  `fbi-raids-eric-swalwells-home-amid-sexual-assault-claims-inquiry-report-c13c03e2081a1`
  (General) and
  `fbi-raided-swalwells-home-seized-devices-as-part-of-chinese-spy-probe-c9b2a99f3b09b`
  (Politics) are one event across two clusters, published 70 minutes apart, one
  source each. This is **inside the designed contract** — precision ≥ 0.98 is
  held far above recall ≥ 0.80 because a wrong merge corrupts a story page
  while a missed merge only leaves two pages where there should be one. Note
  that the low-confidence half landed in `/general`, which is noindexed, so
  Google sees one of the two. Do not re-tune clustering from one observation.
- **25% of sampled story descriptions still end mid-sentence** (3 of 12; it was
  53%, then 23% after the 2026-08-18 formatter fix). The residue is summaries
  whose first sentence alone exceeds the meta-description limit — a summarizer
  input-length question, not a formatter bug.

## Shipped 2026-08-21 (weekly deep run) — verified live

### `cwv-check.mjs` was recording an error page's Core Web Vitals — SHIPPED

`firstStoryUrl()` took the **first** `/story/` entry in `data/url-ledger.json`
with no liveness check. During this outage that entry answered **500** with a
9,353-byte error page, and the probe measured it and wrote `LCP 1,172 ms` into
`data/cwv-history.json` as a story-page vital. Nothing downstream could tell
that number from a real one.

Replaced with `firstLiveStoryUrl()`: it probes ledger order first, so the URL
measured week to week does not move while the site is healthy; falls back to
the most recently verified-alive entries; takes the first that answers **200**;
and returns `null` — measuring two surfaces instead of three, loudly — when
none do. Verified this run: it skipped 6 dead URLs (five 500s and a 504) and
measured a live story instead.

**The rule this leaves behind:** a monitoring script that chooses its own
target must verify the target is healthy before reporting a number about it.
Otherwise the first thing to break is the instrument, and it breaks quietly.

### `llms.txt` refreshed — SHIPPED

4,484 → 5,175 bytes. Three drifts corrected against the live pages:

- It described `/methodology/duplicate-stories` as publishing "their measured
  precision and recall". That page publishes **no** accuracy percentage and
  says so in as many words — it publishes the CI contract. Fixed to match.
- `/archive` (the HTML browse path over permanent URLs, shipped 2026-08-19) and
  `/contact` were never listed. Added.
- Added the failure contract, so an AI crawler that meets this outage retries
  instead of recording a permanent URL as removed: a published story URL never
  answers 404, and an unreachable archive answers a retriable 5xx while the
  archive sitemap answers 503 with `Retry-After`.

One line was written and then corrected before shipping: the draft described
`/contact` as covering "takedown requests". The page has general, corrections,
publisher and technical inboxes and no takedown channel. *Prose about a page is
a claim about that page — check it against the page.*


## Known and accepted — not work, but do not "fix" these

- **The operator identity line on `/about`** is deliberately deferred. It is a
  business decision, not an oversight.
- **`/topic/*` hubs below the thin-collection bar are `noindex, follow`.** They
  flip indexable as they accumulate stories. Working as designed.
- **Merge 308s and `/story/<clusterId>` 307s show as "Page with redirect" in
  GSC.** That is the URL-permanence guarantee doing its job.
- **`/general` is noindexed.** It is the internal low-confidence bucket, not a
  public section.
- **`/top-100` and `/latest` are `force-dynamic`.** They must read
  `searchParams`, which opts a route into dynamic rendering in this Next
  version — no route segment config can change that. Their canonical
  unfiltered documents carry an edge-only cache directive instead
  (`next.config.ts`), which is the only lever Next sanctions.
- **`static.politico.com` images cannot be resized.** It is a plain Cloudflare
  passthrough: `?width=`, `?w=`, `?imwidth=`, `?fit=`, `?d=`, `?resize=` and
  `?auto=webp` each returned the identical **4,944,055 bytes** on 2026-08-19.
  There is no free lever, so the health check reports Politico images over
  1 MB rather than failing on them. Re-probe only if Politico changes CDN.
- **Coverage breadth on this site tops out low** (max 2 publishers per story in
  the 2026-08-19 snapshot, 13 publishers represented of 43 configured). That is
  a function of the ingest feed list in the `RSS_FEEDS` env var, not of the
  ranking code. `/most-covered` states it on the page as a lower bound rather
  than hiding it.

## GSC index review — 2026-08-18 (owner asked; read via Search Console UI)

State as of GSC data dated 8/14-8/15: **88 indexed, 185 not indexed, 4 reasons.**
Three of the four reasons were correct behaviour; the fourth was the strategic
work now shipped.

- "Excluded by noindex" (23) — thin `/topic/*` hubs. Intentional.
- "Page with redirect" (13) — merge 308s, alias 307s, www. Correct.
- "Not found 404" (2) — two story URLs from before the permanent archive
  existed. Nothing to restore.
- "Crawled - currently not indexed" (147) — the real one. Broke down into
  alias URLs (feeding stopped), filtered `/top-100?...` variants that
  canonicalize away (correct), indexable topic hubs Google had not chosen yet
  (normal for a young site), and **thin single-source story pages plus the
  absence of any evergreen content** — which were backlog items 1, 3 and 4 and
  are now shipped. `/general` rendering indexable was a real bug, fixed
  2026-08-18.

Re-measure this in the next weekly run: the levers that move it (internal
linking, story depth, evergreen hubs, and large-thumbnail eligibility, which
was silently broken sitewide until 2026-08-19) all landed after that snapshot.

## Shipped 2026-08-19 (backlog clear-out) — all verified live after deploy

Every remaining OPEN item was designed, adversarially reviewed, implemented and
verified in one run. The reviews changed three of them materially; those
corrections are recorded here because they are the reusable part.

### 1. Story pages were internal-link dead ends — SHIPPED (79e77e5)

Measured 2026-08-18: 39 of 40 story pages had **zero** outbound links to any
other story. The "More in {Category}" rail fixed it. Verified live 2026-08-19:
4 outbound story links on 3 of 3 sampled pages. "Related coverage" is unchanged
and still rare, which is the intended round-8 precision bar, not a bug.

### 2. No CDN caching on HTML — SHIPPED

Root cause: `/story/[slug]`, `/topic/[slug]`, `/source/[slug]` and
`/archive/[date]` declared `export const revalidate` but exported no
`generateStaticParams`, which Next 16 requires before ISR engages on a dynamic
segment. All four sat in the build's ƒ bucket serving `no-store` on every
request, including repeat fetches of the same URL. Each now returns `[]`.
Verified live: `X-Nextjs-Prerender: 1`, `HIT` on the second fetch, and **warm
story TTFB 110–125 ms against the 557 ms median measured 2026-08-18**. No
regression: `url-survival.mjs` 1,286 URLs / 0 dead, merge 308s still 308, alias
307s still 307, unknown URLs still 404.
Guard: `tests/unit/isr-route-config.test.ts`.

### 2b. `/top-100` and `/latest` — SHIPPED, with the review's correction

Both must read `searchParams`, which forces dynamic rendering; no segment
config can change it. The one lever Next sanctions is a `next.config` headers
rule, scoped with `missing` so it fires only on the canonical unfiltered
document (filters, pagination and RSC requests excluded).

**What the review changed:** the first version set a public
`s-maxage=300`. On Vercel that header is applied by the edge proxy, and no
route on this deployment has ever produced a cache HIT from a Cache-Control
string alone — every measured HIT carries `X-Nextjs-Prerender: 1`. So if the
edge ignored the rule, the site would have been telling every downstream shared
cache to hold the two freshness-critical pages for five minutes while the
origin re-rendered each time, and it would also have overwritten the `no-store`
Next sets on error renders. Split: the TTL now rides in
`Vercel-CDN-Cache-Control` (consumed and stripped at the edge, so nothing
downstream can be misinformed) and the client-facing header is byte-identical
to what `/` already serves. A header that cannot lie beats a header that might.
Guard: `tests/unit/list-cache-headers.test.ts`.

### 3. Single-source story pages were thin — SHIPPED (scoped down), modest

Measured on 14 paired production URLs: single-report main content went
**185 → 290 median words**. The module adds 119 words, of which **88 are a
fixed template and ~31 are per-story values** (18 by a strict LCS-pair
measure).

It was scoped down from its design, which would have added 254 words with 218
of them identical on all 2,199 permanent story URLs — mass-duplicated text on
a site already fighting a duplicate-content ceiling. Duplicated mass across
the archive drops ~479k → ~194k words. **A sentence that does not change
between two stories does not belong in the story template**; the fixed prose
lives on `/methodology/*` and is linked.

State the result honestly in future runs: this roughly doubles a thin page but
only ~31 of the new words are story-specific, so it is a real improvement and
**not** a fix for the thin-content ceiling. The structural fix is item 4.
The publisher-excerpt option from the original backlog turned out to be a
near-no-op — it adds **0 words to 300 of 313 pages**, because on a one-article
cluster the publisher description already *is* the dek.

Two sentences the design wanted to publish were false and were dropped: that
the classifier ignores the publisher's own section label (it does not — that
is what misfiled the Theban tomb story), and that coverage points come from the
publication-name count shown on the page (they come from
`independentSourceCount`, distinct non-press-release domains).

### 4. No evergreen content of any kind — SHIPPED

Three reference pages under `/methodology/`: `coverage-breadth`,
`publisher-tiers`, `duplicate-stories`. Every figure on them is **computed at
render from the production scoring functions** (`RANKING_WEIGHTS`,
`coverageFactor`, `freshnessFactor`, `TIER_WEIGHT`) rather than typed into
copy, so the pages cannot drift from the code they describe.

**What the review changed:** the draft would have published "on 491 pairs,
precision 0.989, recall 0.806" as an accuracy figure. Those numbers come from
`tests/fixtures/cluster-pairs.ts`, whose own header says every pair is invented
— fictional towns, companies and people — and PLAYBOOK.md's rule is
"Real-headline accuracy is the only accuracy we quote." The count was stale
too (501 pairs now, not 491). The page publishes **no measured accuracy**; it
states the CI gates, which are contract values in the repo rather than
measurements of the world, and says plainly that the pairs are written for the
test rather than sampled from live coverage. A guard comment forbids
reintroducing a figure.

Two more prose claims were false and were rewritten: that an all-press-release
story's source-mix line prints "0 independent domains" (it was suppressed by a
`> 0` guard — the guard was fixed so the sentence became true), and that a
story's address never changes as coverage grows (`pickLead()` re-selects the
lead and the slug is built from its title — which is exactly why `/story/`
307s old addresses). **Prose about behaviour is a claim; verify it against the
code the way you verify a statistic.**

### 5. Category misclassification — SHIPPED

The Lakers/Jeanie Buss story was fixed upstream (now Business). The Theban tomb
story was traced, not guessed: it scored **zero on every category**, so the
arstechnica.com feed prior — weight 2, exactly `MIN_PRIMARY_SCORE` — decided it
alone at confidence 1.0. Archaeology coverage had two words to stand on. Fixed
as a dictionary change, not a rule change.

**What the review changed:** the first dictionary created **nine new
confident-wrong placements**. "Ancient city of Aleppo faces new shelling"
scored science, and "ancient city" is the standard dateline of siege reporting;
"excavation" is a construction word at least as often as an archaeology one;
bare "dinosaur" caught a film franchise. It also moved **zero** stories on the
313-story real-production benchmark, so it was buying nothing while adding
collisions. Narrowed to precise phrases, five entries removed with the headline
that broke each recorded in the code, and five collision guards added as
fixtures. **Turning a harmless `general` abstention into a confident wrong
section is worse than the misfile being fixed.** Fixtures 268 → 288,
high-confidence accuracy held at 98.9%.

### 6. "Most covered" had no indexable URL — SHIPPED

`?sort=most-covered` canonicalized straight back to `/top-100`, so the site's
most differentiated signal had no home. `/most-covered` is now a static ISR
route with its own canonical, title, BreadcrumbList and ItemList, linked from
the footer, `/top-100`, the sitemap and llms.txt. The `?sort=` dimension was
removed from `/top-100`'s generated URL space entirely — one less duplicate
URL family for Google to fetch and discard.

The page states its own limits on the page: breadth is not importance, not
agreement, not verification; it is measured only over publishers we ingest and
is therefore a **lower bound**; syndication is excluded; ties are common. That
honesty section is also what stops it being thin.
Guards: `tests/unit/most-covered.test.ts`, four Playwright specs.

### 7. Near-duplicate topic hubs — SHIPPED

A topic identity-key layer (`lib/news/topics.ts`) folds containment and
singular/plural variants and drops headline-fragment bigrams. Consolidation is
`rel=canonical`, never a redirect, because `/topic/<slug>` answers 200 for any
slug — so no advertised URL can start 404ing, and every variant keeps serving a
**superset** of what it served before. Folding is curated, never naive
substring matching: `/topic/florida` and `/topic/florida-house` are both real.
Verified live: `/topic/big-bend` now canonicalizes onto
`/topic/big-bend-national-park`; `york`/`new-york` and
`washington`/`washington-post` correctly stayed separate; `bay-giants` and
`unitedhealthcare-ceo` are gone from `/topics`.

The eligibility floor also moved from articles to **distinct clusters**, which
is precisely what syndication inflates — three copies of one release are one
story. That made an existing test's premise obsolete in a good way; it now
asserts the stronger property.

### 8. Archived stories had no HTML browse path — SHIPPED (79e77e5)

`/archive` and `/archive/<date>`. Verified live: `/archive/2026-08-18` returns
200 with BreadcrumbList + ItemList and **623 outbound story links**.

### 9. Publisher logo for News surfaces — SHIPPED (cb0bb63), now guarded

Already done and proven live: `/logo-600.png`, 3,858 bytes, IHDR 350x60, and
`NewsArticle.publisher.logo` carries the URL with explicit width and height. An
ImageResponse route was rejected — it accepts only ttf/otf/woff, not the woff2
next/font ships, so a generated wordmark would silently fall back to Arial.
`tests/unit/publisher-logo.test.ts` reads the PNG's IHDR so the hand-maintained
schema numbers cannot drift from the file.

### 10. Font preload — SHIPPED as a DELETION

Already shipped in cb0bb63, and shipped wrong. `next/font` injects its own
preload per subset by default and root-layout fonts preload on all routes, so
the head carried **four preload links for two files** on every route measured.
The hand-rolled manifest-reading block in `app/layout.tsx` was deleted.
Verified live: 2 links, 2 files, no duplicates. The health check now fails if
the count drops below two or any href repeats. **The fix for a "missing" tag
can be removal.**

### 11-14. Trust-page schema, interlinking and /contact — SHIPPED

`/topics` gets CollectionPage (listing only hubs that clear the indexing bar,
so it can never advertise a `noindex` URL). `/about` gets AboutPage,
`/methodology`, `/editorial-standards` and `/corrections` get WebPage,
`/contact` gets ContactPage — all six shipped **zero** JSON-LD blocks before
today. In-body links now connect all seven trust pages. `/contact` went from 77
words to ~440 with no invented staff, phone numbers, postal addresses or
response-time promises. The health check verifies all six page types daily.

### 15. Warm the hero `/_next/image` URL — CLOSED as obsolete

`images.unoptimized` is on, so images are served as-is from `src` and live HTML
contains zero occurrences of `/_next/image`. There is no URL to warm. Proven by
command, not assumed.

### 16. Shard the archive sitemap — CLOSED, converted to monitoring

`scripts/seo-health.mjs` now fails when `/archive-sitemap.xml` exceeds 45,000
URLs, ~5,000 short of the 50,000 cap, with the fix named in the failure
message. 2,199 URLs today. Nobody has to remember it.

### 17. Google Search Console sitemap submission — CLOSED, not required

`robots.txt` advertises all three sitemaps, verified live. Google discovers
sitemaps from `robots.txt` with no UI action, so this was never a prerequisite
for indexing — only for per-sitemap reporting. Optional, owner's call.

### 18. Bing Webmaster Tools — SHIPPED

Verified by GSC import, all 3 sitemaps submitted, 0 errors
(`seo/offpage/LEDGER.md`). The optional API key is unnecessary: IndexNow
already pushes every new story to Bing within ~30 min, and DuckDuckGo and Yahoo
source from Bing.

### 19. PageSpeed Insights API key — CLOSED, no key needed

The keyless PSI endpoint still returns HTTP 429, so `scripts/cwv-check.mjs` no
longer depends on it. It defaults to a keyless probe driving the Chromium the
e2e suite already installs, under Lighthouse's mobile throttling (4x CPU,
1638.4 kbps, 150 ms), reading LCP/CLS/FCP/TTFB from the browser's own
PerformanceObserver. It reports no Lighthouse score, because one cannot be
derived from those metrics and inventing it would be a fabricated number.
A PSI key would only add CrUX **field** data, which needs real traffic volume
this site does not have yet — it would report nothing today even if added.

### 20. Homepage LCP — connection setup SHIPPED, image weight still OPEN

`ImageOriginPreconnect` derives the LCP image's origin from the rendered hero
(it changes per story, so a hardcoded list would be wrong within the hour) and
opens the connection before the parser reaches the `<img>`. Verified live.

Two honest caveats, both worth carrying forward:

- **The first version emitted two preconnects** to the same origin, one with
  `crossorigin` and one without. Images with no `crossorigin` attribute are
  fetched in no-cors mode, so the CORS-mode connection was never used — an
  extra TLS handshake competing with the LCP image on a throttled link.
  Corrected to the no-cors form only. *A preconnect whose CORS mode does not
  match the eventual request is worse than no preconnect.*
- **It did not fix the LCP, and measurement said so.** FCP improved
  (1,912 → 1,492 ms) and TTFB is 100 ms, but LCP moved the wrong way because
  the hero image changed from 71 KB to 546 KB between runs. That is open
  item 1 above, and it is the real constraint — connection setup was never
  going to beat half a megabyte on a throttled link.

### Found while working: every `pageMetadata()` page shipped no robots meta

Not on any backlog. `/us`, `/topics`, `/top-100`, `/politics`, `/sources`,
`/methodology` and `/about` carried **no `<meta name="robots">` at all**,
silently losing `max-image-preview:large` and `max-snippet:-1` — large-thumbnail
eligibility in Discover and Top Stories. Page-level metadata replaces the root
layout's wholesale in this Next version, and `undefined` counts as replacing it
with nothing. The helper already documented that exact hazard for `openGraph`
one field above. Verified live on 7 pages before and after; guarded by
`tests/unit/page-metadata-robots.test.ts`.


## Shipped 2026-08-19 (daily loop) — verified live after deploy

- **ISR was inert on every dynamic route** (backlog item 2). Four routes
  declared `export const revalidate` but exported no `generateStaticParams`,
  which Next 16 requires before ISR engages on a dynamic segment — so
  `/story/[slug]`, `/topic/[slug]`, `/source/[slug]` and `/archive/[date]`
  server-rendered every request under `no-store`. All four now return `[]`
  and flip from ƒ (Dynamic) to ● (SSG) in the build output. Live evidence and
  the full no-regression sweep are recorded against item 2 above.
  `tests/unit/isr-route-config.test.ts` is the standing guard. SHIPPED

## Shipped 2026-08-18 (weekly deep run) — all verified live after deploy

- **Unbounded duplicate pagination space.** `/top-100?page=9`, `?page=999` and
  `/latest?page=5000` each returned HTTP 200 serving the last real page's
  content under their **own** canonical — an unlimited supply of
  self-canonicalizing duplicate URLs. `generateMetadata` clamped nothing while
  the body clamped to the last page. Out-of-range pages now answer
  `noindex, follow` and canonicalize to page 1; in-range pages 2-4 keep their
  own canonicals and stay indexable (all 7 cases verified live). SHIPPED
- **Every story link on `/latest` was a redirect.** All 60 pointed at
  `/story/<clusterId>`, which only 307s to the slug — 12 of 12 sampled were
  redirects, so the canonical URL never received the link and each crawl of the
  feed cost 60 extra hops. Cards now link to the cluster slug, attached at
  query time and never persisted. Verified live: 15 of 15 sampled resolve 200
  directly. SHIPPED
- **Meta descriptions ended mid-sentence.** 16 of 30 sampled live stories (53%)
  ended in an ellipsis. `metaDescription()` now packs whole sentences and only
  falls back to truncation when the first sentence cannot fit; trailing
  connectors are cleaned. 7 unit tests. Verified live: 7 of 30 (23%) — the
  remainder are summaries whose first sentence alone exceeds the limit, which
  is item 3's problem, not the formatter's. SHIPPED
- **Story titles overflowed the SERP.** 29 of 30 sampled exceeded 60
  characters, with `" | CurrentWire"` spending 14 of them. Headlines stay
  truthful and whole; the suffix is dropped when the headline is long.
  Verified live: suffix dropped on 25 of 30. SHIPPED
- **Indexable hubs were in no sitemap.** Topic and source hubs are indexable
  once they clear the thin-collection bar, but nothing listed them.
  `sitemap.xml` now includes them, gated by that same bar so it can never
  advertise a `noindex` URL. Verified live: 258 URLs including 21 topic and 12
  source hubs; 8 sampled hubs all 200 and indexable. SHIPPED
- **List pages had no ItemList.** `/latest` (60 items), `/sources` (12) and
  `/source/<slug>` (26 on BBC News) now emit ItemList JSON-LD; `/top-100`
  pages 2-4 now carry their own per-page ItemList `url`. All parse. SHIPPED
- **Hero images had no fetchPriority.** Next 16 deprecated `Image priority` in
  favour of explicit hints, and the preload it emitted never put
  `fetchpriority` on the `<img>` (bundled docs recommend `loading="eager"` or
  `fetchPriority="high"` over preload). Hero images now carry both, and the
  first four ranked thumbnails load eagerly. Verified live: home emits
  `fetchpriority="high"`; `/top-100` shows 3 eager (of 4 — one story has no
  image) where all 15 were lazy. SHIPPED
- **llms.txt refreshed** — coverage hubs (`/topics`, `/sources`), the archive
  sitemap, and a "facts worth knowing before citing" section covering URL
  permanence, attribution, honest dates, ranking method and correction policy.
  Verified live at 3,521 bytes. SHIPPED

## Shipped 2026-08-18 (daily loop)

- **Google News sitemap emitted out-of-window publication_date** — the renderer
  kept a story whenever its source coverage was inside 48h but emitted
  `first_seen_at` as `<news:publication_date>`. 9 of 307 live entries were
  affected and the daily health check had failed since 2026-08-17. Both
  timestamps must now be inside the window. 5 new unit tests. Verified live:
  0 entries older than 48h. SHIPPED
- **`npx eslint .` was not a usable gate** — root-anchored ignore patterns let
  `.next/` output inside agent worktrees be linted (1398 errors and 21362
  warnings on a clean tree). Patterns are now `**/`-prefixed; zero problems.
  SHIPPED

## Shipped 2026-08-15 (baseline round)

- NewsArticle dateModified could precede datePublished — clamped (JSON-LD + og
  modifiedTime), unit-tested. SHIPPED
- Homepage had no canonical/og:url — added (with RSS alternate preserved). SHIPPED
- www.currentwire.us served the whole site as a duplicate host — permanent
  host redirect to the apex added in next.config. SHIPPED
- /top-100?page=2..4 canonicalized to page 1, hiding ranks 26-100 — per-page
  canonicals + titles + ItemList rank offsets. SHIPPED
- No archive sitemap: stories older than the newest 200 were in no sitemap
  despite permanent URLs — /archive-sitemap.xml added (all non-merged archived
  stories) + robots.txt entry. SHIPPED
- No max-image-preview:large — sitewide robots directives added (Discover
  large previews). SHIPPED
- Organization schema was bare — upgraded to NewsMediaOrganization with logo,
  publishingPrinciples, correctionsPolicy, masthead, actionableFeedbackPolicy
  (sameAs deliberately omitted: no published social profiles). SHIPPED
- NewsArticle now carries publishingPrinciples + correctionsPolicy; self-hosted
  OG card first in image[]. SHIPPED
- RSS feeds existed for only 6 sections — all public categories now have
  feeds; category/us/canada/top-100 pages advertise them via
  link rel=alternate. SHIPPED
- llms.txt 404 — added (aggregator-honest, llmstxt.org format). SHIPPED
- IndexNow wired: key file at site root, new story URLs pinged from the cron
  on first archive (production only, never breaks a refresh), unit-tested. SHIPPED
- Archived stories lost their OG headline card — archive fallback added to the
  story opengraph-image route. SHIPPED
- apple-icon (180x180) + theme-color viewport export added. SHIPPED
- 404 page had the homepage title — own title + noindex. SHIPPED
- Corrections page: honest corrections-log section + editorial-standards link. SHIPPED
