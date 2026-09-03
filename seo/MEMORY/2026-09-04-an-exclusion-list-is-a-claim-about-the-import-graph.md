# An exclusion list is an unchecked claim about the import graph

**2026-09-04.** `vercel.json` skipped the build whenever a commit touched
nothing outside `seo/`, `docs/`, `data/`, `.github/` and top-level `*.md`. That
list is a cost control and a good one — report commits land ~12x/day and every
deploy wipes the ISR cache. It is also a **claim**: "nothing in these paths ends
up in the bundle."

For `data/` the claim was false, and had been since 2026-08-24. Three files
under it are static imports:

```
data/gsc-url-signals.json  -> lib/seo/gsc-signals.ts   (thin-story noindex policy)
data/lost-stories.json     -> lib/news/story-resolution.ts (tombstone 404 vs 500)
data/benchmark-history.json-> app/admin/status/page.tsx
```

So a commit changing one of them was skipped, and production went on serving
whatever copy the last *unrelated* build happened to compile. Measured by
running the real ignore script against real history: three GSC commits that each
rewrote `gsc-url-signals.json` all exited `0 = skip`. The tombstone commit
`593e369` shipped **only because it happened to touch `tests/` as well** — a
tombstone touching only `data/lost-stories.json` would have left dead story URLs
answering 500 to crawlers indefinitely.

Nothing was wrong with either half on its own. The exclusion was written for
paths that were data at the time; the imports were added later. Nothing in the
repo compared them, so the divergence was silent and free.

**Why it hid so well.** Both the wrong belief and its consequence were
comfortable. Two comments in the codebase asserted the opposite of reality —
`.github/workflows/gsc.yml` said the weekly commit "triggers a Vercel deploy —
that is intended" — and the one visible symptom, a thin-story policy that never
noindexed anything, looked exactly like a policy correctly deciding not to act,
because its staleness fallback fails safe.

**How to apply.** When a rule enumerates paths — an ignored-build step, a
Docker `.dockerignore`, a lint or test scope, a deploy filter — treat the list
as a hypothesis about the dependency graph and go check it:
`grep -rn "from ['\"].*<excluded-dir>/" app lib components`. Then make the
reconciliation a **test**, not a comment, because the graph will keep moving.

And fix it by narrowing, never by widening: keeping `:(exclude)data` and ANDing
a second diff over the three compiled-in files preserved the cost control (the
two data files that are *not* compiled in still skip) while closing the hole. A
rule that is wrong at one boundary is rarely wrong everywhere — deleting it
trades a silent correctness bug for a loud cost one. See
[[2026-08-22-a-cost-fix-can-move-a-correctness-boundary]], of which this is the
second instance in two weeks.

**Verify it end to end.** The proof was not that the new diff looked right. It
was `471221b` — a commit touching only `data/` — producing Vercel deployment
`6254065183`, **success 42 seconds later**, where the old rule produced no
deployment record at all.
