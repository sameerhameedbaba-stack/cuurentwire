One-line: On the 2026-08-19 backlog clear-out, every one of the four designs
that got an adversarial review came back NEEDS_CORRECTION — and all four
defects were invisible in a design that read well. Reviewing designs before
implementing them was worth more than the implementations.

Details: seven items were designed in parallel, each design then handed to a
separate reviewer told to try to break it rather than praise it. What the
reviews caught, none of which a careful read of the design would have found:

- **A fabricated metric heading for a public page.** Draft copy for
  `/methodology/duplicate-stories` published "491 pairs, precision 0.989,
  recall 0.806" as an accuracy figure. Those come from
  `tests/fixtures/cluster-pairs.ts`, whose own header says every pair is
  invented. PLAYBOOK.md: "Real-headline accuracy is the only accuracy we
  quote." The number was also stale (501 pairs now). CI **gates** are
  publishable — a gate is a contract value in the repo — but a score measured
  over synthetic fixtures is not a measurement of the world.
- **Prose that asserted behaviour the code does not have.** Two sentences on
  the same pages were false: that an all-press-release story prints "0
  independent domains" (suppressed by a `> 0` render guard) and that a story's
  address never changes (`pickLead()` re-selects the lead, the slug is built
  from its title, and `/story/` 307s the old address). *A sentence about
  behaviour is a claim and needs the same verification as a statistic.*
- **A dictionary change that traded one wrong answer for nine.** Adding
  archaeology vocabulary to the classifier sent "Ancient city of Aleppo faces
  new shelling" to /science — "ancient city" is the standard dateline of siege
  reporting — and it moved **zero** stories on the 313-story real-production
  benchmark. *Turning a harmless `general` abstention into a confident wrong
  section is worse than the misfile you set out to fix.* Prefer precise
  phrases over single words, and record the headline that broke each rejected
  entry next to the entry, so nobody re-adds it.
- **A cache header that could have lied.** A public `s-maxage=300` on
  `/top-100` and `/latest` would have told downstream shared caches to hold
  the two freshness-critical pages for five minutes — whether or not Vercel's
  edge actually cached anything, and over the top of the `no-store` Next sets
  on error renders. The fix: put the TTL in `Vercel-CDN-Cache-Control`, which
  the edge consumes and strips, so a header that reaches no cache misinforms
  nobody. *Prefer the formulation that cannot be wrong over the one that is
  probably right.*

Two more corrections came from measuring rather than reviewing:

- **Check the boilerplate-to-unique ratio before adding text to a template.**
  The story-depth design measured its own output honestly: +254 words, ~36
  unique per story, ~218 identical on all 2,199 story URLs. On a site fighting
  a duplicate-content ceiling that is a loss. A sentence that does not change
  between two stories belongs on a reference page with a link to it.
- **The fix for a missing tag can be a deletion.** "No font preload" had
  already been "fixed" by hand-rolling preload links; `next/font` injects its
  own, so the head carried four links for two files. Measure the live head
  before adding anything to it.

Process notes that worked and should be repeated:

- Parallel design agents are read-only. Implementation agents get a strict,
  disjoint file list and are told who else is editing; that produced zero
  conflicts across four concurrent agents.
- Agents never run `npm run build`, Playwright, or git. One orchestrator runs
  the gates once on the combined tree — see
  [[2026-08-18-daily-and-weekly-loops-collide]] for why concurrent gate runs
  produce meaningless failures.
- When an existing test fails because your change made the system stricter,
  fix the test's premise and say so in the test — do not weaken the assertion.
