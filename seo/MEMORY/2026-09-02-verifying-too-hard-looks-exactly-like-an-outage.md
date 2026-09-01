# Verifying too hard looks exactly like an outage

**2026-09-02.** After pushing `6c63626` the run needed to know when the deploy
had landed, so it polled the homepage — a 40-iteration loop with no sleep,
then a background loop every 15 s, on top of ~20 measurement fetches. Minutes
later **every surface answered `403` with `X-Vercel-Mitigated: challenge`**:
`/`, `robots.txt`, `sitemap.xml`, `news-sitemap.xml`, `archive-sitemap.xml`
and `/rss`, for a browser UA, a Googlebot UA and plain curl alike, serving a
"Vercel Security Checkpoint" interstitial instead of the site.

In crawl-signal terms that is the same shape as the 2026-08-24 402: every
sitemap and `robots.txt` refusing to answer. **It was not an outage.** Vercel's
bot mitigation is per-client, and the client it had decided about was this
loop's own IP — provoked by this loop's own verification.

Three things worth keeping:

1. **Blanket 4xx across every surface at once, right after a burst of
   self-traffic, is a claim about the observer before it is a claim about the
   site.** Check `X-Vercel-Mitigated` / `X-Vercel-Challenge-Token` in the
   headers: mitigation names itself, and no code change can fix it because
   nothing is wrong with the code. Distinguish it from 402
   `DEPLOYMENT_DISABLED` (account state, real outage) and from a 5xx.
2. **Get an independent vantage point before escalating.** `uptime.yml` runs
   every 30 minutes from GitHub's IPs, and its API is readable unauthenticated
   (`actions/workflows/uptime.yml/runs`). A green run created *after* the
   suspect moment is the cheap proof that only the local view is broken. Do
   not push an outage to the owner off a single-IP reading — the standing
   alerting rule says an outage is the run's only priority, and spending a run
   on a self-inflicted rate limit is the expensive failure mode here.
3. **Back off first, immediately.** Polling harder is what caused it, so the
   fix is to stop every loop still running (this run had a 15-second
   background poll still firing while it diagnosed) and wait. Deploy detection
   should be paced in minutes, not seconds, or driven off the GitHub check-run
   API rather than the site itself.

**The rule:** the loop's verification method can destroy the loop's ability to
verify, and the failure is indistinguishable from the outage it exists to
catch. Poll the build system, not the product; and when everything is broken
at once, suspect the instrument first.

Related: `2026-08-21-an-outage-is-not-a-fact-about-the-world.md` (the same
epistemics from the other side — an outage report is a reading, not a fact),
`2026-08-21-the-instrument-breaks-first-and-quietly.md`. Note also that
`scripts/seo-health.mjs` chases every news-sitemap URL — 740 on 2026-09-02 —
so it is itself a burst; it has not tripped mitigation, but if it ever starts
failing wholesale, read the headers before believing the site is down.
