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
  marketplace paid tier. Final Pro invoice (~$65.91, cycle Aug 24–Sep 24)
  and Neon marketplace usage ($14.74, Sep 1–15) were already accrued and
  will still appear once — expected, not an incident.
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

- **currentwire.us has answered 503 (DEPLOYMENT_PAUSED) since 2026-09-12**
  (~11:49 UTC): the Vercel on-demand budget ($45) was reached and Pause
  Projects fired. After the Hobby downgrade there is no budget left to
  protect, so **unpausing is now free-safe — but it is an owner/strategy
  decision, not something a routine does on its own.**
- Effect already measured in GSC (28-day windows): 2,084 impressions / 48
  clicks / 591 URLs on Sep 7 → 1,296 / 40 / 433 by Sep 14. That collapse is
  the outage, not a penalty — do not misread it in trend analysis.
- Domain healthy (registered to 2027-08-13, DNS on Vercel, SSL to Nov 11)
  BUT the **google-site-verification TXT record is missing from Hostinger
  DNS** → Search Console ownership is at risk. The GSC API still answered on
  Sep 14 (grace, not safety). Restoring the TXT needs the owner's browser —
  keep it at the top of the owner checklist until confirmed re-verified.

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
