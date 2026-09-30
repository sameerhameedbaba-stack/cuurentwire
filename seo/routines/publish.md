# Cloud routine: DAILY PUBLISHING LOOP — source of truth

This file IS the instruction set for the article-writing routine. Edit this
file to change how CurrentWire publishes.

It is SEPARATE from `daily.md` (the SEO/health loop) on purpose: the SEO loop
measures the site, this one fills it. They can run on different days and
neither should block the other.

## STATUS

Production moved to GitHub Pages on 2026-09-28 (a static site; Vercel stayed
402 past its reset and offered only "Upgrade"). The first two articles were
written by hand in the migration session, through exactly the steps below.
This routine is the daily continuation of that — enable it only when the owner
says so, and only once currentwire.us is serving the GitHub Pages site.

## CLOUD MODE — read first

- You run in Anthropic's cloud on a fresh clone. No owner browser, no
  dashboards. Anything needing their browser goes on the owner checklist.
- FIRST read `seo/MEMORY/2026-09-15-cloud-migration-and-current-state.md` and
  the SCOPE DECISION block at the top of `seo/STRATEGY.md`.
- **$0.** Writing runs on the owner's Claude subscription — there is no
  Anthropic API key and you must never add one, sign up for anything, or
  enable a paid tier.

## THE TASK

Publish up to **10 original articles per day, total** — not per category.

### 1. Select

Run the selection layer. It is already built and tested; do not re-implement
its judgement in prose.

```
npx tsx scripts/editorial-preview.ts
```

This prints what would publish, what is held for the owner, and what was
rejected, plus a sample brief. It writes nothing.

The gate decides, not you. Do NOT publish a story the gate rejected, and do
NOT publish one it marked `reviewRequired` — those go to the owner.

### 2. Read the reports, and count REPORTS — not websites

The brief's "facts confirmed" list comes from RSS headlines and one-line
summaries, so it is usually thin or empty. To write an article with the
details, open the free-to-read reports the brief lists and read them. Facts
are not copyrightable; a publication's wording is. Extract facts, then write
your own sentences — never copy or lightly reword a report's prose.

While reading, do the one check the gate cannot do: **look at the bylines.**
The feeds carry no author data, so the gate can only catch syndication by URL
(`abcnews.com/.../wireStory/`) or by an identical headline. Measured on
2026-09-28 (the first live run), it still let through:

- an OpenAI story on NPR, Global News and ABC News that was ONE Associated
  Press article (NPR's byline: "The Associated Press") — rejected;
- a CBC Starship story whose text was the AP story near word for word, with
  units converted;
- CBS stories ending "The Associated Press contributed to this report".

Rules that follow:

- Count distinct REPORTS. Two sites carrying one wire story are one report.
  If fewer than 2 genuinely separate reports remain, do not write the story.
- List each report ONCE, e.g. `Associated Press (via PBS NewsHour)`.
- List only publications you actually read. If a site blocks the fetch (CNBC
  and Axios returned 403 on 2026-09-28), you cannot cite what it said.
- "X contributed to this report" means partly X's reporting. Do not count it
  as fully independent of X.
- **Check the slate for the same event twice.** Clustering misses reworded
  coverage: on 2026-09-28 Starship's first orbital flight came through as two
  separate clusters. Write ONE article from both clusters' reports, never two.
- If reports disagree on a number (altitude, times, counts), either leave it
  out or attribute each version. Never pick one silently.
- When in doubt about a politically charged story, hold it. A short day is a
  good day.

### 3. Write

For each story that survives step 2, write the article.

**You are given facts, not article text.** The brief deliberately excludes the
source articles' prose so it cannot be rewritten. Write original sentences.

Hard rules — these are in the brief too, and they are not negotiable:

- Every claim traces to a fact in the brief, or is attributed in the sentence.
- Attribute every accusation, allegation or disputed claim to the publication
  that made it, by name.
- Use a keyword only where it reads naturally. If the brief says there is no
  keyword evidence, **write the truest headline and force nothing**.
- The headline describes the story truthfully first, carries the keyword
  second. Never the reverse.
- Never use the word "sources" in article copy — write "reports", or name the
  publications (standing site rule, `PLAYBOOK.md`).
- Link every publication named.
- Say plainly when reports disagree. Do not pick the tidier version.
- No invented quotes, numbers, dates or details. Not in the brief, not in the
  article.
- No fake human byline. The author is the CurrentWire News Desk.

Write the file to `content/articles/<YYYY-MM-DD>/<slug>.json`. The shape and
the rules the schema enforces are in `content/articles/README.md`.

### 4. Verify before committing

```
npx vitest run tests/unit/editorial-article.test.ts   # store must stay valid
npx tsc --noEmit
npx eslint app lib components config scripts tests site
node scripts/build-static-site.mjs       # the production build (GitHub Pages)
```

`build-static-site.mjs` is the real check: it renders every article page, and
fails on any internal link, sitemap URL or llms.txt URL that does not resolve,
so a broken article fails the build rather than the site.

If the schema rejects an article, FIX THE ARTICLE. Never relax the schema to
get a piece out — those rules (2+ independent publications, 2+ free to read,
attributed quotes) are the product.

### 5. Publish

Commit and push to `main`. The GitHub Pages workflow
(`.github/workflows/pages.yml`) builds the static site and deploys it; the diff
is the review surface.

Then verify on the LIVE site: fetch the article URL and confirm 200, the
canonical is right, and the JSON-LD parses. **Not verified live is not
published** — do not report an article as published on a build alone.

### 6. Record

Write `seo/reports/<today>.md`: what published, what the gate held and why,
what was rejected, and the keyword target each piece was built around. Keep
the final message to the owner short.

## First run (when enabled)

Publish exactly ONE article. Take it all the way to a verified live URL, and
stop. One article proves the whole path — select, write, validate, build,
deploy, verify — and a fault found on one piece costs one piece. Ten articles
through an unproven path is ten things to unpick.

Report back and wait for the owner before scaling to the full ten.

## Holding the line on volume

Ten is a ceiling, not a quota. A day with four stories that clear the gate
publishes four. **Never lower the bar to hit a number** — the gate exists
because thin, single-source volume is what got this domain demoted and the
hosting paused. A short day is a good day.

If the gate regularly yields far fewer than ten, that is a finding to report,
not a problem to route around. The fix is more free-to-read feeds in
`config/feeds.ts`, never a weaker rule.

## Retiring the old corpus — OWNER-GATED, NOT PART OF THIS ROUTINE

`STORY_RETIREMENT=on` makes the ~16k old `/story/` URLs answer 410, except the
123 on `data/story-keep-list.json`. This is effectively irreversible in search.

Do not set it. The owner chooses the date. Before they do:

1. Refresh `data/gsc-url-signals.json` (the `gsc.yml` workflow).
2. Regenerate: `npx tsx scripts/build-keep-list.ts`. A stale keep-list retires
   URLs that have since started earning.
3. The kept 123 still render from the database — they need a static snapshot
   before the switch, or they break. **This is not built yet** and must be
   before the switch is flipped.

## HARD RULES

$0 only — never sign up, never enter payment details, never enable a paid
plan. White-hat only; never fabricate a metric or a quote. Never force-push,
never delete data, never touch the operator line on /about. If blocked on
something only the owner can do, list it at the end and continue with
everything else.
