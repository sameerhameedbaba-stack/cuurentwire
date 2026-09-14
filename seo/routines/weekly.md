# Cloud routine: WEEKLY DEEP RUN — source of truth

This file IS the instruction set for the "CurrentWire SEO weekly deep run"
cloud routine (the cloud prompt just points here; edit this file to change
the routine). It supersedes the retired local scheduled task.

## CLOUD MODE — read first

- You run in Anthropic's cloud on a fresh clone of this repo (repo root =
  working directory). No owner browser, no dashboards, no local files from
  the owner's PC. Every dashboard-only step below goes to the owner
  checklist — never attempt logins.
- FIRST read seo/MEMORY/2026-09-15-cloud-migration-and-current-state.md.
- **PAUSED-SITE MODE:** if https://currentwire.us/ answers 503 **or 402**,
  produce the weekly scoreboard anyway — status of the pause, days down, the latest GSC
  numbers WITH the outage caveat, TXT-record presence (DNS query), and the
  single most important owner decision pending. Skip the audit score (say
  "not scored — site paused"), skip PSI, skip anything needing the live
  site. Short, honest, dated seo/reports/<date>-weekly.md; commit and push.
  A **402 DEPLOYMENT_DISABLED before ~2026-09-24 is the expected Hobby-plan
  usage pause, NOT an unpaid invoice** (owner-verified on the Vercel
  dashboard 2026-09-15; all invoices Paid). Report it as a known, dated,
  self-clearing state — never as a billing alarm, never as an owner action,
  and never with an Upgrade suggestion. Full rule and re-escalation triggers:
  seo/routines/daily.md, CLOUD MODE.
- Commit/push only seo/ and data/ changes; if push fails, include the full
  report in the final message and flag the access problem.

## THIS RUN PRODUCES THE OWNER'S ONLY SCHEDULED MESSAGE

Per the owner's order of 2026-09-01, they get **one weekly scoreboard** and
nothing else between them except outages and decisions. Lead it with
numbers, never with activity:

- **Total visitors across ALL channels** (GA4 + referrers + Bluesky +
  newsletter) — the headline number, not GSC clicks. (GA4 numbers need the
  owner's dashboard — if unavailable, say "GA4: needs owner" rather than
  guessing.)
- GSC: clicks, impressions, average position, indexed page count (from
  data/gsc-daily.json and data/gsc-indexation.json).
- Bing Webmaster AI-citation metrics — dashboard-only: owner checklist.
- Newsletter subscribers; Bluesky posts published and referral traffic.
- What moved, what did not, and the single most important thing next week.

If the numbers are bad, say so plainly in the first line.

## THE STANDARD (owner order, 2026-09-04) — outranks finishing the audit

1. No claim without evidence from THIS run; copied-forward numbers are not
   evidence. 2. Verify the outcome, never a proxy. 3. Never mix measurement
   tools — PSI vs PSI only (data/cwv-history.json rows where
   tool === 'psi'). 4. Test the boundary a change moves; interacting changes
   together or ship one. 5. Re-measure any runway or estimate before
   repeating it — never quote a forecast you did not just verify.

## THE RUN (site live)

Everything the daily loop does (seo/routines/daily.md), PLUS:

1. Full re-audit, fresh 0-100 score, same facet weighting as previous
   weeklies (crawl infra 20, story template 20, list templates 15, E-E-A-T
   15, GEO 10, performance 10, data quality & monitoring 10). Compare to the
   last weekly score in seo/reports/ and label each move as a genuine change
   vs a correction of a previously wrong score.
2. Core Web Vitals via the real PSI path only (cwv.yml has PSI_API_KEY;
   trigger it by pushing a change to .github/triggers/cwv). Never trust a
   local probe for the verdict.
3. Competitor content-gap snapshot vs Google News, AllSides, Ground News —
   evidence-based gaps only.
4. Refresh public/llms.txt if pages changed; verify live after deploy.
5. Verify the search-engine coverage map in PLAYBOOK.md still holds
   (robots.txt, sitemaps, IndexNow key file live).
6. **Owner-checklist dashboards** (never attempt from the cloud; Google
   properties are the ovyajewels@gmail.com / OVYA account, authuser=1):
   GSC Manual actions + Security issues; GSC Crawl stats; GSC Sitemaps
   report (discovered vs indexed); Bing Webmaster AI-citation metrics.
7. Read data/gsc-queries.json strikingDistance (position 5-20 by
   impressions) — it sets the CTR-rescue priorities.
8. Re-prioritise seo/BACKLOG.md from this week's evidence, but do NOT
   reorder the top queue block without re-reading its interaction list.
9. Write seo/reports/<date>-weekly.md: score + trend, wins with proof,
   losses with cause, next week's top 5. Commit and push.

## HARD RULES

$0 only — never sign up for anything, never enter payment details, never
enable a paid plan or add-on. White-hat only; never fabricate metrics. All
gates (vitest, tsc, `npx eslint app lib components config scripts tests`,
next build, playwright where possible) pass before any push. Never
force-push, never delete data, never touch the operator line on /about.
Story-page copy must never use the word "sources". List owner-only blockers
at the end and continue with everything else.
