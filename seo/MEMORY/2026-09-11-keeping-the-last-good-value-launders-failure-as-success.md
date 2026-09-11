# Keeping the last good value launders failure as success

**2026-09-11.** `data/gsc-daily.json` was five days stale. The run that was
supposed to refresh it — `gsc.yml` run #15, dispatched by the 09-10 loop for
exactly that purpose — reported **every step green** and produced **no commit
at all**. Every one of the seven `data/gsc-*.json` files still carried
`generatedAt 2026-09-07T13:39:11.445Z`.

The workflow is not broken: re-dispatched the same day, run #16 committed fresh
data normally. The secret is not missing: `gsc-crawl-freshness.yml`
authenticates with the same `GSC_SERVICE_ACCOUNT_JSON` and reached Search
Console hours earlier. It is intermittent, and its mechanism is still unproven
because reading the run log needs an authenticated `gh`.

## The lesson, and it is about a GOOD design

`scripts/gsc-report.mjs` deliberately keeps the previous file when a pull
fails. That discipline is correct and was added for good reasons, stated in the
code: *"an empty signals file would deploy 'no story has search signals' for a
week because of a GSC outage."* Blanking real data on a transient API failure
is worse than serving yesterday's.

But a writer that preserves the last good value on failure produces **the exact
same bytes on disk as a writer that had nothing new to say** — and, if the
failure happens early enough, the same bytes as a run that did nothing at all.
The protection against blanking is, unavoidably, a protection against ever
noticing.

So: **any "keep the previous value on failure" rule must be paired with a
freshness assertion, or it converts a loud failure into a silent one.** The
value kept is not the problem; the absence of a timestamp anyone checks is.

## What it cost, and how it was caught

Nothing on the site — this is a measurement path, not a serving path. But the
09-10 run dispatched `gsc.yml`, saw it go green, and reported its numbers as
"result lands after this report". They never landed. A run that believed it had
refreshed its instrument spent a day reading a five-day-old one.

It was caught only by comparing `generatedAt` to the calendar by hand. Nothing
in the repo does that.

## The rule

A scheduled writer needs a check on its OUTPUT, not its exit code. For
`gsc.yml` that is one assertion — `generatedAt` moved — and it is the same
shape as backlog item 0c, which was itself the answer to two consecutive weeks'
worst finding.

Generalised: when a job's success and its no-op are byte-identical, the job is
unmonitored no matter how green it is.

Related: [[2026-09-02-a-healthy-site-is-not-a-shipped-deploy]],
[[2026-08-31-serving-200-is-not-being-read]],
[[2026-08-21-the-instrument-breaks-first-and-quietly]],
[[2026-08-31-a-scheduled-writer-is-a-writer]].
