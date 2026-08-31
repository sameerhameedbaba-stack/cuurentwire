# A scheduled job that commits results is a writer on a shared branch

2026-08-31, weekly deep run.

`gsc.yml` and `cwv.yml` both end by committing their output back to `main` and
running a bare `git push`. That worked for weeks. It worked because the two
crons are 23 minutes apart (07:17 and 07:40 on Mondays) and nothing else pushes
at that hour — not because the step was correct.

Adding a push-path trigger so a run could refresh its own data fired both
workflows **in the same second**, with an unrelated docs push landing between
them. Three writers, one branch. Both runs failed. And the failure was the
expensive kind: every data step succeeded — the Search Console API pull, the
full Playwright measurement — and only `Commit updated report` failed. The work
was done, paid for in quota and wall-clock, and thrown away at the last step.

Three things worth keeping:

1. **"It has never collided" is a property of the schedule, not of the code.**
   The correctness of that bare `git push` was being supplied entirely by a
   23-minute gap in a cron table. Any change to *when* things run — a new
   trigger, a retimed cron, a manual dispatch — withdraws that guarantee
   silently, and the code that depended on it does not know.
2. **Put the retry where the work is expensive, not where the failure is
   likely.** A push rejection is cheap to retry and catastrophic to ignore
   here, because what is lost is not the push but the quota-limited pull that
   preceded it. The fix is a rebase-and-retry loop with backoff, plus an
   `::error::` that says *generated but unsaved* so the next reader knows the
   data existed.
3. **A new mechanism's first run is a test of everything downstream of it.**
   The trigger itself worked perfectly on the first try. What it proved was
   that the thing it triggered had a bug — which is the most useful possible
   outcome for a mechanism whose entire purpose is to run those jobs more
   often.

Related: `2026-08-27-a-side-effect-gated-on-two-clocks-stops-happening.md` —
that was a write that stopped happening because two clocks drifted apart. This
is a write that stopped happening because two clocks came together.
