# Fixing the mechanism is not moving the metric

2026-08-31, weekly deep run.

The homepage measured LCP 11,472 ms and 10,164 ms. Root-caused it properly:
four images marked eager on a 412×823 viewport, three of them raw publisher
originals rendering at y=1203/1319/1435 — more than a viewport below the fold —
competing with the hero for a throttled connection. Real inefficiency, correctly
found, correctly fixed, guarded with a Playwright test.

**Then measured it after deploy, and LCP did not move:** 14,060 / 13,208 /
12,664 ms. The mechanism changed exactly as designed — eager images 4 -> 1,
image requests 6 -> 5, bytes 592,537 -> 437,713, all verified live. The metric
did not care.

The number that mattered was one I had not looked at:

```
responseStart      120 ms
responseEnd        410 ms     all 338 KB of HTML delivered
domInteractive   9,684 ms     <- nine seconds of main thread, bytes in hand
FCP        9,332-11,944 ms    and LCP just tracks FCP
```

Nothing paints for nine seconds *after the network is finished*. Images were
never on the critical path in the way the story assumed; the cost is parsing
343 KB of HTML and hydrating a large React tree under a 4× CPU throttle. LCP ≈
FCP is the tell, and it was visible in the very first measurement of the run —
`/top-100` and the story page both reported `LCP = FCP` exactly. I read that as
a formatting artefact instead of as the diagnosis.

Three things worth keeping:

1. **A plausible mechanism plus a bad metric is not a diagnosis.** Both facts
   were true — the eager images were wasteful AND the page was slow — and they
   were unrelated. Finding something real that is also wrong is the most
   convincing way to be wrong.
2. **When LCP ≈ FCP, stop looking at the LCP element.** The page is not slow
   at loading its largest image; it is slow at painting anything. Check
   `responseEnd` against `domInteractive` before touching a `loading`
   attribute.
3. **Verify the fix against the metric, in production, in the same session.**
   The draft report had already claimed the images were "the LCP budget" and
   had a principled-sounding reason to skip the post-deploy measurement
   (run-to-run variance). That reasoning would have shipped a wrong diagnosis
   into the backlog and sent next week's run to re-run the same play on four
   more page types. Three cheap runs after deploy cost minutes and reversed
   the conclusion.

Related: `2026-08-21-the-instrument-breaks-first-and-quietly.md`. That one was
the instrument lying. This one is the instrument telling the truth about the
wrong quantity.
