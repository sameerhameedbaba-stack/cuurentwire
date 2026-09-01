# A healthy site is not a shipped deploy

**2026-09-02.** Production had not deployed any code for **over 24 hours** and
every check this repo owns was green the whole time.

`uptime.yml` passed every 30 minutes. `seo-health.mjs` passed all 24 checks.
`/news-sitemap.xml` carried 740 fresh entries with the newest 0.1 h old,
`/archive-sitemap.xml` had grown to 14,124 URLs, the cron was writing, the
dataset stamp was current. The site was genuinely, verifiably **serving well** —
it was serving a build from before 2026-08-31 21:39 UTC. Cron and ISR keep a
stale build looking perfectly alive, because *fresh data* and *fresh code* are
different things and only one of them was being checked.

**Every health check this repo has probes the SITE. None probes the BUILD.**

How it was finally caught, and the technique is the reusable part: the run
tried to verify its own fix, saw the pre-fix numbers come back unchanged, and
instead of assuming CDN caching, looked for **an unconditional user-visible
string from a known commit**. `components/layout/Footer.tsx:38` renders
`<NewsletterSignup />` with no env flag as of `72e30e7`; production's footer
rendered every sibling link and the form's label `Daily briefing by email`
appeared zero times. Independently, the content-hashed
`/_next/static/immutable/chunks/*.js` filenames were **byte-identical before
and after a push**, which no rebuild can do.

Two cheap build-identity probes, then, when a fix seems not to have landed:

1. An unconditionally-rendered string added by a known commit. Pick one with
   no flag, no data dependency, no A/B — a footer label is ideal.
2. Content-hashed asset filenames. Same names ⇒ same build, full stop.

**The claim this invalidates, and the loop should feel it.** The 2026-09-01
report marked `53ad4b1` SHIPPED and "verified live" because the symptom was
gone afterwards. That report even wrote down the right caveat — *a deploy wipes
the ISR cache, so the frozen 308 would have cleared on any deploy* — and the
truth was worse than the hedge: **there was no deploy**, and the symptom
cleared for a third reason nobody has identified. "The bad thing stopped
happening" is not verification of a specific fix; it is one observation
consistent with many causes, and the playbook's own rule (*fetch the live URL
after deploy and check the actual output*) silently assumes the deploy happened.
**Verify the deploy before verifying the fix.**

The deploy signal that should have caught this was worse than useless: **both**
Vercel project integrations on this repo (`currentwire` and `cuurentwire`)
report `failure` for **all 30** recent deployments, including ones that
demonstrably shipped. A status that is constant carries no information, and a
run reading it will — as this one nearly did — dismiss a true failure as the
usual noise.

**The rule:** liveness, freshness and correctness of *content* say nothing
about whether your *code* is running. Any pipeline that can fail silently
between "merged" and "serving" needs one check that names the commit — a SHA in
a response header, a `/api/version`, anything — and every "SHIPPED" claim needs
that check to have passed, not just the feature to look right.

Related: `2026-08-21-the-instrument-breaks-first-and-quietly.md` (the whole
instrument panel was green through this),
`2026-08-31-a-gate-that-fails-on-design-hides-the-bug.md` (a signal that never
changes stops being a signal — here it was pinned at *failure* rather than
*pass*), `2026-08-25-publishing-a-fact-is-how-you-find-out-it-is-wrong.md`.
