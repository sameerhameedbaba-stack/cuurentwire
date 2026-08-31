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

Usage:

    date -u +"%Y-%m-%dT%H:%M:%SZ" > .github/triggers/gsc
    git commit -am "chore: trigger gsc report" && git push
