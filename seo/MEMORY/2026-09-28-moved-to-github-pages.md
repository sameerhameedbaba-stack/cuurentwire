# 2026-09-28 — Production moved to GitHub Pages (static), and what it taught

## State, as of this session

- **Owner order: "I don't wanna pay a single penny… find a way and get it
  done."** Vercel's free Hobby plan had paused the site (402
  DEPLOYMENT_DISABLED) since 2026-09-14 and did NOT lift at the ~09-24 cycle
  reset everyone was counting on. Its only offer was "Upgrade". So production
  left Vercel.
- **New production:** a static export served free by **GitHub Pages** from
  this public repo. No new account, no card, no usage-based pause, no paid tier
  to fall into. Built by `scripts/build-static-site.mjs`, deployed by
  `.github/workflows/pages.yml` on every push to `main`. Its `gate` job skips
  quietly while Pages is off, and an hourly run deploys `main` by itself once
  Pages is switched on (added 2026-09-30, so the switch-over needs no
  "merge it" / re-run step from anyone).
- **What the static site is:** original articles (`content/articles/`, read
  at build time), `/articles`, section pages for the launch verticals, the
  trust pages (rewritten for the publisher model), `sitemap.xml`, `rss.xml`,
  `robots.txt`, `llms.txt`, the IndexNow key file. Everything else — the whole
  aggregator: `/story/`, `/latest`, `/top-100`, `/briefing`, news and archive
  sitemaps, `/api` — is pruned from the static build and answers 404.
- **The Vercel app is untouched** in `app/` and still builds, as a fallback.
  Vercel git deployments are OFF (`vercel.json` `git.deploymentEnabled:
  false`) so a lifted pause can never quietly redeploy the aggregator and burn
  the caps again. Its cron is daily, not 15-minutely, for the same reason.
- **Launch content:** two original articles (Starship's first orbit; Nvidia's
  agent-safety platform), written from real reporting through the new
  pipeline. Held: an OpenAI story (one AP report on three sites) and a
  fuel-economy story (independence unverifiable, politically charged).
- **Owner-only steps to go live** are listed in `seo/reports/2026-09-28.md`:
  merge to `main`, switch Pages on, point Hostinger DNS at GitHub Pages, set
  the custom domain, enforce HTTPS, and tidy Search Console.

## How the static build works (so nobody re-derives it)

`build-static-site.mjs` copies the repo to `.static-build/`, deletes every
`app/` entry not on its `KEEP_APP` allowlist, copies `site/` over the top
(static versions of `/`, `/[category]`, `/about`, `/news-desk`,
`/editorial-standards`, `sitemap.ts`, `robots.ts`, `rss.xml`, `llms.txt`),
builds with `NEXT_PUBLIC_SITE_MODE=static`, and then **checks the output**:
every internal link in every page, and every URL in llms.txt / sitemap / RSS,
must resolve to a file that exists, or the build fails. On its first run it
caught 7 broken links in page chrome; fed the old llms.txt, it caught 35.

`NEXT_PUBLIC_SITE_MODE` must stay a `NEXT_PUBLIC_` variable read literally:
the nav is rendered by client components, and a server-only variable would be
undefined in the browser — the server would render one nav and the browser
hydrate another.

## Lessons

1. **"It will clear itself on date X" is a plan only if something checks it
   on date X — and has an exit ready when it does not.** The routine's
   re-escalation trigger fired correctly on 09-25. What was missing was an
   exit that did not depend on the vendor. The exit turned out to be making
   the product static, which is also what the cost problem needed anyway.

2. **Count reports, not websites.** The gate's "2+ independent publications"
   counted domains, and RSS feeds carry no author field (all null, measured),
   so it could not see syndication. On the first live run it passed an OpenAI
   story carried by NPR, Global News and ABC News — one Associated Press
   article (NPR's byline read "The Associated Press"). CBC's Starship story
   was the AP text with units converted; CBS stories ended "The Associated
   Press contributed". The gate now merges ABC `/wireStory/` pages and
   near-identical headlines (threshold calibrated on those real pairs), and
   the writer checks bylines while reading. Two layers, because neither alone
   is enough.

3. **A test fixture can encode the bug.** When the gate learned to merge
   identical headlines, 13 tests failed — their "independent" fixtures used
   one headline for two outlets, i.e. they had been modelling syndication all
   along. The fix was the fixtures, not the rule.

4. **An outage is not evidence about the pages it hid.** Rebuilding the
   /story/ keep-list from the refreshed Search Console window (Sep 1-28, 17 of
   28 days dark) would have cut it from 123 URLs to 2. The builder now refuses
   a window more than 25% covered by an UNRESOLVED outage — counting every
   recorded outage was tried first and failed, because this site has no clean
   28-day window in its history.

5. **Retiring a thing can retire what it was quietly doing.** url-survival and
   surface-coherence also re-enabled every scheduled workflow against GitHub's
   60-day auto-disable. Removing their schedules would have taken that guard
   down. The test that asserts the guard caught it; the guard moved to uptime +
   seo-health.

6. **A trust page that describes the wrong product is worse than none.** The
   aggregator's /about said "we publish no AI-generated reporting". On a site
   that publishes AI-assisted articles that sentence is false. The static site
   carries rewritten pages, and a test keeps the false claims out of them.
