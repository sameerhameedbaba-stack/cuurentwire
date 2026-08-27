# A rejected candidate is still a published value

**2026-08-28.** The category classifier has an ambiguity guard: on an exact
top-score tie it refuses to pick and files the story in the internal
`general` bucket, which is `noindex`. That guard was correct, tested, and
benchmarked. It was also, for its entire life, publishing the exact
categories it had just rejected onto indexable category pages — because it
wrote them into `CategoryResult.all`, and `all` is copied to
`Article.categories`, which drives the "Related coverage" rail on every
`/[category]` page.

Measured on production before the fix: **all 9 sampled category pages were
leaking, 24 general-bucket placements across 54 rail slots**; `/health` had
6 of 6. Against the 313-story truth set the tie path produced 40 such
placements and **31 (77.5%) did not match the human label** — which is
arithmetic, not bad luck, because a two-way tie lists the story on both
pages and at most one can be right.

**The lesson: one field was serving two masters.** `all` was read by whoever
wrote it as "candidates, for diagnostics" and by the renderer as "categories
this story belongs to". Nothing was wrong at either end. The defect lived in
the fact that a *decision to withhold* and a *routing signal* shared a
variable, so declining to publish and publishing twice were the same code
path.

**What to do with this:**

- When a guard rejects something, ask where the rejected value goes next.
  Rejection that leaves the candidate in a live field is not rejection.
- A field that a public template reads is a public API. Give diagnostics
  their own name (`rejectedCandidates` here) even when it feels redundant —
  the redundancy is what stops the next reader from routing on it.
- Test the *consumer*, not just the producer. The classifier's own tests all
  passed; `tests/unit/category-integrity.test.ts` had a synthetic dataset
  that reproduced the leak and simply never asserted against it.

See also [[2026-08-18-monitor-and-renderer-must-agree-on-the-field]] — the
same shape, one field read two ways — and
[[2026-08-15-category-dedup-already-engineered]] for why classifier fixes
belong in `lib/news/` with benchmark coverage rather than in templates.
