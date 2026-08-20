One-line: Every archive read caught its own failure and returned empty, so a
database outage and "that story never existed" arrived at the HTTP layer as the
same value — and the site spent a day telling crawlers that 1,322 permanent URLs
were **gone** and that it had **zero** archived stories.

Details: the Neon story archive stopped answering some time after 2026-08-19
22:20 UTC. No code caused it; the only commits in that window were reports. But
the site's *response* was code, and it was the real damage:

- `/archive-sitemap.xml` served **200 with an empty `<urlset>`**. That is not a
  neutral fallback. It is a well-formed, cacheable statement that the site has
  zero permanent story URLs, where it had advertised 2,793 the previous day.
- **1,322 of 1,329** published `/story/` URLs returned a hard **404** — the
  exact violation of the site's central promise ("live → 308 → archived 200 →
  404 never"), served for roughly 15 hours.

Both are *permanent* signals. They outlive the outage that produced them: 404
tells Google to drop the URL, and an empty sitemap invites it to.

Rules this leaves behind:

- **Never let "we failed to answer" and "the answer is no" be the same value.**
  Every read here funnelled no-DB, no-row and query-threw into `null`/`[]`. That
  is fine for a read that *enriches* a page and fatal for a read that *decides
  whether a URL exists*. Split them by what the caller does with the result:
  the ones that pick a status code must throw; the enrichment ones (first-seen
  dates, update history) must keep degrading quietly, which is exactly why live
  story pages were unaffected throughout.
- **Answer an outage with a retriable status, and pick it deliberately.** 503 +
  `Retry-After` + `no-store` on the sitemap; a 5xx rather than 404 on story
  pages. Next 16 gives a *page* no way to emit 503 — `next/navigation` exports
  `notFound`, `forbidden`, `unauthorized` and nothing else — so a thrown error
  (500) is the available retriable signal, and it must be thrown before the
  response starts streaming, the same constraint `notFound()` already had.
- **Make the status code a diagnosis.** "No `DATABASE_URL`" was deliberately
  kept as 404/200-empty, so the deploy itself answered the question nobody could
  answer from outside: production flipped to **503**, which proves the env var
  is set and the *database* is failing. That narrowed the owner's five-minute
  check from "Vercel or Neon?" to "Neon". A fallback that is honest about
  *which* failure occurred is worth more than one that merely survives.
- **A fix that cannot deploy during the failure it fixes is not a fix.** The
  first version also threw from `getArchiveBrowse`. `/archive` is prerendered at
  build time (`○` in the route table), so that would have failed `next build`
  whenever the database was down — i.e. exactly when the deploy carrying the fix
  had to succeed. Caught by reading the build's route table before pushing;
  reverted with the reason recorded in the code. **Check the route table for
  what runs at build time before making a data read throw.**
- **Keep a gate able to go green.** The URL-survival probe counted the outage's
  5xx as "no longer resolve", which would have hidden a real 404 regression
  under 1,555 lines of expected noise. `GONE` (4xx, promise broken) and
  `UNAVAILABLE` (5xx, bad day) are counted separately now. Same reasoning as the
  capped-vs-leverless image hosts in
  [[2026-08-20-ask-the-publishers-cdn-before-declaring-no-lever]].
- **Junk still 404s.** A slug with no well-formed cluster-id token (`c` + 12
  hex; 1,660 of 1,660 ledger URLs match) was never a story URL whatever the
  database says. Without that guard an outage answers 5xx to every scanner
  probe.

Also learned, and reusable beyond this incident:

- **Simulate the outage against the production build before pushing.**
  `DATABASE_URL=postgresql://u:p@127.0.0.1:59999/nodb npx next start` reproduced
  it exactly and proved all six behaviours (live story 200, published slug 500,
  junk slug 404, garbage 404, `/archive` 200, news-sitemap 200) before deploy
  rather than after. A dead port is a perfectly good broken database.
- **`data/url-ledger.json` is the measurement instrument for this class of
  bug.** It is what turned "some pages 404" into "1,322 of 1,329", and later
  into `GONE=0`. Merge it as a union (earliest `firstSeen`, latest `lastOk`)
  when two loops conflict on it — never by picking a side.

Related: [[2026-08-18-monitor-and-renderer-must-agree-on-the-field]] and
[[2026-08-19-declared-config-is-not-applied-config]] — both are the same family,
where what the code *says* and what the response *does* diverge. This one adds
the case where the divergence is created by a `catch` block that was written to
be helpful.
