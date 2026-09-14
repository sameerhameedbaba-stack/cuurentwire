# Cloud routine: WEEKLY OFF-PAGE LOOP — source of truth

This file IS the instruction set for the "CurrentWire SEO off-page loop"
cloud routine. It supersedes the retired local scheduled task. **This
routine stays DISABLED while the site is paused** — pitching a 503 site
burns bridges; the owner re-enables it at relaunch.

## CLOUD MODE — read first

- Cloud agent on a fresh clone; repo root = working directory. No owner
  browser: you research, verify by fetch, track and prepare — the owner
  clicks. Never create accounts, submit forms, or post to third-party sites.
- FIRST read seo/MEMORY/2026-09-15-cloud-migration-and-current-state.md.
- If https://currentwire.us/ answers 503 **or 402**, stop after a two-line
  report ("site paused; off-page loop idle; nothing pitched") — do not verify
  links against a dead site, and file nothing. (A 402 before ~2026-09-24 is
  the known Hobby usage pause, not a billing problem — no alarm, no owner
  item; see seo/routines/daily.md.)

## WHY THIS LOOP MATTERS (strategy shift, 2026-09-01)

Google demoted the domain during its first evaluation and is now a
BACKGROUND re-earn. The channels that carry the next stretch are the ones
this loop feeds: real citations and referral traffic, the owned audience,
and AI-search visibility. See seo/STRATEGY.md top section.

## LIVE CHANNELS TO TRACK EVERY RUN

- **Bluesky @currentwire.bsky.social** — auto-posts via
  .github/workflows/bluesky-post.yml. Verify by OUTCOME: fetch
  https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=currentwire.bsky.social&collection=app.bsky.feed.post&limit=100
  and report real post count, posts/day, age of newest.
- **Newsletter (Buttondown, username `currentwire`)** — status of sender
  review/approval is owner-known; ask via checklist if still unknown.
- **Product Hunt** — verify the actual outcome (link live? followed?) by
  fetch, never assume.
- **Bing PubHub does NOT exist** (redirects to homepage). Bing News
  inclusion is automatic from Webmaster signals; do not look for a form.

## THE RUN

FIRST read: seo/offpage/PLAYBOOK.md, seo/offpage/QUEUE.md,
seo/offpage/LEDGER.md.

1. **Check progress by outcome, silently.** For each submitted LEDGER item,
   fetch the target and look for a live CurrentWire link; move verified-live
   entries up with date and URL. Search the web for new "currentwire.us"
   mentions. A submission accepted is not a link live — only a fetch that
   finds the link counts.
2. **Report the channel numbers** (they feed the Monday scoreboard).
3. **New opportunities** only if the queue has fewer than 3 ready actions.
   Verify each with a real fetch — live, free, relevant, white-hat. No paid
   anything.
4. Update QUEUE.md and LEDGER.md; commit seo/offpage/ changes and push
   (docs-only commits need no test gates).

## OWNER TIME BUDGET

AT MOST 15 minutes per week: 2-4 highest-value actions, each with the exact
link and paste-ready text; contact email for every submission is
support@currentwire.us. If a week has nothing worth 15 minutes, say
"nothing this week" — never pad. Do not message the owner at all if there
is nothing live to report and nothing for them to click.

## THE STANDARD

No claim without evidence — a link is live only if a fetch found it this
run. Verify the outcome, never a proxy. Never fabricate or estimate a
metric; say "unverified" rather than implying success. $0 only, white-hat
only, never enter payment details, never touch account settings.
