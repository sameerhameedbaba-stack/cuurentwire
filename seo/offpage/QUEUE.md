# Off-page queue — owner's clicking list

Work top-down. When you finish one, tell the assistant "done: <name>" or just
leave it — the weekly run re-checks and moves live listings to LEDGER.md.

Paste-ready standing texts (name, tagline, descriptions, category, email) are
in PLAYBOOK.md — copy from there wherever a form asks. Contact email for all
submissions: **support@currentwire.us**.

Status 2026-09-09 (weekly run): **three placements are live** — SaaSHub, the
Product Hunt listing, and now the Bluesky account, which is also the site's
first `sameAs` entry (shipped and verified in production this run). Nothing
new was submitted anywhere. The one thing blocking the biggest channel is a
mailbox only the owner can read.

> **This file is subordinate to `seo/STRATEGY.md`.** The 2026-08-24 red-team
> round cut several tactics permanently. If an item here ever contradicts
> STRATEGY.md, STRATEGY.md wins — that mismatch already caused one wrong
> recommendation (see LEDGER 2026-09-03).

## Your 15 minutes this week

### 1. Buttondown — is the account approved yet? (~5 min, the only real ask)
The newsletter has been in "standard new-sender review" since **2026-09-01 —
nine days**. Buttondown quoted "a few hours to a day". Everything else is
ready and waiting on it: the signup form is live sitewide (verified in the
served HTML today), the public page https://buttondown.com/currentwire
accepts subscribers, and the archive is empty only because the account
cannot send.

Do this: open https://buttondown.com and log in (support@currentwire.us), or
search that mailbox for "Buttondown".
- **If it is approved** — go to https://buttondown.com/requests, create an
  API key, and send it to me. I will build the daily briefing send.
- **If it is still under review** — reply to their review email (or use
  https://buttondown.com/support) and ask for a status; nine days is well
  past their own quote.
- **Do NOT buy their RSS-to-email add-on.** It is **+$9/month** (verified on
  their pricing page today) and we do not need it: their API is available on
  the free plan, so we send the briefing ourselves for $0.

### 2. Optional, unchanged: LinkedIn company page
`linkedin.com/company/currentwire` is still unclaimed and free. Worth doing
only if you will actually post to it. Tell me if you create it and I will add
it to `sameAs` alongside Bluesky.

That is the whole list. Nothing else on this board needs a human this week.

## Prepared, waiting on our side (no owner time yet)

- **Bluesky handle → @currentwire.us.** Free, permanent, and it puts the
  domain on every post. It is NOT ready to click: our poster logs in as
  `currentwire.bsky.social`, and claiming the domain handle retires that
  name and would break it. Order of operations is in `seo/BACKLOG.md` —
  we default the login to the account DID, watch one green scheduled run,
  and only then does this become a 3-minute owner click.
- **Bluesky reach is currently zero** — 45 posts, **0 followers**, 2 likes in
  30 posts. Not an owner problem and not worth owner time: the posts carry no
  hashtag facets, which is the only way a new account is discovered there.
  Engineering item, filed in BACKLOG.md.

## Nothing owed — waiting on other people

No owner action is possible on any of these; the weekly run re-checks them.

- **Source of Sources** — still BLOCKED at their end, one week on.
  `sourceofsources.com`, `/index.html` and `/reporter/` all returned 403
  with "Index file not found … should be world-readable" again on 2026-09-09
  — the identical file-permission misconfiguration seen on 2026-09-03. Nobody
  can sign up. Keep queued; **if it is still broken on ~2026-09-24, drop it.**
- **Curlie** — suggested 2026-08-19 to News > Headline_Links. Editor review
  runs for months. curlie.org search for "currentwire" returned nothing again
  on 2026-09-09.
- **Feedspot** — free listing submitted 2026-08-20. Their USA news page still
  carries no CurrentWire entry (re-fetched 2026-09-09). 20 days in.
- **Journalist's Toolbox** — pitched 2026-08-19. Re-fetched 2026-09-09, no
  mention; always a long shot (the site has no news-aggregation section).
- **5 listicle pitches** — iTechGuides, Wisp, Readless ×2, daily.dev,
  MediaHacker. Sent 2026-08-19/20. **3 weeks: 0 replies, 0 additions — and
  wave 1 is now provably dead, not merely unanswered.** daily.dev did not
  ignore its piece: it re-tested and republished the whole list at a new URL
  (https://daily.dev/blog/best-news-aggregator-apps-tested-compared/) and
  CurrentWire is not in it. An editor who reworks the article and still leaves
  us out has answered. Do not re-send wave 1 to anyone.

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
  **Status 2026-09-09: still blocked, verified by fetch.** `/reports`,
  `/reports/most-covered` and `/publishers` all return 404 on production.
  Until they exist there is no data to lead with, and the daily.dev result
  above says plainly that the non-data ask does not work. Add
  daily.dev's rewritten URL to the wave-2 target list — a piece its editor
  actively maintains is a better target than five that sit untouched.

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
