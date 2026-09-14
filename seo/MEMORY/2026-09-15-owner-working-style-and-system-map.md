# 2026-09-15 — Owner working style + system map (cloud handoff)

Interactive work on CurrentWire moved from the owner's local PC to
claude.ai/code cloud sessions. Local sessions kept some knowledge in a
PC-only memory folder; this file is the curated copy a cloud session needs.
Read it together with 2026-09-15-cloud-migration-and-current-state.md.
This repo is PUBLIC — never write secret values, card details or tokens
here; env var NAMES are fine, values live only in the Vercel dashboard.

## How the owner wants to work

- The owner is a non-developer product owner. Replies: short, plain
  English, outcome first, no jargon walls.
- Budget: $0. Refuses all extra spending. Free tiers only; never propose a
  paid upgrade as the path. (Settling an already-accrued bill is theirs to
  decide, never yours to click.)
- Automation: everything should run by itself — no manual news updates,
  no manual deploy steps.
- Browser work: the owner lets Claude drive their Chrome for dashboards
  and account settings, but THEY click logins, OAuth grants, payments and
  final approvals. A cloud session has no Chrome at all — list such steps
  for the owner instead.
- Verify, don't assert: check real accounts/plans/live responses before
  claiming anything; the owner has pushed back on unverified claims.
- Results over activity: never lead with "found/fixed N things". Lead with
  the scoreboard (visitors, clicks, impressions, position, referrals) and
  what moved. Between weekly scoreboards, contact only for outages or
  decisions only they can make.
- ChatGPT is used as a second reviewer: produce shareable Markdown briefs
  (secrets redacted); the owner pastes feedback back to implement.

## System map (verified 2026-09-15)

- GitHub `sameerhameedbaba-stack/cuurentwire` (typo intentional), branch
  `main` → Vercel project "currentwire", team slug `itsme-523d`, now on the
  FREE Hobby plan. Push to main = deploy (~1 min).
- Domain `currentwire.us` registered at Hostinger (to 2027-08-13); DNS at
  Hostinger: A `@` → 216.198.79.1 (Vercel), CNAME `www` → Vercel DNS,
  Hostinger mail records (MX/SPF/DKIM/DMARC), and TXT
  `google-site-verification=…` — NEVER remove it (ownership was lost once
  and re-verified on 2026-09-15).
- Database: Neon Postgres via the Vercel Marketplace integration (product
  "neon-cobalt-school"), FREE plan: 0.5 GB storage, 100 CU-hours/month.
- Vercel env var names: NEWS_DATA_MODE, NEWS_REFRESH_MINUTES, CRON_SECRET,
  ADMIN_SECRET, NEXT_PUBLIC_SITE_URL, RSS_FEEDS, DATABASE_URL, GNEWS_API_KEY,
  NEXT_PUBLIC_GA_MEASUREMENT_ID. Values: dashboard only.
- Search Console: domain property under the owner's Google account used for
  Google properties (authuser=1 in URLs). A service account
  (`currentwire-gsc-reader`, Full) feeds `.github/workflows/gsc.yml`
  through the GSC_SERVICE_ACCOUNT_JSON repo secret.
- GA4 measurement ID is public in the page source (NEXT_PUBLIC_…).
- Automation: GitHub Actions workflows in `.github/workflows/` (uptime,
  seo-health, url-survival, surface-coherence, cwv, gsc, bluesky-post) +
  cloud routines defined by `seo/routines/*.md` (daily loop, weekly
  scoreboard, off-page loop — off until relaunch).

## Why the site is down right now (2026-09-15)

402 DEPLOYMENT_DISABLED = Hobby usage pause, NOT an unpaid invoice (all
invoices paid). The weeks on Pro used far more than Hobby's monthly caps
(Fluid CPU ~122h vs 4h, ISR writes ~4.8M vs 200K, origin transfer ~62 GB vs
10 GB, edge requests ~2.1M vs 1M). The pause lifts at the cycle reset,
~2026-09-24. Relaunching the SAME aggregator would exhaust the caps again
within days — crawlers re-rendering ~16k pages is the main cost. The slim
relaunch (≈10 researched articles/day, far fewer live-rendered pages,
decided with the owner — see the cloud-migration memo) must be ready before
the reset.
