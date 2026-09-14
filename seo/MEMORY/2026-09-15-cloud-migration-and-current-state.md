# 2026-09-15 — Cloud migration + the current state of everything

The owner moved the SEO automation from local scheduled tasks (which ran only
while their PC was on) to **cloud routines**. This memo is the state handoff:
a cloud agent starts with zero context, so read this before acting on
anything dated earlier. Facts below were verified on 2026-09-15.

## Money — owner order: $0, "not a single dollar anywhere"

- **Vercel: downgraded Pro → free Hobby, effective 2026-09-15.** The account
  had been on Pro since ~Aug 24; Pro metered the aggregator's activity at
  ~$66/cycle (Observability Events $23.85, ISR writes $17.66, Fluid CPU
  $14.51, rest small). On Hobby nothing can bill — the project hard-stops at
  free limits instead. NEVER re-enable a paid plan, add-on, trial, or
  marketplace paid tier.
  **Corrected 2026-09-15 from the dashboard: there is NO outstanding bill.**
  Every invoice reads Paid — August: Pro $23.60, Neon marketplace $11.35,
  Observability $0. The "~$65.91 final Pro invoice / $14.74 Neon" figures
  this memo carried were *projections of an in-flight cycle*, not amounts
  billed; they never posted as stated. No run should ever send the owner to
  hunt for an unpaid invoice.
- **Neon: downgraded Launch → Free, effective 2026-09-15.** The database is
  the Vercel-Marketplace product "neon-cobalt-school" (Neon ID
  misty-butterfly-35277269) under the team's Neon integration — NOT a
  standalone Neon account. Data verified intact after the change by SQL:
  31,344 story_archive rows, 23 daily_briefings, 192 MB total (free limit
  0.5 GB/project). Free compute allowance is **100 CU-hours/month**; the old
  5-minute-cron aggregator burned ~11 CU-h/day, so relaunching it unchanged
  would suspend the DB mid-month (it suspends, never bills). Any relaunch
  plan must respect this.
- Only paid thing the owner keeps: their Claude subscription. **No
  Anthropic API** — owner's explicit decision; article writing runs on the
  subscription.

## Site status

- **currentwire.us answered 503 (DEPLOYMENT_PAUSED) from 2026-09-12**
  (~11:49 UTC): the Vercel on-demand budget ($45) was reached and Pause
  Projects fired. **Since 2026-09-14 it answers `402 DEPLOYMENT_DISABLED`
  instead** (re-measured 2026-09-14 21:46 UTC on `/` and
  `/archive-sitemap.xml`).
  **The 402 is the Hobby-plan USAGE pause, not a payment problem** —
  owner-verified on the dashboard 2026-09-15: "Paused – Upgrade to resume
  service", driven by Pro-period usage over the Hobby caps (Fluid Active CPU
  122h33m/4h, ISR Writes 4.8M/200K, Fast Origin Transfer 61.56 GB/10 GB,
  Edge Requests 2.1M/1M, ISR Reads 1.3M/1M, Function Invocations 1.2M/1M).
  The 402 body string "Payment required" is Vercel's generic text for the
  status code and means nothing about this account. **It lifts on its own at
  the billing-cycle reset, ~2026-09-24**; the only button offered is Upgrade,
  which the owner refuses under the $0 rule. So there is nothing to unpause
  and nothing to pay — the live question is only whether the *slim relaunch*
  is ready before the reset, which is the owner's scope call.
- Effect already measured in GSC (28-day windows): 2,084 impressions / 48
  clicks / 591 URLs on Sep 7 → 1,296 / 40 / 433 by Sep 14. That collapse is
  the outage, not a penalty — do not misread it in trend analysis.
- Domain healthy (registered to 2027-08-13, DNS on Vercel, SSL to Nov 11)
  and the **google-site-verification TXT record is RESTORED** (owner re-added
  it at Hostinger and re-verified the property; confirmed 2026-09-14 21:46
  UTC by dns.google and cloudflare-dns.com, which agree on
  `google-site-verification=jXmPQ…D2rY` at the apex, TTL 14400). Search
  Console ownership is no longer at risk — this is off the owner checklist.
  Re-open only on a failing DNS query made in the same run.

## Strategy decisions taken with the owner (2026-09-15)

- Direction: stop mass aggregation as the product; pivot to ~**10 original,
  multi-source-researched articles per day TOTAL** (not per vertical),
  written with Claude on the owner's subscription, starting in low-risk
  verticals (technology/business/science), scaling only on 4 weeks of
  evidence (rising impressions/clicks per article, no manual actions,
  spot-checks passing).
- Review model: auto-publish low-risk verticals; the **owner personally
  approves** anything naming a private person in a crime context, courts,
  health, or money advice. Accusations always attributed and 2+ sources or
  the piece doesn't run. AI-assistance disclosure on every article; no fake
  human bylines; corrections policy page.
- Before any hosting migration: the ~16k existing /story/ URLs must get a
  deliberate fate (301 or intentional 410 — never a lingering 503/404).
- These are recorded decisions, not yet implemented — the site is still
  paused. Implementation starts when the owner says relaunch.

## Automation topology after this migration

- The three local scheduled tasks (seo-daily-loop, seo-weekly-deep-run,
  seo-offpage-weekly) on the owner's PC were **disabled on 2026-09-15** and
  are superseded by cloud routines whose instructions live versioned in
  **seo/routines/*.md** in this repo. Edit those files to change routine
  behaviour — the cloud prompt only points here.
- The off-page routine stays **disabled until the site is live** (pitching a
  503 site burns bridges).
- Cloud agents have no owner browser, no dashboards, no local files from the
  owner's PC. Dashboard-only steps (GSC UI, Bing, GA4, Hostinger DNS) are
  owner-checklist items, never attempted by an agent.
- The standards of 2026-09-04 remain in force everywhere: no claim without
  evidence from THIS run; verify the outcome, never a proxy; never mix
  measurement tools; test the boundary a change moves; watch the write path.
