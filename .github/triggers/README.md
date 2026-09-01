# Manual workflow triggers

Each file here is a push-path trigger for the workflow of the same name.
Change the timestamp line and push, and that workflow runs — no `gh` auth,
no dashboard click, no `workflow_dispatch`.

Why this exists: on 2026-08-31 the Monday `gsc.yml` and `cwv.yml` schedules
did not fire (5 h past cron; the previous Monday they fired within 45 min),
and the weekly run could not dispatch them — the local `gh` token was invalid
and re-authenticating through the browser extension turned out to be
impossible, because GitHub's device-flow Authorize button never submits under
it. A weekly deep run that cannot refresh its own Search Console data is
exactly the kind of silent stall this repo has been bitten by before.

`.github` is excluded from `vercel.json`'s `ignoreCommand`, so touching these
files never triggers a production deploy.

`uptime` (added 2026-09-02) is the odd one out: it exists for *diagnosis*, not
for a missed schedule. When production looks dead from this machine, the first
question is whether it is dead or whether this machine has been blocked —
on 2026-09-02 the loop's own deploy-polling tripped Vercel's bot mitigation
and every surface, `robots.txt` and all three sitemaps included, answered
`403` with `X-Vercel-Mitigated: challenge`. Pushing this trigger gets a
second opinion from GitHub's IPs in about a minute, which is much faster than
the schedule (irregular in practice: 21:34, 18:42, 15:03, 10:21 UTC on
2026-09-01) and far cheaper than escalating a self-inflicted rate limit to the
owner as an outage.

Usage:

    date -u +"%Y-%m-%dT%H:%M:%SZ" > .github/triggers/gsc
    git commit -am "chore: trigger gsc report" && git push
