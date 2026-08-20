One-line: When the site broke, the first thing to produce a false number was
the monitoring script — `cwv-check.mjs` measured a 500 error page and wrote
"LCP 1,172 ms" into the vitals history as a story-page metric, and nothing
downstream could tell it from a real one.

Details: on 2026-08-21 the Neon story archive was unreachable and 1,322 of
1,329 published `/story/` URLs answered 5xx. `cwv-check.mjs` picks its
story-page target with `firstStoryUrl()` — the **first** `/story/` entry in
`data/url-ledger.json`, with no liveness check. That URL was serving a
9,353-byte error page. The probe loaded it, the browser's PerformanceObserver
reported real metrics about that error page, and the run appended

    { "url": ".../story/trump-asks-supreme-court-...",
      "lab": { "lcpMs": 1172, "cls": 0, "fcpMs": 1172, "ttfbMs": 99 } }

to `data/cwv-history.json`. **1,172 ms is a good number.** It is faster than the
real story pages, it sits inside the plausible range of every previous entry,
and the only thing marking it as garbage was a status code nobody had checked.
A week later it would have been a data point in a trend line.

Rules this leaves behind:

- **A monitoring script that chooses its own target must verify the target is
  healthy before reporting a number about it.** Not "did the request finish" —
  a 500 finishes. Assert the status code you expect. `firstLiveStoryUrl()` now
  probes candidates, requires a 200, and returns `null` (measuring two surfaces
  instead of three, with a warning naming the skipped URLs) when none answer.
- **Keep the target stable while the site is healthy, or the series is
  meaningless.** The fix probes ledger order *first* so the measured URL does
  not move week to week, and only falls back to the freshest verified-alive
  entries during an outage. A liveness check that silently re-picks a different
  page every run trades one bad metric for an uncomparable one.
- **Delete a known-bad row; do not leave it in the series with a note.** The
  history file is JSON with no comment support, and the next reader is a script.
- **When the instrument and a direct measurement disagree by an order of
  magnitude, the instrument is the suspect.** The same keyless probe reported
  2,842 ms TTFB for `/` while curl measured 134–386 ms warm with
  `X-Vercel-Cache: HIT`, and swung `/top-100` LCP 7,376 → 4,604 ms between two
  runs five minutes apart with no deploy in between. The weekly report declined
  to call that a regression and said so explicitly. **Reporting "LCP got worse"
  from an instrument you have just caught lying is how a fabricated metric gets
  laundered into a trend.**

The wider pattern, and the reason this is worth remembering: the outage's real
damage was never the database being down — it was that **three separate pieces
of code turned "I cannot answer" into a confident, permanent-looking answer.**
The archive reads returned empty, so callers emitted hard 404s on URLs the site
guarantees never 404 and a cacheable 200 claiming zero permanent story URLs
(fixed in `d060817`). The CWV probe measured the error page and called it
performance (fixed here). In every case the failure path produced something
that *looked* like a successful result. Ask of any error handler: **can a
caller tell this apart from success?**

Related: [[2026-08-18-monitor-and-renderer-must-agree-on-the-field]] — a monitor
checking a different field than the renderer emits. [[2026-08-19-declared-config-is-not-applied-config]]
— source reads correct, response is wrong; check the response.
[[2026-08-20-ask-the-publishers-cdn-before-declaring-no-lever]] — an analysis
that read well and only a fetch could disprove.

Also from this run: `seo-health.yml` and `url-survival.yml` both went red on
2026-08-20 at 07:27Z and 07:09Z and nothing acted for ~15 hours. That is the
third occurrence (2026-08-17, 2026-08-18, 2026-08-20). The alarms are correct
and early every time; there is no delivery. Do not describe this alerting as
loud without saying what "loud" actually reaches — `PLAYBOOK.md` now states the
detection latency honestly as up to ~24 h, bounded by the next agent loop.
