One-line: The daily and weekly SEO scheduled tasks can fire at the same moment
and work the same repo concurrently — coordinate by file, rebase before push,
and never trust a Playwright failure seen while both are running gates.

Details: On 2026-08-18 `seo-daily-loop` fired at 11:04:20Z and
`seo-weekly-deep-run` at 11:04:18Z (a weekly cron set for Monday ran on a
Tuesday catch-up, landing on the same tick as the daily). Both edited
`E:\Ccode\news`, both ran full gates, both pushed to `main`.

What worked and should be repeated:

- **Check `git log` / `git reflog` early.** The other agent's commit appeared
  mid-session and briefly looked like an impossible state (a file whose fix was
  present but whose deployed behaviour was stale). The reflog showed a
  concurrent `commit` + `rebase`, which explained it immediately.
- **Split by file, not by intent.** The daily loop owned
  `lib/seo/news-sitemap.ts` and `seo/reports/<date>.md`; the weekly run took
  templates, `sitemap.ts`, `BACKLOG.md` and `<date>-weekly.md`. Zero conflicts.
- **Let the other loop keep its own fix.** The weekly run independently found
  the news-sitemap window bug; the daily loop was already shipping it. Do not
  re-fix — verify their fix live and cite it.
- **Rebase, never force-push.** `git pull --rebase` before pushing; both
  agents' commits survived.

The trap: **Playwright failures are meaningless while both loops run gates.**
Two `next build` runs and two Playwright suites on one machine produced 1 then 4
failures, in a different set each time, at the default 10 workers. Every one
passed individually, all 51 passed at `--workers=3`, and a stashed clean-tree
control run also passed. Diagnose with a control run before believing a
regression — and prefer `--workers=3` when another loop may be active.
