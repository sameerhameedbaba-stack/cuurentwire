# A cost fix can silently move a correctness boundary

**2026-08-22.** Batching database writes to a ~25-30 minute cadence
(`lib/database/persist-gate.ts`, shipped 2026-08-21 to let Neon compute
suspend) was a pure cost change. It had a correctness consequence nobody
wrote down: it invalidated the premise of a decision made elsewhere in the
code.

`resolveStoryRequest` answered 404 when the archive said "no such story".
That was correct while every 5-minute refresh wrote straight through to
Postgres — a published cluster was archived within one cycle, so "the archive
has not heard of it" really did mean "it was never published". The moment
writes were batched, that sentence stopped being true for up to half an hour.
The result: brand-new story URLs, already advertised in `/news-sitemap.xml`,
answering a 404 that ISR then cached for 300 s — measured at 2 of the 40
newest sitemap entries.

There was even a test pinning the old answer, with a comment explaining why it
was right. It was right. It just described a world that a later commit had
replaced.

**How to apply.** When a change alters *when* data becomes visible — batching,
caching, TTLs, queues, lazy writes — go find the code that treats absence as
proof of non-existence, and check whether it still holds. Grep for the places
that turn "not found" into a permanent answer (404, tombstone, delete,
"gone"), not just for the callers of what you changed.

**Also:** a test asserting the old behaviour is not automatically a reason to
stop. Read its premise. If the premise expired, correct the test in place and
record what changed the world — that is different from weakening a test to get
a green run, and the difference belongs in the diff.

Related: [[2026-08-21-an-outage-is-not-a-fact-about-the-world]] (the same
family — a status code has to say what is actually known),
[[2026-08-18-monitor-and-renderer-must-agree-on-the-field]].
