# A sitemap serving 200 is not a sitemap Google reads

2026-08-31, weekly deep run. Found only because the owner said *"most of the
pages are unindexed now"* and I went to check instead of defending the number
I had published.

`seo/PLAYBOOK.md`'s coverage map has said since 2026-08-24 that three sitemaps
are submitted to Google. Every run since — including this one, twice —
"verified" that by fetching each URL and confirming 200 plus a valid `urlset`.
`scripts/seo-health.mjs` does the same, and passes.

Google's Sitemaps report lists **two**:

```
news-sitemap.xml    Last read Aug 24    618 discovered
sitemap.xml         Last read Aug 24    335 discovered
                                  total 953
GSC indexed pages                       951
archive-sitemap.xml  13,593 URLs  in robots.txt  ABSENT
```

**953 submitted, 951 indexed.** The sitemap carrying 92% of the site's URLs had
never been processed, and the indexed count had been sitting at almost exactly
the submitted count the whole time — a number that was visible on the dashboard
and that nobody had put next to the other one.

Three things worth keeping:

1. **The check verified the wrong end of the pipe.** "Does the file serve 200"
   is a property of our server. "Has Google read it" is a property of Google,
   and it is the one the playbook's claim was actually about. Fetching our own
   URL can never answer it. The GSC API exposes `lastDownloaded` per sitemap —
   that is the check that was missing, and both sitemaps had been unread for
   **seven days**, which nothing noticed either.
2. **A claim written into a playbook stops being re-derived.** "All three
   sitemaps submitted" entered the coverage map once and was thereafter
   re-asserted by every run, each citing a fetch that did not test it. Standing
   claims need an owner and an expiry, not repetition.
3. **The user was the monitoring.** Nothing in this repo watches the indexed
   page count, and the one thing that would have caught it — putting "URLs
   submitted" next to "pages indexed" — takes one glance at a dashboard the
   loop now knows how to read. Backlog 0c adds both checks to `gsc.yml`.

The related error the same day: I read the Page indexing report without
checking its `Last update` stamp, quoted a stale 1,520 indexed as current, and
used it to argue *down* a de-indexation concern the backlog had been right
about. Current data: 951 indexed, and "Crawled – currently not indexed" had
gone 10 → 562. **A number that contradicts a standing worry deserves more
scrutiny than one that confirms it, not less.**

Related: `2026-08-21-the-instrument-breaks-first-and-quietly.md`,
`2026-08-31-a-control-proves-ranking-not-magnitude.md`.
