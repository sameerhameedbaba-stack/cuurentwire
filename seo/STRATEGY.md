# CurrentWire full-spectrum SEO strategy

Adopted 2026-08-24. Produced by a 10-agent analysis (GSC data mining, three
competitor teardowns — Ground News/AllSides, NewsBreak/Patch, Memeorandum/
Techmeme/RCP/1440 — keyword-universe SERP observation, live on-page audit,
off-page research, distribution audit), then synthesized and adversarially
red-teamed. Workflow run `wf_87aa6768-498`, this repo's session of 2026-08-24.

**This document is the master plan.** Daily/weekly runs execute the current
sprint's [automated] items via BACKLOG.md and report against §5. PLAYBOOK.md
hard constraints override anything here. Do not re-derive strategy ad hoc —
amend this file (with evidence) instead.

Baseline (GSC, 28d to 2026-08-24, real fetch): 41 clicks, 1,806 impressions,
2.27% CTR, avg position 26.6 across 556 URLs. Google News surface: 2 URLs /
16 impressions. Discover: zero. Story template: 521 URLs → 22 clicks.
/top-10, /briefing, /most-covered: zero impressions each.

## 0. Thesis

Aggregator story pages do not win search (521 URLs → 22 clicks; no
competitor ranks aggregation pages for non-brand queries). Every successful
aggregator wins with a small set of evergreen, citable, data-differentiated
reference pages (AllSides' 3,698 source profiles, RCP's polling average,
Techmeme's Leaderboard) plus news-surface presence we currently lack.
CurrentWire already owns the raw material — coverage breadth, first-to-report
timestamps, rank history in a permanent archive — and already built page
shells (/briefing, /top-10, /most-covered) that match vacant SERPs; they fail
on packaging (titles, dates, internal links), not authority. So: **repackage
what exists, build the data moat nobody else publishes, repair the
news-surface plumbing — in that order of speed.**

## 1. The three bets

1. **Packaging, not authority.** Every existing template gets a
   search-phrased title, dated snapshot URLs where SERPs reward dates, and
   internal links from high-crawl pages. Evidence: our dead templates match
   SERPs currently won by Substacks and tag archives; homepage sits at
   position 12.3 with 15.4% CTR — one nudge from page 1. Fastest path to M1.
2. **The coverage-analytics data moat.** /reports/most-covered monthly,
   /publishers league table + profiles, Coverage Details box on every story
   page, methodology anchoring. It is simultaneously the ranking surface,
   the link magnet (every pitch leads with data, never "check out my
   aggregator"), and the thin-content fix. Path to M2 and beyond.
3. **Google News trust signals (P0).** There is NO switch to flip and no
   application to file — since 2025 publishers are considered automatically,
   so "unfreeze Google News" is the wrong mental model (reviewer correction,
   2026-08-24). The correct frame: strengthen every discovery/eligibility/
   trust/ranking signal Google's News systems read, and let consideration
   happen. The signal checklist, with our status: crawl/indexation ✓,
   permanent article URLs ✓, fresh news-sitemap limited to 48 h ✓
   (NEWS_SITEMAP_WINDOW_HOURS = 48; integrity fix in flight is the #1 item),
   NewsArticle schema ✓, visible publication + modified dates ✓, About/
   ownership/editorial-standards/corrections/contact pages ✓, section pages
   ✓, internal linking (Sprint 1), ≥1200px images (Sprint 1), Publisher
   Center claim (owner), original value = BET 2. The known open trade-off:
   author identity is the transparent automated "CurrentWire News Desk" +
   /news-desk page — honest, but weaker than named human bylines; going
   named is an OWNER decision tied to the deferred operator-identity call,
   surfaced at the M2 gate, never made unilaterally by a run. Then: RSS
   images → Flipboard, IndexNow (Bing-only benefit), beehiiv RSS-to-email.
   News pickup ramps weeks-to-months; Discover is a 6-month-plus outcome.

## 2. Guardrails — what NOT to do (all seven kept verbatim by red-team)

- **No city-level pages** — state/province level only, gated by
  hubCounts() ≥10 stories; NewsBreak's town pages work via app distribution
  and domain age we don't have.
- **No bias-rating system** — needs licensors or 400-person surveys;
  unreachable at $0 without fabrication. Coverage breadth is our honest
  equivalent.
- **No head terms** — "breaking news", "news today", "canada news" are
  navigational mega-brand SERPs. Never target.
- **No schema over-investment** — current markup is already good; AllSides
  ranks #1 with zero JSON-LD.
- **No story-page long-tail optimization at scale** — story pages are
  citation substrate; only the bounded CTR-rescue job touches them.
- **No paid platforms, no new directories, no Apple News/MSN Start** —
  researched dead ends; do not re-research.
- **No multi-source commodity-story SERP plays** — 2+ source stories rank
  24-27 positions worse in our own GSC data.

Red-team additions: **no comparison pages** ("Best News Aggregators" etc. —
highest helpful-content risk; parked with AlternativeTo/Wikipedia until
independent press exists), **no scheduled Reddit account aging** (fails
white-hat spirit), **no Show HN / Qwoted / HARO-descendants** (owner-budget
busters or need a named expert we don't have).

## 3. Roadmap (red-team-trimmed; 2-week sprints from 2026-08-24)

### Sprint 1 (Aug 24 – Sep 6) — "Fix the pipes, flip the titles"
- [automated] **News-sitemap integrity** (#1): resolve the story-render 500,
  emit only canonical 200-status slugs, add a cron validation step fetching
  every news-sitemap URL, alert on non-200.
- [automated] **GSC query instrumentation** (#2): scripts/gsc-report.mjs adds
  `["query"]` (web AND news) and `["page","query"]` (web) requests,
  dataState "all" → data/gsc-queries.json; per-URL position into
  gsc-url-signals.json; top-50-URLs-by-impressions into gsc-report.json.
  (SHIPPED 2026-08-24, this session.)
- [automated] **Dead-template indexation check FIRST** (moved up from
  Sprint 5, reviewer correction 2026-08-24): before judging any retitle,
  URL-Inspection-API-check /briefing, /top-10, /most-covered, the hubs —
  zero impressions can mean an INDEXING failure, which no title fixes.
  Classify every zero-traffic page into one of six buckets before treatment:
  indexing failure → fix indexing; demand failure → deprioritize; intent
  mismatch → re-target; authority/content failure → BET 2 work; CTR
  failure (impressions but no clicks) → and ONLY this bucket gets retitles.
  The story-level CTR-rescue job carries the same gate.
- [automated] **Retitle wave 1** — every claim literally true:
  homepage "Top News Today — US & Canada Headlines, Ranked";
  /briefing/[date] "News Summary Today: {Weekday}, {Month D, YYYY}";
  /briefing stable daily-briefing title; 9 categories get seoTitle +
  description in config/categories.ts (hubs.ts pattern; /housing says
  "housing market"); /most-covered "Biggest News Stories Right Now — Ranked
  by Publisher Coverage"; /latest "Latest News Today"; weekly report page
  "The Most Covered News Stories This Week ({range})".
- [automated] **Discover image default**: upgraded ≥1200px SELF-GENERATED
  story cards (publisher-photo hotlinking at 1200px is an owner legal
  decision — default is our own cards until the owner rules).
- [automated] **Internal-link rewire**: homepage → latest briefing, /top-10,
  /most-covered; story pages → hub + category + dated briefing.
- [owner ~15 min] **Claim currentwire.us in Google Publisher Center.**

### Sprint 2 (Sep 7 – Sep 20) — "Data moat v1"
- [automated] /reports/most-covered/2026-08 + /reports/methodology.
- [automated] /publishers league table + top ~50 profile pages (lean build;
  8-week review before expanding; KPI is links/citations, not clicks).
- [automated] Daily rank-snapshot logging (news half-life index, ships ~Dec).
- [automated] Elections: "When are the 2026 midterms" + "Which seats are up"
  fact pages + automated weekly midterms recap under /elections.
- [automated] Coverage Details box on all story pages ("N sources · first
  reported by X · peak rank #Y") — unique indexable text sitewide.
- [automated] CTR-rescue job: weekly; ≥15 impressions & 0 clicks → rewrite
  title/description, descriptive only, max 1 rewrite per URL per 6 weeks;
  switch trigger to position 5-20 once query data lands.
- [owner ~10 min] Source of Sources signup (batched weekly 10-min reply slot,
  under owner's real name; kill at 8 weeks if 0 placements).
- [owner ~15 min] Listicle pitch wave 2 (5 agent-drafted, data-led pitches).

### Sprint 3 (Sep 21 – Oct 4) — "SERP-gap pages + syndication"
- [automated] /current-events weekly recap + permanent archive.
- [automated] Dated weekly /top-10/week-of-YYYY-MM-DD snapshots.
- [automated] Weekly notable-deaths roll (inventory-gated; drop if 0
  impressions in 8 weeks).
- [automated] RSS images (media:content on /rss + category feeds).
- [owner ~25 min] Flipboard publisher signup + submit /rss (after images).
- [automated] IndexNow in the publish cron (Bing-only expectation).
- [automated] Hub explainer blocks: `explainer` field on all 24 hubs/
  categories, 100-200 honest static words; [owner] skim-approve in one slot.

### Sprint 4 (Oct 5 – Oct 18)
- [automated] 3 evergreen explainers, topics chosen ONLY from our own GSC
  query data (never guessed).
- [automated] ~40 state/province feeds (States Newsroom network, Mississippi
  Today, VTDigger, Bridge Michigan, MinnPost, Colorado Sun, CBC regional),
  verified via scripts/probe-feeds.mjs; `region` field on FeedDefinition.
- [automated] TX + CA state hubs (config-only, hubCounts ≥10 gate, noindex
  and out of sitemap below the gate).
- [owner ~30-45 min] beehiiv RSS-to-email for the daily briefing — this IS
  October's entire owner budget; schedule nothing else that month.

### Sprint 5 (Oct 19 – Nov 1)
- [automated] Reports cycle 2 (September) + elections index verification via
  URL Inspection API; dead-template indexation audit.
- [owner ~15 min] Ego-bait round 1: "you ranked #N on our September publisher
  league table" to 5-10 smaller/Canadian outlets (agent drafts). Success bar
  1-2 links/round; demote after 2 zero-link rounds.
- [automated] State hub wave 2 (every state whose feed sustains the gate).

### Sprint 6 (Nov 2 – Nov 21)
- [automated] Election week: midterms recap updated daily.
- [automated] /reports/most-covered/2026-10.
- [automated] 90-day review: full query-level striking-distance report;
  state-hub scale decision (8-week impression gate); explainer wave 2.

Cut by red-team, recorded so no run resurrects them: Product Hunt launch
(nofollow, wrong audience, budget-buster — the OWNER may still launch for
brand/direct traffic if they personally want to; it is no longer an SEO plan
item and nothing depends on it), Show HN, Reddit aging + r/dataisbeautiful,
comparison pages, Qwoted/Help-a-B2B-Writer, /briefing/texas (parked until
/briefing itself shows impressions).

## 3b. Priority stack and the central question (review round, 2026-08-24)

The owner's second reviewer (ChatGPT) audited this strategy; verdict 8.5/10,
two corrections accepted (News-trust reframe in BET 3; failure
classification before retitles in Sprint 1). Its priority stack, which our
bets map onto — use this ordering whenever sprint items compete for a run's
time:

- **P0 — Google can trust/find/index the publisher** = BET 3 + the existing
  technical base. Always outranks everything below.
- **P1 — Stop being a commodity aggregator** = BET 2 (the coverage-data
  moat). A pure feed-remix aggregator sits inside Google's scaled-content
  spam definition; the proprietary-data layer is what keeps us outside it.
- **P2 — Topical authority** = hubs/clusters; dominate chosen topics rather
  than publishing everything shallowly.
- **P3 — Improve existing URLs** = BET 1 (retitles, CTR, consolidation) —
  only after classification, only the CTR/intent bucket.
- **P4 — Authority** = the link plan (data-led, white-hat).
- **P5 — Expansion surfaces** = Images, Discover, Preferred Sources,
  AI-search citations.

**The central question every run should be able to answer:** "Why should
Google rank or cite CurrentWire instead of Reuters, AP, CNN, BBC, local
publishers and a thousand other aggregators?" Our answer: because we publish
the coverage-breadth data — who covered what, who was first, how stories
rose and died — that none of them publish. Any work that does not
strengthen that answer or a P0 signal is probably the wrong work.

## 4. Measurement (what runs must track — see PLAYBOOK cadence)

- BET 1: impressions+position for every retitled template (first impressions
  expected within 2-4 weeks of each retitle); per-query positions for "news
  summary today", "top 10 news stories this week", "current events this
  week", "daily news briefing", "most covered news stories".
- BET 2: /reports/* and /publishers/* impressions AND external referring
  pages (GSC Links report, monthly); story-page avg position trend after the
  Coverage Details box (baseline 26.3).
- BET 3: news-surface URL count (must move off 2 — the clearest single
  health signal), Discover row count, news-sitemap 200-rate, % of new
  stories with a ≥1200px image, beehiiv subscribers.
- Striking-distance inventory: [page,query] rows at position 5-20 by
  impressions → feeds CTR-rescue and retitle priorities.
- Annotate the week of 2026-08-24 in gsc-history.json: numbers polluted by
  the 402 outage.

## 5. Honest milestones (red-team calibrated)

- **M1: 100 clicks/28d by ~Oct 15** (leading indicators Oct 1: impressions
  on 3+ previously-dead templates by Sep 15; homepage under position 10).
- **M2: 1,000 clicks/28d — undated**, gated on the News surface unfreezing
  (>50 news-surface URLs) and ≥2 external citations of /reports. If News is
  still frozen at the November review despite the sitemap fix, run a
  dedicated News-trust diagnosis (named-byline decision goes to the owner).
- **50,000/mo ("Elite") is a 12-24 month conditional outcome**, dependent on
  Discover pickup and owned distribution (newsletter ≥500 subs by month 6 is
  the leading predictor). It is NOT achievable "within months" and no run
  should report as if it were. Honest 90-day ceiling: ~100-300 clicks/28d
  with repaired News plumbing — that is on-trajectory, not behind.
