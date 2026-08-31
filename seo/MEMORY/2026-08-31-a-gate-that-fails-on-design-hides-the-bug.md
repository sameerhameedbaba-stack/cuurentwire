# A gate that fails on a design decision hides the real defect underneath

2026-08-31, weekly deep run.

`[auto-alert]` #2 had been red every night since 2026-08-23. It reported 16
coherence violations. **Zero of them were defects.** Fourteen were "list-side
staleness", one "story-side staleness", one "skew" — and the probe printed
those labels itself, in every violation line, for six days.

They were the site's own cost controls. `/[category]` carries
`revalidate = 3600`; the cron deliberately does not revalidate the dynamic
category pattern, because that nuke is what blew the Hobby tier on 08-24 and
the playbook protects its absence as a hard constraint. Checked rather than
assumed: `/business` answered `Age: 3020` — inside its own 3,600 s window —
while carrying two of the flagged clusters.

The cost was not the noise. It was that **one real bug was sitting in the same
list**: a category flap, `c31fffb88ca32` alternating business -> politics ->
business -> politics across four dataset generations. It became visible the
moment the 16 non-defects stopped being violations — `violations=1 findings=4`
on the very next run of the same probe against the same site.

Three things worth keeping:

1. **A permanently red gate is not a loud gate, it is a silent one.** Nobody
   reads the sixteenth line of an alert that has failed sixteen nights running.
   Red-by-default is indistinguishable from off.
2. **The probe had already computed the answer.** `classifyArchiveVsLive` was
   shipped on 08-29 and returned the correct cause every time; nothing consumed
   it. Computing a distinction and then not acting on it is worse than not
   computing it, because the report *looks* diagnostic.
3. **Relaxing a gate needs a guard against the relaxation becoming a blindfold.**
   If the `cw-live-dataset-version` stamp regex ever rots, every disagreement
   classifies as "unknown", lands in findings, and the probe passes forever
   while blind. So stamp coverage below `MIN_COVERAGE` now fails as
   `extraction-blind` — the same shape the file already used for card
   extraction. Measure the coverage before trusting the split: it was 16 of 16.

Related: `2026-08-21-the-instrument-breaks-first-and-quietly.md` (the instrument
was wrong), `2026-08-26-a-vague-error-is-a-hiding-place.md` (the message was
unreadable). This is the third variant — the instrument was right, said so, and
was ignored because it was also failing.
