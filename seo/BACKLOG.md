# SEO Backlog

Re-prioritized 2026-08-18 from the weekly deep run (evidence in
`reports/2026-08-18-weekly.md`; daily-loop evidence in `reports/2026-08-18.md`);
statuses re-verified live on 2026-08-19 (`reports/2026-08-19.md`).
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

1. ~~**Story pages are internal-link dead ends.**~~ **SHIPPED** — fixed by the
   "Finish line" app commit (79e77e5, 2026-08-18) with the "More in
   {Category}" rail, exactly the separate honestly-labelled rail this item
   specified. Verified live 2026-08-19 on 3 of 3 sampled story pages: each
   renders "More in ..." and **4 outbound links to other stories** (was 0 on
   39 of 40 pages a day earlier). "Related coverage" is unchanged and still
   absent from story pages, which is the intended round-8 precision bar.
   Original text kept below for the measurement record.

   Measured 2026-08-18 across 40
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
   Impact: the largest remaining structural item. Status: SHIPPED (79e77e5,
   verified live 2026-08-19: 4 story links on 3 of 3 sampled pages)

2. **No CDN caching on HTML — dynamic routes.** **SHIPPED 2026-08-19.**
   Root cause found this run: `/story/[slug]`, `/topic/[slug]`,
   `/source/[slug]` and `/archive/[date]` all *declared*
   `export const revalidate`, and the cron already called `revalidatePath` on
   three of them — but Next 16 only applies ISR to a dynamic segment when the
   page **also exports `generateStaticParams`**. Without it the config line is
   inert; all four sat in the build's ƒ (Dynamic) bucket and served
   `private, no-cache, no-store` with `X-Vercel-Cache: MISS` on every fetch,
   including repeat fetches of the same URL. Each now returns `[]` (nothing
   prerendered at build; every URL cached on its first visit). Verified live
   after deploy: all four answer `X-Nextjs-Prerender: 1` +
   `public, max-age=0, must-revalidate`, `X-Vercel-Cache: HIT` on the second
   fetch, and **warm story TTFB 110–125 ms against the 557 ms median measured
   2026-08-18** (topic hub 102–126 ms vs 538 ms). Nothing regressed:
   `url-survival.mjs` checked 1,286 published URLs with 0 dead and 118
   redirects all resolving 200, merge 308s still 308, clusterId aliases still
   307, unknown story/source/date still 404, `seo-health.mjs` all green.
   Guarded by `tests/unit/isr-route-config.test.ts`.

2b. **`/top-100` and `/latest` are still `force-dynamic`** (measured
   2026-08-19: `no-store`, `X-Vercel-Cache: MISS`, TTFB 378–456 ms), because
   both read `searchParams` for filters and pagination. The unfiltered
   canonical URLs are the ones that matter for indexing, so the fix is a
   cached path for the no-params case, not removing the filters. Smaller and
   fiddlier than item 2 was; measure before assuming it is worth it.
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
   - ~~`/story/lakers-governor-jeanie-buss-...-cdf300f9d9eea` filed under
     **politics**~~ — FIXED by the classifier changes in 79e77e5; re-checked
     live 2026-08-19, it now reports `"articleSection":"Business"` (an
     ownership-stake dispute — correct).
   - `/story/theban-tomb-reveals-how-egyptian-burial-trends-evolved-in-time-c4e2e50b44255`
     still filed under **technology** (re-checked live 2026-08-19) — it is
     archaeology. No archaeology/history signal exists in the classifier, so
     it lands on technology by elimination; `science` is the honest bucket.
   Impact: poisons the exact topical signal category pages rank on.
   Status: OPEN (one of two fixed)

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

8. ~~**Archived stories have no HTML browse path.**~~ **SHIPPED** — `/archive`
   (day buckets by month, linked from the footer) and `/archive/<date>` landed
   in 79e77e5. Verified live 2026-08-19: `/archive` 200 with a self-canonical,
   `/archive/2026-08-18` 200 with BreadcrumbList + ItemList JSON-LD (both
   parse) and **623 outbound story links** on that one day page. Every
   permanent story URL is now reachable by real HTML links, not only sitemaps.
   Status: SHIPPED (79e77e5, verified live 2026-08-19)

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
16. ~~Shard `/archive-sitemap.xml` via generateSitemaps when the archive
    approaches 40,000 stories.~~ **CLOSED 2026-08-19 — converted from a human
    to-do into an automatic alarm.** `scripts/seo-health.mjs` now fails when
    `/archive-sitemap.xml` exceeds 45,000 URLs, ~5,000 short of the 50,000
    sitemap cap, with the fix named in the failure message. 2,163 URLs
    measured today, so it is still years away — but nobody has to remember it
    now. Status: SHIPPED (as monitoring)

## Was blocked on the owner — resolved 2026-08-19

17. ~~**Google Search Console — submit `archive-sitemap.xml` in the UI.**~~
    **CLOSED — not required.** `robots.txt` already advertises all three
    sitemaps, verified live 2026-08-19:
    `Sitemap: https://currentwire.us/sitemap.xml`,
    `.../news-sitemap.xml`, `.../archive-sitemap.xml`. Google discovers
    sitemaps from `robots.txt` without any UI action, so this was never a
    prerequisite for indexing — only for per-sitemap coverage *reporting*.
    Optional and entirely the owner's call; nothing is blocked on it. The
    free GSC API service account remains a nice-to-have for pulling
    clicks/impressions into the daily loop, also optional. Status: CLOSED
18. ~~**Bing Webmaster Tools.**~~ **DONE 2026-08-19** — site verified by GSC
    import (Administrator), all 3 sitemaps submitted, 0 errors; logged in
    `seo/offpage/LEDGER.md`. The optional free API key is not needed:
    IndexNow already pushes every new story to Bing within ~30 min, and
    DuckDuckGo and Yahoo source from Bing (see the coverage map in
    PLAYBOOK.md). Status: SHIPPED
19. ~~**PageSpeed Insights API key.**~~ **CLOSED 2026-08-19 — no key needed.**
    The keyless PSI endpoint still returns HTTP 429 (re-confirmed today), so
    `scripts/cwv-check.mjs` no longer depends on it. It now defaults to a
    keyless probe that drives the Chromium the e2e suite already installs,
    under Lighthouse's mobile throttling (4x CPU, 1638.4 kbps, 150 ms), and
    reads LCP/CLS/FCP/TTFB from the browser's own PerformanceObserver.
    First real measurement, 2026-08-19 (`data/cwv-history.json`):

    | Page | LCP | CLS | FCP | TTFB |
    |---|---|---|---|---|
    | `/` | **3,632 ms** | 0.001 | 1,912 ms | 135 ms |
    | `/top-100` | 1,628 ms | 0.006 | 1,628 ms | 90 ms |
    | story page | 1,588 ms | 0 | 1,588 ms | 281 ms |

    CLS is effectively zero everywhere and two of three pages have good LCP.
    A PSI key would only ever add CrUX *field* data on top, and CrUX needs
    real traffic volume this site does not have yet — so it would report
    nothing today even if the owner added one. `.github/workflows/cwv.yml`
    runs the keyless probe weekly and commits the history.
    Status: SHIPPED (keyless; PSI key optional, not blocking)

20. **Homepage LCP is 3,632 ms — the one bad Core Web Vital** (new, found by
    the keyless probe above on 2026-08-19; every other page measured good).
    Measured cause: the hero image is a **71,262-byte JPEG served from
    `ichef.bbci.co.uk`**, a third-party origin that needs DNS + TLS before
    the LCP element can even start downloading, and `next.config.ts` sets
    `images.unoptimized = true` so there is no resizing. Cheapest honest fix
    first: emit `<link rel="preconnect">` for the current hero image's origin
    (it changes per story, so it must be derived from the rendered hero, not
    hardcoded). Re-measure with `node scripts/cwv-check.mjs` after.
    Status: OPEN

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
