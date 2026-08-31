# Cache the thing, not the question that found it

**2026-09-01.** `seo-health` failed on `/news-sitemap.xml`: the canonical URL
of cluster `c9e0f30ebe2a1` answered `308` to `…-c343d2e6168bf`. The obvious
reading — the feed is advertising a merged URL — was WRONG, and the check's
own cross-check said so: `/api/stats/archive-sources` reported the advertised
cluster `merged: false` and its redirect target `merged: true`. The sitemap was
right. The story route was sending the survivor to the duplicate.

The cause was not invalidation. It was the **key**. `findArchivedStory` was
`cachedRead` keyed by the raw lookup string, so ONE `story_archive` row was
cached once per alias — canonical slug, bare cluster id, every retired slug a
rename left behind — each with its own independent 6-hour TTL. Three URLs of
one story, measured live within ten minutes of each other, all cache `HIT`s:

```
/story/<slug>-c9e0f30ebe2a1   308 -> …-c343d2e6168bf
/story/<slug>-c343d2e6168bf   200
/story/c9e0f30ebe2a1          307 -> <slug>-c9e0f30ebe2a1
```

**The rule:** if a lookup accepts several spellings of the same identity, the
cache key must be the identity, not the spelling. Otherwise one record becomes
N independent copies that drift apart the moment a mutable field
(`merged_into_cluster_id`) flips — and no entry is ever *stale in its own key's
terms*, so nothing looks broken from inside. `revalidate`, TTL tuning and tag
invalidation are all powerless here; they answer "when does this refresh",
and the defect is "how many of this are there".

Two things this made cheap, worth copying:

- **Re-keying REMOVES reads.** Aliases now share one entry, so the fix was free
  against the ISR/database budget the playbook protects — no TTL had to move.
- **The check that caught it had already done the hard part.** It re-fetched to
  rule out a rename race, then asked the archive who was merged, and failed
  only because the answer contradicted the redirect. A probe that reports a
  disagreement *and the authority it checked against* turns a two-hour
  forensics job into a five-minute one — and here it also stopped the loop
  from "fixing" the sitemap generator, which would have suppressed a correct
  entry. Build that cross-check into probes.

Related: `2026-08-28-every-cached-response-needs-an-owner.md` (same route, the
invalidation half of the problem — this is the key half),
`2026-08-21-the-instrument-breaks-first-and-quietly.md`.
