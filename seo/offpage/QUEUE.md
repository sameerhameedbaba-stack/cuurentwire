# Off-page queue — owner's clicking list

Work top-down. When you finish one, tell the assistant "done: <name>" or just
leave it — the weekly run re-checks and moves live listings to LEDGER.md.

Paste-ready standing texts (name, tagline, descriptions, category, email) are
in PLAYBOOK.md — copy from there wherever a form asks. Contact email for all
submissions: **support@currentwire.us**.

Status 2026-09-03: **two placements are live** — SaaSHub and the Product Hunt
launch (1 upvote, but a permanent backlink). Everything else submitted is
sitting in someone else's review queue and needs no owner time. This week is
deliberately light.

> **This file is subordinate to `seo/STRATEGY.md`.** The 2026-08-24 red-team
> round cut several tactics permanently. If an item here ever contradicts
> STRATEGY.md, STRATEGY.md wins — that mismatch already caused one wrong
> recommendation (see LEDGER 2026-09-03).

## Your 15 minutes this week

### 1. Source of Sources — sign up (~2 min)
https://www.sourceofsources.com/ — pulled forward from Sprint 2 so the
8-week trial clock starts sooner. Free, no account, no dashboard: you just
subscribe and journalist queries arrive by email 2-3x/day.

- Sign up as a **source/expert**, with **support@currentwire.us**.
- Reply under **your own real name**, as the operator of an automated
  news-ranking system. Never reply "as CurrentWire" and never imply an
  editorial desk.
- **Only answer queries genuinely about news aggregation, media tech, or
  how ranking/attribution works.** SOS has zero tolerance: one off-topic
  pitch is an immediate permanent ban. If nothing fits in a given week,
  answer nothing — that is the correct outcome, not a wasted week.
- Kill gate: if 0 placements after 8 weeks (~2026-10-29), unsubscribe.

### 2. Social profiles — just answer yes or no (~1 min, or ~10 if yes)
This has been open for two weeks and is now blocking two small things at once.
None of the three profiles exists today: `linkedin.com/company/currentwire`
returns 404, `facebook.com/currentwire` is an unrelated handle
(@current.wire.3), and `x.com/currentwire` cannot be checked automatically
because X blocks bots — only you can look.

- **If yes** (create any of them, free): tell me which, and I will add
  `sameAs` to the Organization schema and prepare bios/posts.
- **If no**: say so and I will delete the dead references in `config/site.ts`
  and stop re-checking them every week.

Either answer also settles a live loose end: `config/site.ts:94` sets
`twitterHandle: "@currentwire"`, which `app/layout.tsx:51` really does put in
the site's Twitter card — so every page currently credits an X account that
may not exist. Harmless, but wrong until you decide. **Only create what you
will actually keep.**

## Nothing owed — waiting on other people

No owner action is possible on any of these; the weekly run re-checks them.

- **Curlie** — suggested 2026-08-19 to News > Headline_Links. Editor review
  runs for months. Still not listed as of 2026-09-03.
- **Feedspot** — free listing submitted 2026-08-20. Their USA news page still
  lists 90 sites, none of them CurrentWire.
- **Journalist's Toolbox** — pitched 2026-08-19. No listing; always a long
  shot (the site has no news-aggregation section).
- **5 listicle pitches** — iTechGuides, Wisp, Readless ×2, daily.dev,
  MediaHacker. Sent 2026-08-19/20. **0 replies, 0 additions after 2 weeks.**
  Wave 2 is a Sprint 2 item (see below), deliberately data-led rather than a
  repeat of the same ask.

## Recurring

- **SaaSHub re-verification** — the badge expires quarterly. Next due ~2026-11.
  When SaaSHub offers an "Experts" nomination in exchange for voting on an
  unrelated product list, skip it.

## Coming in Sprint 2 (Sep 7 – Sep 20) — not yet, don't start early

From STRATEGY.md's roadmap. Both need assets that do not exist yet:

- **[owner ~15 min] Listicle pitch wave 2** — 5 fresh, data-led pitches. The
  point of wave 2 is that it leads with data from `/reports` and `/publishers`
  (Sprint 2 automated work), not with "please add my aggregator". Pitching
  again before those pages exist would just be the same failed ask a second
  time. Candidate targets already verified live: seahawkmedia.com,
  nexterwp.com, acmethemes.com, aifreeforever.com, socialwalls.com.

## Parked (do NOT do yet)

- **AlternativeTo** — best directory in the niche, but its FAQ explicitly
  rejects "apps from small websites made with automated tools" and the free
  queue takes months. Submit ~Oct-Nov 2026 once there's traction/press.
- **Wikipedia** — verified: no comparison page exists and CurrentWire fails
  notability. Do not attempt; revisit only after independent press coverage.
- **NewsBlur RSS** — low yield by our own evidence. Of Feedly and Inoreader,
  only Feedly produced name-searchable discovery; Inoreader gave a followed
  feed that its own search cannot find. Treat this whole family as low-value.
- **Indie Hackers / Blogarama / Uneed** — legitimate but low value.

## CUT by the 2026-08-24 red-team — no run may resurrect these

Recorded here, not just in STRATEGY.md, because this queue previously still
listed Show HN as a live task and it was nearly recommended on 2026-09-03.

- **Show HN** — cut. (An HN account exists from 2026-08-19; it stays unused.)
- **Product Hunt launch** — cut as an SEO item. The owner launched it anyway
  for brand/direct traffic on 2026-09-01; it is done and is not to be redone.
- **Reddit** (r/SideProject, r/webdev, r/alphaandbetausers) + scheduled
  account aging — cut, fails the white-hat spirit.
- **Comparison pages** we write ourselves ("Best News Aggregators…") — cut,
  highest helpful-content risk.
- **Qwoted / Help-a-B2B-Writer / HARO-descendants** — cut; they need a named
  expert we don't have. (Source of Sources survives precisely because it is
  free and answered under the owner's own real name.)
- **New directories generally** — STRATEGY guardrail: "No paid platforms, no
  new directories, no Apple News/MSN Start — researched dead ends; do not
  re-research."

## Verified dead ends (don't waste time)

BetaList (now paid-only), Bing PubHub (retired, domain dead), AllTop (pivoted,
no submissions), r/InternetIsBeautiful (bans aggregator sites), ABYZ News
Links (server dead), library "news sources" guides (no submission channels).

**Google Publisher Center is NOT a dead end** — an earlier version of this
file wrongly filed it here. Submitting *to be included in Google News* is
retired (eligibility is automatic since 2025), but *claiming a publication* is
still live, and the owner **already did it on 2026-08-24**: publication
"CurrentWire" under `ovyajewels@gmail.com`, auto-suggested from the verified
GSC property. Note for any future visit: that account is Chrome's **`/u/1/`**
profile, so use `https://publishercenter.google.com/u/1/` — the default
profile shows a misleading "no access" page.
