# A cost bound silently becomes a coverage bug when the population outgrows it

`LIVE_REVALIDATE_MAX = 150` was written on 2026-08-24 as a **cost** control:
the cron marks at most 150 live story paths per burst, instead of the
site-wide `revalidatePath` pattern nuke that blew the Hobby tier. It was
correct, it was well commented, and it was guarded by tests.

It was also, by 2026-08-29, a **coverage** bug — because the thing it bounds
had grown. `dataset.clusters` held **726** clusters
(`/api/stats/coverage`), and the code took `slice(0, 150)`: always the same
top 150 by ranking score. The other 576 live story pages (79%) were never
marked, and nothing else reached them — the story route carries a 30-day ISR
TTL, and an archive-rendered page performs no tagged read, so
`revalidateTag` misses it too. Pages could serve a frozen archived copy
indefinitely, with `dateModified` stuck and `isBasedOn` under-reporting
later pickups.

Nothing broke to cause this. The constant never changed; the population
grew past it. No test failed, because every test asserted the bound — which
was still being honoured exactly.

**The check that finds it, and it takes one fetch:** for every `slice(0, N)`,
`LIMIT`, `MAX_*` or `take(N)` on a growing collection, measure the
collection and read the RATIO, not the constant. `150 of 726` is a fact
about coverage; `150` alone looks like prudence.

**The fix shape that keeps both properties:** rotate the window instead of
raising it. A fixed head (the ranked pages that must always be fresh) plus a
rotating slice of the tail, with the cursor derived from the clock so a
serverless caller stays stateless, covers the whole population within
`ceil(tail / rotation)` invocations **at the identical per-invocation cost**.
Raising the cap would have been the obvious move and would have re-opened
the ISR-spend constraint the playbook protects.

Related: [[2026-08-22-a-cost-fix-can-move-a-correctness-boundary]] — the
same collision from the other direction, where a cost change moved a
correctness boundary. And [[2026-08-26-a-vague-error-is-a-hiding-place]]:
the surface-coherence alert had been reporting this for six days without
enough detail to name it, and shipping the missing stamp
(`cw-live-dataset-version`) both identified the class and immediately
disproved the run's first guess about which surface was stale.
