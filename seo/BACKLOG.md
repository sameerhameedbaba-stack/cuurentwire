# SEO Backlog

Re-prioritized 2026-08-18 from the weekly deep run (evidence in
`reports/2026-08-18-weekly.md`; daily-loop evidence in `reports/2026-08-18.md`).
Statuses: OPEN / SHIPPED / BLOCKED(user). Verify a fix live before flipping it
to SHIPPED.

Ranking rule used here: how much indexable, crawlable, citable value the fix
creates per unit of risk. Items measured this week carry their measurement.

## GSC index review — 2026-08-18 (owner asked; read via Search Console UI)

State as of GSC data dated 8/14-8/15: **88 indexed, 185 not indexed, 4 reasons.**
Verdict: three of the four reasons are correct behavior; the fourth is the known
strategic work, plus one real bug found and fixed the same day.

- "Excluded by noindex" (23) — all `/topic/*` hubs below the thin-collection
  bar. Intentional by design; as hubs accumulate stories they flip indexable
  and into the sitemap. No action.
- "Page with redirect" (13) — merge 308s, `/story/<clusterId>` 307 aliases, www.
  Correct behavior. The /latest fix (weekly run) stops feeding new alias URLs
  to Google, so this decays on its own. No action.
- "Not found 404" (2) — two story URLs from before the permanent archive
  existed (2026-08-15 era, one a since-dissolved bad merge; both verified 404
  live). Nothing to restore — data was never archived; Google drops these.
  No action.
- "Crawled - currently not indexed" (147) — the real one. Sampled examples
  break into: (a) `/story/<clusterId>` alias URLs — feeding stopped by the
  weekly /latest fix; (b) filtered `/top-100?...` variants that canonicalize
  away — correct; (c) indexable topic hubs Google hasn't chosen yet — normal
  for a young site; (d) **thin single-source and press-release story pages —
  this IS backlog items 1, 3 and 4**; (e) `/general` — a real bug, fixed:
  the internal low-confidence bucket rendered indexable with a self-canonical.
  Now noindexed (e2e-tested). SHIPPED 2026-08-18.

Bottom line: 88/273 indexed at 3 weeks old with zero backlinks is a normal
young-site ratio; the lever that moves it is items 1, 3 and 4 below, not
plumbing (which the health check shows is clean).

## Open — high value

1. **Story pages are internal-link dead ends.** Measured 2026-08-18 across 40
   live + archived story pages: **39 of 40 (97%) have zero outbound links to
   any other story**, and 10 of 40 have no topic links either. The "Related
   coverage" rail does not render at all — the heading is absent from every
   story page sampled. This is not a bug: `scoreArchiveRelatedness` requires
   two shared specific entities (or one plus high title similarity), a
   precision bar round-8 raised deliberately, and almost no pair clears it.
   With 1,720 permanent story URLs, that is 1,720 crawl dead ends and no
   story-to-story link equity anywhere on the site.
   **Fix (do not lower the round-8 bar):** keep "Related coverage" exactly as
   it is for genuine same-storyline matches, and add a *separate, honestly
   labelled* navigational rail — "More in {Category}" or "Also on CurrentWire
   today" — that always renders 4-6 links chosen by category and recency. It
   makes no relatedness claim, so it cannot be wrong. Needs a unit test
   asserting every story page renders at least 4 internal story links.
   Impact: the largest remaining structural item. Status: OPEN

2. **No CDN caching on HTML.** Every page still serves
   `private, no-cache, no-store, max-age=0, must-revalidate`;
   `X-Vercel-Cache: MISS` on 25/25 cache-busted fetches this week. TTFB
   medians measured 2026-08-18: home 627ms, /latest 590ms, /top-100 559ms,
   story 557ms, topic hub 538ms. Content only changes when the 30-min cron
   runs, so ISR (`revalidate = 300`) is a free LCP-floor and crawl-budget win.
   Do it carefully: verify `unstable_cache` interplay, and re-check archived
   stories, alias 307s and merge 308s after the change.
   Impact: LCP floor sitewide, and the biggest single CWV lever available.
   Status: OPEN

3. **Single-source story pages are thin.** ~170-210 words of main-content text
   per story (measured on 4 pages; better than the baseline's 25-100 estimate
   because the round-7 coverage modules now render, but still thin), much of it
   a publisher-supplied dek. Options, cheapest first: render each source's
   publisher-provided description in the Coverage section (already ingested,
   attributed, $0); always render the timeline and context modules; delay
   indexing until a second source or an original summary exists.
   Impact: the aggregator thin-content ceiling — the #1 strategic risk.
   Status: OPEN

4. **No evergreen content of any kind.** Competitor structure measured
   2026-08-18 from live sitemaps: AllSides publishes 7,005 indexable URLs of
   which **2,437 are `/blog/*` and 9 are `/media-bias/*` reference pages** —
   non-perishable content that ranks year-round and attracts the links a news
   archive never will. CurrentWire's only non-perishable pages are the 9 trust
   pages. Candidate hubs CurrentWire can write honestly from data it already
   has: how story ranking works in practice, what "coverage breadth" measures,
   a publisher-tier reference page. White-hat, no fabrication, and it is the
   standard answer to the thin-content ceiling.
   Impact: link acquisition and topical authority. Status: OPEN

5. **Category misclassification on live section pages** (found in the
   2026-08-18 daily crawl; classifier bug — fix belongs in `lib/news/` with
   benchmark coverage, per
   `MEMORY/2026-08-15-category-dedup-already-engineered.md`):
   - `/story/lakers-governor-jeanie-buss-says-siblings-cannot-sell-familys-stake-to-bob-iger-cdf300f9d9eea`
     filed under **politics** (ranked #7 on `/politics`) — "governor" is an NBA
     team-ownership title, a false positive on a role word.
   - `/story/theban-tomb-reveals-how-egyptian-burial-trends-evolved-in-time-c4e2e50b44255`
     filed under **technology** (ranked #8 on `/technology`) — it is archaeology.
   Impact: poisons the exact topical signal category pages rank on.
   Status: OPEN

6. **"Most covered" exists as data but not as a page.** `?sort=most-covered`
   canonicalizes to `/top-100` (verified live), so CurrentWire's most
   differentiated signal — how many independent outlets are covering a story —
   has no indexable URL. Ground News built its entire identity on this angle.
   A `/most-covered` route with its own canonical, title and ItemList is a
   small change against an already-computed field.
   Impact: the clearest content-gap win available. Status: OPEN

7. **Near-duplicate topic hubs from entity extraction.** Verified live
   2026-08-18: `/topic/big-bend` and `/topic/big-bend-national-park` both
   resolve, and `/topic/bay-giants` and `/topic/unitedhealthcare-ceo` still
   return 200 with zero stories. The thin ones are correctly `noindex, follow`
   and are excluded from the sitemap, so the damage is now crawl waste rather
   than index dilution — but the entity normalizer should still fold
   singular/plural and containment variants and drop headline-fragment bigrams.
   Fix in entity normalization with benchmark coverage. Status: OPEN

8. **Archived stories have no HTML browse path.** 1,520 of 1,720 permanent
   story URLs appear only in `archive-sitemap.xml` — no page on the site links
   to them except the occasional topic hub. Sitemap-only discovery works, but a
   dated or topic-based archive index would make them properly reachable (and
   pairs naturally with item 1).
   Impact: crawl depth on 88% of the URL inventory. Status: OPEN

## Open — polish

9. **Publisher logo for News surfaces**: `NewsArticle.publisher.logo` is still
   the 408-byte generic `logo.svg` with no width or height. Replace with a
   route-generated wordmark PNG with explicit dimensions. Status: OPEN
10. **No font preload**: Inter and Archivo are self-hosted with
    `font-display: swap`, but the head carries zero `rel="preload"` woff2
    links (measured 2026-08-18), so headline text repaints after CSS parse.
    Preloading the two headline weights is a small, safe CLS/LCP win.
    Status: OPEN
11. **/topics has no JSON-LD** — add CollectionPage. (`/latest`, `/sources` and
    `/source/*` got ItemList on 2026-08-18.) Status: OPEN
12. **Trust pages carry no JSON-LD** — AboutPage/WebPage with `publisher` on
    /about, /methodology, /editorial-standards and /corrections would make the
    E-E-A-T pages machine-readable, not merely crawlable. Status: OPEN
13. In-body interlinking between trust pages is partial (about to standards,
    contact to corrections). Corrections to standards shipped 2026-08-15; the
    rest is open. Status: OPEN
14. `/contact` is 77 words — the thinnest trust page. Status: OPEN
15. Warm the hero `/_next/image` URL right after each cron refresh so first
    viewers hit the edge cache (one curl in the cron, $0). Note: the hero image
    already measured `X-Vercel-Cache: HIT` at 12KB/393ms on 2026-08-18, so this
    is lower value than it looked at baseline. Status: OPEN (low)
16. Shard `/archive-sitemap.xml` via generateSitemaps when the archive
    approaches 40,000 stories — 1,720 today, so this is years away.
    Status: OPEN (future)

## Blocked on owner (free keys/accounts — the only human steps that exist)

17. **Google Search Console**: verified 2026-08-14 with sitemap.xml and
    news-sitemap.xml submitted. Remaining: submit `archive-sitemap.xml` in the
    GSC UI, and optionally create a free API service account so the daily loop
    can pull clicks, impressions and coverage. No billing. Status: BLOCKED(user)
18. **Bing Webmaster Tools**: verify the site (can import from GSC), get the
    free API key. IndexNow pings already flow without it. Status: BLOCKED(user)
19. **PageSpeed Insights API key** (free, no billing): the keyless endpoint
    returned HTTP 429 `RESOURCE_EXHAUSTED` again on 2026-08-18, and the CrUX
    API returns 403 without a key. Until one exists there is no lab or field
    Core Web Vitals data; this run measured TTFB, transfer weight and asset
    strategy instead, which cannot substitute for LCP/INP/CLS.
    Status: BLOCKED(user)

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
