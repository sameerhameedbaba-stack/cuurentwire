# A signal dismissed is a signal nobody read carefully

**2026-09-03.** The 2026-09-02 run found that production had not shipped code
for 24 hours and, looking for something to alert on, checked GitHub's
deployments API. It concluded the API was noise: *"both Vercel projects report
`failure` for all 30 recent deployments, including ones that demonstrably
shipped, so failure has carried no information for days."* On that basis it
filed the automatable follow-up as `/api/version` — put a commit SHA on the
site and have `uptime.yml` watch it change.

Both halves were wrong, and the second one could not have worked.

**The signal was clean.** Re-measured today by resolving each deployment's
status individually: `f8805af` and `4b64c6e` — the commits that actually
shipped — report `success`. Every deployment from `72e30e7` onward reports
`failure`. There is a perfect boundary in the data, and it sits exactly where
production's served bundle stops. The most likely explanation for yesterday's
reading is that it listed deployment *records* without fetching each one's
*status*, so every row looked identical.

**The proposed replacement was circular.** `/api/version` requires deploying a
change in order to detect that changes cannot be deployed. During the very
outage it was designed for, it would have been unshippable — the check would
have sat merged and dark alongside every other fix. Nobody noticed, because the
design was never walked through against the failure it was for.

The lesson is not "yesterday was sloppy". It is that **"this instrument is
broken" is a load-bearing claim and deserves the same evidence as any other
finding.** Declaring a signal useless is not a neutral act: it removes the
cheapest detector available and pushes the design toward something more
elaborate — which, here, was also something that could not work. The cost of
one extra API call per record was 30 requests. The cost of skipping it was a
second day of invisible outage and a wrong design.

Two habits that would have caught it:

- **Before dismissing a signal, test it against a case where you already know
  the answer.** We knew `f8805af` shipped — production serves it. One status
  call on that deployment would have shown `success` and killed the "carries no
  information" claim on the spot.
- **Before designing a detector, ask whether it can run during the failure it
  detects.** A check that depends on the broken path is not a check.

Related: [[2026-08-21-the-instrument-breaks-first-and-quietly]] — there, the
instrument really was broken. The pair is the point: *is the instrument broken*
is a question to answer, not to assume in either direction.
Also [[2026-09-02-a-healthy-site-is-not-a-shipped-deploy]], which is still the
governing fact about this outage.
