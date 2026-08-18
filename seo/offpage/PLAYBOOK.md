# Off-page SEO Playbook (human-in-the-loop)

The split, agreed 2026-08-19: the automated loop does research, preparation and
tracking; the owner performs every action that requires an account, a click of
Agree/Submit/Sign, or any authorization. The loop never creates accounts, never
submits forms, never posts anywhere.

## Hard rules

- **White-hat only.** No paid links, no link exchanges, no comment/forum spam,
  no fake profiles or reviews, no automated posting to communities. Directories
  and listings must be legitimate, relevant, and worth existing on regardless
  of SEO.
- **$0.** Free listings and free tiers only. A "free trial" of a paid directory
  is not free. Skip anything asking for payment.
- **Real identity.** Submissions describe CurrentWire truthfully (automated
  news aggregator, ranks top US/CA stories, attributes publishers). Never
  claim human editorial staff.
- **Volume discipline.** A handful of quality submissions per week beats mass
  submission, which looks like spam to Google.

## How the weekly loop works

1. Research: find new legitimate opportunities (directories, "best news
   aggregator" listicles to pitch, RSS directories, communities) and verify
   each is live, free, and relevant — with a fetch, not from memory.
2. Prepare: for each, add an entry to `QUEUE.md` with the exact submit URL and
   ready-to-paste texts (name, tagline, descriptions, category, email).
3. Hand off: the run's report ends with the owner's checklist — usually
   5–15 minutes of clicking.
4. Track: when the owner reports something done (or a later crawl finds the
   live listing), move it to `LEDGER.md` with the date and the live URL.

## Standing texts (paste-ready)

- Name: CurrentWire
- URL: https://currentwire.us
- Tagline: The top 100 US & Canada news stories, ranked and attributed.
- Short description: CurrentWire continuously discovers, ranks and organizes
  the top 100 current news stories affecting the United States and Canada,
  with transparent attribution and links to the original publishers.
- Long description: CurrentWire is an automated news discovery platform for
  the United States and Canada. It clusters coverage from many publishers into
  single story pages, ranks the top 100 by freshness, coverage breadth, source
  authority and momentum, and links every story to the original reporting.
  Story URLs are permanent, the ranking method is public, and editorial
  policies (standards, corrections) are published on the site.
- Category: News / News aggregator / Media
- Contact: contact@currentwire.us
- RSS: https://currentwire.us/rss

## Social profiles (owner decision, still open)

config/site.ts references x.com/currentwire, facebook.com/currentwire,
linkedin.com/company/currentwire — none of these exist yet. If the owner
creates them (free), the loop prepares bios/posts and we then add `sameAs` to
the site's Organization schema (never before they exist). Account creation is
strictly the owner's action.
