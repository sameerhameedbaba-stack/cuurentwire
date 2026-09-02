# A guard that crashes is a gate that closes

**2026-09-03.** Production could not ship code for 49 hours. The cause was one
line in `vercel.json`:

```
git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':(exclude)seo' …
fatal: bad object f8805af4282c6a4405daca6b8961ea5ae092b42e
```

That command exists to *save money* — skip the build when a commit touched only
reports and data. It has three possible answers, and the code only ever
reasoned about two of them: **skip** (exit 0) and **build** (exit 1). The third,
**crash** (exit 128), was never considered, and Vercel reads it as a build
failure. A cost optimisation became a total outage.

Three lessons, in order of how much they generalise.

**1. Enumerate a guard's failure exit, not just its decisions.** Any predicate
that gates an expensive operation has a third outcome — "I could not decide" —
and something must define what that means. Here nothing did, so the platform
chose, and it chose the worst option. The rule now written into
`scripts/vercel-ignore-build.sh`: it may only ever exit 0 or 1, and when it
cannot answer it **builds**, because a needless build costs ISR writes while a
crashed one costs shipping entirely. Make the failure mode the cheap one, on
purpose, in writing.

**2. State that references "the last good run" can deadlock.**
`VERCEL_GIT_PREVIOUS_SHA` is the last **successful** deployment. The moment one
deploy failed, that pointer froze — and every subsequent commit pushed the
frozen commit further out of the shallow clone, making the next failure more
certain. The system could not recover on its own, and normal activity actively
deepened the hole. Whenever a retry compares against "the last one that worked",
ask what happens when nothing works: does it heal, hold, or dig?

**3. "No build ran" is not "nothing was logged."** This run inferred correctly
from timing that no build was being attempted — failures resolved in under a
second — and then concluded, wrongly, that the build log would therefore be
empty and the owner should check billing instead. The log was seven lines and
contained the entire answer, because the clone, the cache restore and the
ignored-build step all run *before* the build and are all logged. An inference
about a phase is not an inference about the record of that phase. Reading the
log cost one page load; the wrong conclusion would have cost the owner a wasted
trip and another day.

The meta-lesson binding this to [[2026-09-03-a-signal-dismissed-is-a-signal-unread]]:
both failures this week were **reasoning past an unread source** — first the
deployment statuses, then the build log. In both cases the evidence was one
cheap fetch away and the argument for not fetching it felt sound. Fetch it.

See also [[2026-09-02-a-healthy-site-is-not-a-shipped-deploy]] for why nothing
noticed for three days, and `.github/workflows/deploy-watch.yml` for the check
that now does.
