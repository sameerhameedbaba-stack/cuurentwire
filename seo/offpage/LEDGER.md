# Off-page ledger — completed placements

Format: date | what | live URL | notes. Only entries verified live belong here.

## Accounts created (for future launches)

- 2026-08-19 | Product Hunt personal account (via ovyajewels@gmail.com Google
  sign-in) | new accounts must age ~1 week before posting — launch window
  opens ~2026-08-26; weekly run prepares tagline, gallery images and launch
  text when the window opens.
- 2026-08-19 | Hacker News account | for a single future "Show HN" post —
  weekly run prepares the compliant title + first comment when the owner has
  a free evening. Never solicit upvotes.

## Submitted, awaiting review (move up when verified live)

- 2026-08-19 | Bing Webmaster Tools | site https://currentwire.us/ imported
  from GSC (Administrator), all 3 sitemaps submitted, 0 errors | DONE — this
  one is complete, not pending; Bing News inclusion is automatic from here.
- 2026-08-19 | Journalist's Toolbox (journaliststoolbox.ai) | submission form
  sent (news-monitoring tools pitch, contact ovyajewels@gmail.com) | editorial
  review, no timeline.
- 2026-08-19 | Curlie | suggested to News > Headline_Links ("Suggestion
  Received"; contact ovyajewels@gmail.com — support@currentwire.us was
  intended but the form submitted first; contact-only field, no action) |
  editor review can take months.
- 2026-08-19 | Listicle pitch emails | 4 pitches SENT from ovyajewels@gmail.com
  (verified in Sent folder): iTechGuides, Wisp, Readless, daily.dev | replies
  arrive at ovyajewels@gmail.com; weekly run checks the four articles for
  added mentions. (Note: 4 stale unsent drafts of the same pitches remain in
  sameerhameedbaba@gmail.com Drafts — safe to delete, never send them, they
  would be duplicates.)

(no verified-live placements yet)

## Progress checks

### 2026-08-20 (1 day after submission — nothing live yet, as expected)

- Curlie: searched curlie.org for "currentwire" — no results. Still in the
  editor queue. Normal; can take months.
- Journalist's Toolbox: no indexed listing yet. Editorial review, no timeline.
- Listicle pitches — all 4 articles re-fetched, none has added CurrentWire:
  - iTechGuides "9 Best News Aggregators in 2026" — updated 2026-08-10 (before
    the pitch), no mention.
  - Wisp "7 Ground News Alternatives" — updated 2026-08-13, no mention.
  - Readless "Best News Aggregators 2026" (upd. 2026-07-29) and "Best AI News
    Aggregators" (upd. 2026-08-09) — no mention in either.
  - daily.dev "10 Best News Aggregator Apps in 2026" — updated 2026-07-30, no
    mention.
- Web search for "currentwire.us" and "CurrentWire news aggregator": zero
  mentions anywhere. No backlinks or citations yet.
- Social profiles re-checked: linkedin.com/company/currentwire → HTTP 404;
  facebook.com/currentwire → does not resolve to a CurrentWire page (a
  different handle, @current.wire.3, is what surfaces); x.com/currentwire →
  HTTP 402, X blocks automated fetches so this one cannot be verified from
  here. No `sameAs` added to OrganizationJsonLd — correct, since no profile is
  confirmed to exist. lib/seo/structured-data.tsx:63 still documents why.
- No code changes this run. Docs only.

### 2026-08-20 (live session with the owner — Chrome, owner clicked every submit)

Standing change: the owner is building CurrentWire for **Rick Putman**. From
today, Rick Putman is the person/submitter name on every form; the site name
stays "CurrentWire" and the contact email stays support@currentwire.us.

- **Feedspot — DONE, complete.** Free listing submitted from
  https://news.feedspot.com/usa_news_websites/ (Name "CurrentWire", email
  support@currentwire.us, URL https://currentwire.us). Submitting auto-created
  a Feedspot account; the owner clicked "Confirm My Email" and the "Welcome to
  FeedSpot" mail landed at 3:44 AM. Their Plans & Pricing upsell appears right
  after submitting — declined, nothing paid. Listing itself is editor-reviewed.
- **SaaSHub — SUBMITTED on the free tier.** The owner registered the account
  (submission is impossible without one). Form as sent: name CurrentWire;
  tagline "The top 100 current news stories across the United States and
  Canada, continuously refreshed, intelligently ranked, deduplicated and
  transparently attributed." (158/250); categories News + RSS + News
  Aggregator; competitors Google News, Feedly, Ground News, Inoreader; no
  LinkedIn URL (none exists). **Priority+ is $75 one-off — declined**, used the
  Free option (queue up to 32 days, no corrections offered).
  Follow-up alternatives step: selected newsblur, flipboard, smartnews,
  no-fee-news. Deliberately did NOT select ABC News — it is a publisher
  CurrentWire links to, not a competitor; claiming it would be false.
  Note for next time: SaaSHub's "Selected: N" counter only updates on real
  clicks, but the underlying `selected_slugs[]` checkboxes are what submit —
  verify state in the DOM, not from the counter.
- **MediaHacker — 5th listicle pitch prepared** at
  https://www.mediahacker.org/contact/ (the other 4 went out 2026-08-19).
  Personalized to their real article, "10 Best News Aggregator Apps to Stay
  Informed (2026)" (verified live at
  https://www.mediahacker.org/13491/best-news-aggregator-apps-2026/). The pitch
  states plainly that CurrentWire is automated, not a human-edited desk. Their
  form has a rotating arithmetic anti-spam question the owner answers.

**All three closed out the same day** (owner asked to finish everything; the
owner still answered the anti-spam challenge personally — completing
bot-detection is off-limits for the assistant regardless of permission):

- **SaaSHub — submitted AND verified.** Verification Status: ACTIVE, green
  badge on the listing. The public listing is still "Pending approval, up to
  32 days" (free queue) — verification only raises priority, it does not
  approve. Profile completed while there: description 1016/2000 (states
  plainly that CurrentWire is automated with no human editorial desk and
  produces no original reporting), release date 2026-08-14, Open Source = No,
  pricing = Free option yes / free trial no / paid option no. Final categories:
  News, RSS, News Aggregator, Web App, News & Books. Final competitors:
  Google News, Feedly, Ground News, Inoreader, Flipboard, NewsBlur,
  No Fee News, SmartNews. Logo and screenshots still missing (need real image
  files) — the only remaining gaps.
  After verifying, SaaSHub redirects to an Experts nomination page asking you
  to vote on an unrelated "Top 5 Photos & Graphics Products" list in exchange
  for a future nomination. Skipped — voting in a category we know nothing
  about to buy a nomination is not white-hat. Skip it every quarter.
- **MediaHacker — SENT.** "Thank you for your message. It has been sent."
  All 5 listicle targets are now pitched.

Correction to an earlier note: the 2026-08-19 Wikipedia assessment described
CurrentWire as "3 weeks old". Git history says otherwise — first commit
2026-08-13, first live deploy 2026-08-14, so the site was 5-6 days old then.
The notability conclusion is unchanged either way.

Still open: Product Hunt launch window from 2026-08-26; SaaSHub re-verification
is required every quarter (next ~2026-11).
