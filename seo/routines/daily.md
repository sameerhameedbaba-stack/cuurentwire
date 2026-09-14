# Cloud routine: DAILY SEO LOOP — source of truth

This file IS the instruction set for the "CurrentWire SEO daily loop" cloud
routine (the cloud prompt just points here; edit this file to change the
routine). It supersedes the retired local scheduled task of the same name.

## CLOUD MODE — read first

- You run in Anthropic's cloud on a fresh clone of this repo; the repo root
  is your working directory. Nothing from the owner's PC exists here: no
  data/local/, no Chrome, no dashboards, no saved logins. Any step needing
  the owner's browser goes into the owner checklist at the end of your
  report — never attempt a login or dashboard yourself.
- FIRST read seo/MEMORY/2026-09-15-cloud-migration-and-current-state.md.
- **PAUSED-SITE / WATCHDOG MODE:** if https://currentwire.us/ answers 503
  **or 402**, do NOT run the full loop. Instead: record the status codes of /
  and /archive-sitemap.xml; check the google-site-verification TXT record
  (e.g. `dig TXT currentwire.us +short` or an equivalent DNS query) and
  report whether it is present; note the newest data/gsc-*.json numbers with
  the outage caveat; write a SHORT dated seo/reports/<today>.md; commit and
  push it; list owner-only items. A paused day is a quiet report, not an
  error, and never a reason to try to unpause anything.
- **402 DEPLOYMENT_DISABLED IS EXPECTED UNTIL ~2026-09-24 — DO NOT RAISE A
  BILLING ALARM.** Verified by the owner on the Vercel dashboard 2026-09-15:
  there is **no unpaid invoice**; every invoice reads Paid (August: Pro
  $23.60, Neon marketplace $11.35, Observability $0). The 402 is the free
  **Hobby-plan usage pause** — the dashboard reads "Paused – Upgrade to
  resume service" because the Pro-period usage sits over the Hobby caps
  (Fluid Active CPU 122h33m/4h, ISR Writes 4.8M/200K, Fast Origin Transfer
  61.56 GB/10 GB, Edge Requests 2.1M/1M, ISR Reads 1.3M/1M, Function
  Invocations 1.2M/1M). It lifts **by itself at the billing-cycle reset,
  around 2026-09-24**. The only button Vercel offers is Upgrade, which the
  owner refuses under the $0 rule.
  While this window is open, a 402 is **one quiet line in the report and
  nothing else**: do NOT tell the owner to hunt for a bill, do NOT put it on
  the owner checklist, do NOT propose Upgrade, and do NOT read "Payment
  required" in the response body as an unpaid invoice — that body text is
  Vercel's generic 402 string, not a statement about this account.
  Re-escalate to the owner ONLY if: (a) production is still 402 after the
  reset date, (b) the status code or `x-vercel-error` value changes again, or
  (c) you have same-run evidence contradicting the usage-pause reading. Each
  is a real change worth a message; the steady state is not.
  Background, so no run re-derives this: the ~$65.91/$14.74 figures in older
  notes were *projections* of an in-flight cycle, not amounts billed — the
  invoices that actually posted are the Paid ones above. See
  `data/incidents.json` (2026-09-14 outage entry) and
  `seo/MEMORY/2026-09-15-owner-working-style-and-system-map.md`.
- Commit and push only files you changed under seo/ and data/. If push is
  refused, put the full report text in your final message and say the push
  failed (that failure itself is an owner-checklist item: grant the cloud
  GitHub integration write access).

## THE TASK (full loop, when the site is live)

Run the daily SEO loop for https://currentwire.us (Next.js 16 App Router;
push to main → Vercel auto-deploy, now on the FREE Hobby plan — never
enable anything paid). Work autonomously; the owner reviews only your
report and spends ZERO time on this task.

Read next: seo/BACKLOG.md (its top block is the current ordered queue — do
NOT reorder it without re-reading the interaction list), seo/STRATEGY.md
(top section is the strategy shift), seo/PLAYBOOK.md (hard rules),
seo/MEMORY/ (lessons — follow them), and the most recent seo/reports/ file.

## THE STANDARD, ABOVE EVERYTHING ELSE (owner order, 2026-09-04)

A full audit found 38 incidents in three weeks, ALL self-inflicted and ALL
preventable, and the dominant pattern was that every fix planted the next
failure. The owner's instruction: "do not create more problems while fixing
the existing ones." These five rules outrank finishing any backlog item. A
day where nothing ships and nothing breaks is a GOOD day.

1. **NO CLAIM WITHOUT EVIDENCE.** Never write "fixed", "healthy",
   "deployed", "indexed", "fast" or "working" without a command output or
   fetch in the same run that proves it. Numbers copied forward from a
   previous report are not evidence — re-measure or don't state it.
2. **VERIFY THE OUTCOME, NEVER A PROXY.** A sitemap serving 200 was mistaken
   for Google reading it (17 days, 92% of URLs); a healthy site was mistaken
   for a shipped deploy (49 hours); CI-green was mistaken for deployed;
   merged was mistaken for live; a local probe was mistaken for PSI. Ask
   what the thing is FOR and measure that.
3. **NEVER MIX MEASUREMENT TOOLS.** Compare PSI to PSI only
   (data/cwv-history.json rows where tool === 'psi').
4. **TEST THE BOUNDARY A CHANGE MOVES.** If a change touches caching, deploy
   skipping, persistence windows, or TTLs, add the test that proves the new
   boundary before pushing. Two changes on one mechanism: test together or
   ship only one.
5. **CHECK THE WRITE PATH, NOT ONLY THE READ PATH.** The newest news-sitemap
   publication_date is the write path's heartbeat — read it every run.

## ORDER OF WORK

1. **Alerts and outage.** Check open "[auto-alert]" issues at
   https://github.com/sameerhameedbaba-stack/cuurentwire/issues and curl
   https://currentwire.us/ and /archive-sitemap.xml. Any 5xx on production
   IS the run's only priority — put it at the top of the report. Never mark
   an outage day routine. A **402 inside the known Hobby usage-pause window**
   (see CLOUD MODE above) is the one exception: it is already explained, so
   record it in one line and do not escalate it.
2. **Performance trend.** Read data/gsc-daily.json. Its `trend` compares
   the last 7 COMPLETE days to the prior 7; trailing `lagDays` are partial
   and must NEVER be read as a collapse. If a decline is `explained: true`,
   name the incident from data/incidents.json and move on. An UNexplained
   decline outranks all other work: investigate, append the cause to
   data/incidents.json, say so in one plain sentence. You may dispatch
   gsc.yml at most once per day (push a change to .github/triggers/gsc).
3. **Health and write path.** Run `node scripts/seo-health.mjs` against
   production. Any failure is top priority. Confirm the newest news-sitemap
   publication_date is recent.
4. **Crawl sample.** 2-3 new /story/ pages and 1-2 section pages: canonical
   correct, JSON-LD parses, no accidental noindex, sane category. File
   classifier/clustering bugs in BACKLOG.md with the URL — fixes belong in
   lib/news/ with benchmark coverage, never in templates.
5. **One backlog item.** Take the highest item from the ordered queue at the
   top of seo/BACKLOG.md that can be completed AND verified today. Before
   any push, all gates pass: `npx vitest run`; `npx tsc --noEmit`;
   `npx eslint app lib components config scripts tests`; `npx next build`;
   targeted `npx playwright test` when templates changed (if the cloud
   sandbox cannot run Playwright, say so explicitly — never skip silently).
   Push, wait for the deploy, then verify on the LIVE site before marking
   anything SHIPPED.
6. **Record.** Update BACKLOG.md statuses; add a seo/MEMORY/ note only for
   a durable lesson; write seo/reports/<today>.md with what was verified
   (with the evidence), what shipped, what regressed, what's next.

## REPORTING CONTRACT (owner order, 2026-09-01)

The owner does NOT want daily found/fixed reports. Write the dated report
file as the durable record, but the final message stays short and leads
with the scoreboard, not activity. Contact the owner between weekly
scoreboards ONLY for an outage or a decision only they can make. Never
present activity as progress. End with "Owner checklist" only when there is
something only the owner can do (dashboards, DNS, approvals).

## HARD RULES

$0 only — never sign up for anything, never enter payment details, never
enable a paid plan/add-on, skip anything needing billing. White-hat only;
never fabricate metrics. Never force-push, never delete data, never touch
the operator line on /about. Story-page copy must never use the word
"sources" (use "reports"/"publications"). If blocked on something only the
owner can do, list it at the end and continue with everything else.
