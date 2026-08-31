# A control proves ranking, not magnitude

2026-08-31, weekly deep run.

The local Playwright CWV probe reported `/` at LCP **11,472 ms**, then
**10,164 ms** on a re-run. This file's own history says this probe has produced
false numbers twice before, so I did the responsible thing and ran a control in
the same session under the identical throttle:

```
example.com        LCP    640 ms     <- harness can measure a fast page
bbc.com/news       TIMEOUT at 90 s   <- throttle is severe, not broken
currentwire.us /   LCP 10,164 ms
```

I concluded the number was real and wrote it into the report as the headline
performance finding.

Hours later, `cwv.yml` ran on CI — which has `PSI_API_KEY`, so it measures with
**real PageSpeed Insights** instead of falling back to Playwright — and said
`/` is **6,052 ms**. Not 11,472. The local probe is inflated by about 2×.

**The control was sound and my inference from it was not.** Ranking a trivial
page against a heavy one correctly proves the harness is *ordering* things
right. It says nothing about whether the absolute milliseconds transfer. A 4×
CPU throttle on an already-loaded Windows workstation is not the 4× throttle
Lighthouse applies on an idle CI runner, and no amount of controlling *within*
that environment can reveal the offset — the control and the subject share the
bias.

Three things worth keeping:

1. **Ask what a control actually rules out.** Mine ruled out "the harness is
   broken". It did not rule out "the harness is systematically slow here",
   which was the live hypothesis and needed a *different environment*, not a
   different page.
2. **Two runs of the same script can be two instruments.** `cwv-check.mjs`
   measures with PSI when a key is present and Playwright when it is not.
   Local and CI runs of that file are not comparable, and nothing in the output
   shouted that — the history entry's `tool` field is the only tell. Check it
   before comparing rows.
3. **Being careful is not the same as being right, and it is more dangerous.**
   The control made me *more* confident, so I stated 11.5 s plainly instead of
   hedging. The rigour bought unwarranted certainty. When a check comes back
   clean, the question to ask is still "what would this have missed?"

The conclusion survived — 6.05 s is still far above the 2.5 s Discover needs,
so the work is unchanged — but the report had to be corrected and the
`domInteractive 9,684 ms` figure derived from the same probe is inflated too.

Related: `2026-08-21-the-instrument-breaks-first-and-quietly.md` (the
instrument lied), `2026-08-31-fixing-the-mechanism-is-not-moving-the-metric.md`
(the fix was real, the metric did not care). This one is the instrument telling
a consistent, self-confirming, wrong-by-a-constant-factor story.
