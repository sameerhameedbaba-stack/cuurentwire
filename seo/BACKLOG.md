# SEO Backlog

Prioritized from the 2026-08-15 baseline audit (six parallel auditors, evidence in
`reports/2026-08-15-baseline.md`). Statuses: OPEN / SHIPPED / BLOCKED(user).
Verify a fix live before flipping it to SHIPPED.

## Open — high value

1. **Story meta descriptions can be mashed text** — the description builder can
   concatenate dek + body copy without punctuation and truncate mid-sentence
   (live example: the Forest Service story repeated the subject's name and ended
   in "…"). Fix in the summary/description pipeline: use only the first sentence
   group, cap ~155 chars on a sentence boundary. Needs unit tests against the
   313-story benchmark data. Impact: SERP CTR. Status: OPEN
2. **No CDN caching on HTML** — story pages, home, and /top-100 serve
   `no-store`, every crawler hit is a full origin render (TTFB 0.33–0.68s).
   Content changes only when the cron runs, so ISR (`revalidate = 300`) is free
   CWV + crawl-budget win. Do it carefully: verify unstable_cache interplay,
   check archived-story and merge-redirect paths still work, then measure.
   Impact: LCP floor sitewide. Status: OPEN
3. **Topic-page duplication from entity extraction** — junk topics
   (/topic/bay-giants from "Back to the Bay: Giants") and near-duplicates
   (/topic/unitedhealthcare-ceo, -ceos, /topic/ceo-brian-thompson) spend crawl
   budget on thin duplicates and dilute topical signals. Fix in entity
   normalization (singular/plural folding, merge "X CEO" variants, drop
   headline-fragment bigrams), with benchmark coverage. Status: OPEN
4. **Single-source story pages are thin** (~25–100 words, partly verbatim source
   excerpts). Options measured by the audit: render each source's
   publisher-provided description in the Coverage section (attributed, already
   ingested, $0, adds extractable text), always render timeline/context modules,
   and/or delay indexing until a second source or original summary exists.
   Impact: aggregator thin-content ceiling — the #1 strategic risk. Status: OPEN

## Open — polish

5. Hero image: ensure `fetchpriority="high"` reaches the rendered img + preload
   (audit found the preload without it); eager-load the first 3–5 /top-100
   thumbnails (all 22 currently lazy). Status: OPEN
6. /topics and /latest have zero JSON-LD — add CollectionPage/ItemList. Status: OPEN
7. Publisher logo for News surfaces: replace 408-byte generic logo.svg reference
   with a proper wordmark (route-generated PNG, explicit width/height) in
   NewsArticle publisher.logo. Status: OPEN
8. Story `<title>` can exceed 60 chars for long headlines — decide truncation
   policy (headlines are kept truthful; maybe drop the " | CurrentWire" suffix
   when long). Status: OPEN
9. In-body interlinking between trust pages is partial (about→standards,
   contact→corrections etc.). Corrections→standards link shipped 2026-08-15;
   rest open. Status: OPEN
10. Warm the hero `/_next/image` URL right after each cron refresh so first
    viewers hit the edge cache (one curl in the cron, $0). Status: OPEN
11. Shard `/archive-sitemap.xml` via generateSitemaps (v16 `Promise<string>` id
    signature) when the archive approaches 40,000 stories — single file is fine
    for years at current volume. Status: OPEN (future)

## Blocked on owner (free keys/accounts — the only human steps that exist)

12. **Google Search Console**: already verified (2026-08-14) with sitemap.xml +
    news-sitemap.xml submitted. Remaining: submit the new archive-sitemap.xml
    in the GSC UI, and optionally create a free API service account so the
    daily loop can pull clicks/impressions/coverage. No billing. Status: BLOCKED(user)
13. **Bing Webmaster Tools**: verify the site (can import from GSC), get the free
    API key. IndexNow pings already flow without it. Status: BLOCKED(user)
14. **PageSpeed Insights API key** (free, no billing): keyless quota was 0 at
    audit time, so CWV lab data needs a key. Status: BLOCKED(user)

## Shipped 2026-08-15 (baseline round)

- NewsArticle dateModified could precede datePublished — clamped (JSON-LD + og
  modifiedTime), unit-tested. SHIPPED
- Homepage had no canonical/og:url — added (with RSS alternate preserved). SHIPPED
- www.currentwire.us served the whole site as a duplicate host — permanent
  host redirect to the apex added in next.config. SHIPPED
- /top-100?page=2..4 canonicalized to page 1, hiding ranks 26–100 — per-page
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
- apple-icon (180×180) + theme-color viewport export added. SHIPPED
- 404 page had the homepage title — own title + noindex. SHIPPED
- Corrections page: honest corrections-log section + editorial-standards link. SHIPPED
