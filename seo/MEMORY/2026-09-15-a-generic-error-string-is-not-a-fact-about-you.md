# 2026-09-15 — A generic error string is not a fact about your account

## What happened

Production started answering `402 DEPLOYMENT_DISABLED` with the body
"Payment required". The 2026-09-14 run read that body as evidence of an
unpaid invoice, wrote it into `data/incidents.json`, and put "open the Vercel
billing dashboard and check for an outstanding invoice" on the owner
checklist. The 2026-09-15 session repeated the claim to the owner's face.

Both were wrong. The owner checked the dashboard: every invoice **Paid**
(Aug: Pro $23.60, Neon marketplace $11.35, Observability $0). The 402 is the
free **Hobby-plan usage pause** — Pro-period usage over the Hobby caps, the
dashboard reading "Paused – Upgrade to resume service", self-clearing at the
billing-cycle reset ~2026-09-24.

"Payment required" is simply the IANA reason phrase for HTTP 402. Vercel
serves it for any 402. It describes a status code, not this account.

## Why it survived a whole run

The correct answer was **already written down** in this repo, in
`MEMORY/2026-09-15-owner-working-style-and-system-map.md`, under a heading
literally called "Why the site is down right now": *"402
DEPLOYMENT_DISABLED = Hobby usage pause, NOT an unpaid invoice (all invoices
paid)."* The 2026-09-15 session read that file at the start of the session
and still repeated the invoice theory, because it then read the newer
`reports/2026-09-14.md` and let the more recent document win.

That is the real failure, and it is not the same as the usual "no evidence"
mistake. It is: **a later guess quietly overwrote an earlier verified fact,
because recency was treated as authority.**

## The rules this adds

1. **Recency does not outrank verification.** When two documents in this repo
   disagree, the one that says how it was verified wins — regardless of date.
   A daily report is an observation log; a memo written from a dashboard the
   owner actually opened is a measurement. Prefer the measurement.
2. **A vendor's generic string is not evidence.** Reason phrases, default
   error bodies and status-code names describe a protocol, not your account,
   invoice, plan or data. Quote them as what was *returned*, never as what is
   *true*. If a claim about billing, ownership or plan state cannot be traced
   to a dashboard, an API response about that account, or the owner, it is a
   hypothesis and must be labelled one.
3. **Never send the owner to check something you inferred.** An owner
   checklist item costs the owner real time and real trust. Before writing
   one, name the evidence that makes it necessary. "The error body said X" is
   not that evidence. The owner's standing order is that they spend zero time
   on this; a speculative errand is a direct violation of it.
4. **Owner-blocking is not owner-actionable.** The site being down does not
   imply there is something for the owner to do. Sometimes the correct
   checklist is "nothing" and the correct posture is to wait for a known,
   dated, self-clearing state. Say that plainly instead of manufacturing a
   task.

## Where the operative rule now lives

`seo/routines/daily.md` (CLOUD MODE) — a 402 inside the known usage-pause
window is one quiet line, with three explicit re-escalation triggers. Mirrored
in `weekly.md`, `offpage.md`, `PLAYBOOK.md` and the top block of `BACKLOG.md`.
