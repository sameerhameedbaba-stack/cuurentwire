# A side effect gated on two independent clocks eventually stops happening

**2026-08-27.** The permanent archive took no rows for 14 hours on Aug 26
and 10 hours on Aug 27. Every check the site had was green throughout:
every URL 200, the dataset regenerating every ~15 minutes, the news sitemap
comfortably above its 50-entry floor, the uptime probe passing every 30
minutes. What had stopped was the *write* path.

The burst needed two independent clocks to coincide:

1. the cron route only consulted the persist gate on ticks that also
   refreshed the dataset (~4 an hour, at a phase set by when the last
   refresh happened), and
2. a cold instance only opened the gate during minutes 0-4 and 30-34.

Neither rule is wrong on its own. Together they made the write burst a
coincidence, and a coincidence with a slowly drifting phase happens in
clusters and then not at all. The bursts came between 03:00 and 07:00 UTC
and the site went dry for the rest of the day.

**And underneath both: there was no second clock.** Fixing the two rules
restored writes for exactly one window, then they stopped again — which is
how the real cause surfaced. `vercel.json` held a single daily cron (a
Hobby-plan artifact) and the 5-minute beat the code is written around came
from an external scheduler that had stopped reaching production. Every
comment in the codebase described that beat as a fact. Nothing checked it.
A dependency you never verify is an assumption, and this one had been false
long enough to shape the burst pattern for days.

**The lesson has three halves.**

*Never gate a required side effect on the agreement of two clocks you do
not control.* The scheduler's phase was not ours; the drift was not ours.
The fix made each rule independently sufficient: the gate is consulted on
every tick, and the window is half the cycle, so any beat of 15 minutes or
less must land in one — proved exhaustively in a test over every beat and
phase rather than argued in a comment.

*Verify the inputs you build on, not just the code you write.* The beat was
in the comments, the tests, and the cost model — but no probe ever asked
whether a tick had actually arrived. The site now owns its own schedule
instead of borrowing one it could not see.

*Monitor the write path, not just the read path.* Six probes watched what
the site was serving. None watched what it was keeping. The signal was
free and already downloaded: the newest `<news:publication_date>` in the
news sitemap is the archive's `first_seen_at`, so ageing it reads the last
successful database write. That check now runs every 30 minutes.

Related: `2026-08-24-an-outage-leaves-damage-that-outlives-it.md` (the
stories this stall was quietly re-creating),
`2026-08-21-the-instrument-breaks-first-and-quietly.md`,
`2026-08-26-a-vague-error-is-a-hiding-place.md`.
