# A vague error message is where real defects hide

**2026-08-26.** `scripts/seo-health.mjs` had been reporting
`TypeError: fetch failed` on a news-sitemap URL. That string reads like a
network blip, and it was treated as one — the first instinct this run was to
add a retry and move on, on the theory that a thrown fetch is a fact about
the prober rather than about the site.

It was not a blip. Following the URL by hand found an **infinite 307 loop**
between two slugs of the same cluster, live on `/news-sitemap.xml`. Node's
`fetch` with `redirect: "follow"` throws a bare `TypeError: fetch failed`
for a redirect cycle; the real cause, `redirect count exceeded`, is on
`error.cause` and never reached the log. The instrument was not merely
unhelpful — it was *actively converting* a crawl-breaking defect into a
message that invited dismissal.

**The lesson has two halves, and the second is the one that nearly went
wrong.**

1. When an error message could describe either the tool or the thing it
   measures, assume nothing and reproduce it by hand. One `curl` settled it
   in seconds.
2. **The mitigation that makes an error less annoying can be the same change
   that makes it invisible.** Retrying was defensible on its own terms and
   would have shipped a check that quietly swallowed a real loop after two
   attempts instead of one. The retry only became safe once the failure was
   forced to *name itself* — chase the chain hop by hop, report
   `REDIRECT LOOP` with both URLs. Fix the diagnosis first; only then decide
   what to tolerate.

Corollary for this repo: a check whose failure detail is a stringified
exception is under-built. Every failure this suite reports should name the
site behaviour it found, not the client API that gave up.

Related: [[2026-08-21-the-instrument-breaks-first-and-quietly]],
[[2026-08-21-an-outage-is-not-a-fact-about-the-world]].
