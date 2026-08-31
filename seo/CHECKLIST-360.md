# 360° checklist audit — verdict map

The owner supplied a 57-section "Ultimate 360° SEO Master Checklist — 2026"
(ChatGPT-drafted) on 2026-08-24 and asked what applies. This file is the
audit verdict, kept so future runs can answer "did we consider X?" without
re-litigating. Verdicts: **RUNNING** (already live in this repo/loops),
**ADOPTED** (new, added 2026-08-24 — see BACKLOG/SKILL entries), **DECISION**
(recorded owner decision, do not "fix"), **N/A** (does not apply to this
site — with the reason), **REJECTED** (violates our rules).

| Checklist area | Verdict |
|---|---|
| Search-engine foundation (GSC, Bing WMT, sitemaps, verification, baselines) | RUNNING — both verified, 3 sitemaps submitted, GSC baseline + history in data/, change log = git |
| Crawlability, robots.txt, crawl traps, JS rendering | RUNNING — daily seo-health checks robots + sitemaps; site is SSR/ISR, no JS-only content |
| Indexability, noindex audit, crawled-not-indexed | RUNNING + STRATEGY Sprint-5 URL-Inspection audit; hub gates noindex thin pages |
| XML sitemap system (news sitemap, only-200 URLs, lastmod) | RUNNING — plus the news-sitemap 500/redirect fix in flight (task chip, separate session) |
| URL architecture, canonicals, redirect health | RUNNING — permanent slugs, 308 merge pointers, url-survival.yml daily probe |
| Site architecture, internal linking, breadcrumbs, topic clusters | RUNNING + STRATEGY Sprint-1 rewire |
| Mobile, CWV (LCP/INP/CLS), performance | RUNNING — keyless PSI checks, cwv-history.json, e2e mobile suite; speed is a standing owner constraint |
| Page experience, accessibility, semantic HTML | RUNNING — AA contrast, single h1, focus states (round-9 work) |
| On-page titles/descriptions/intent | ADOPTED as STRATEGY BET 1 (retitle wave, Sprint 1) |
| Keyword & query research, keyword-to-page map, cannibalization | RUNNING as of 2026-08-24 — data/gsc-queries.json (query engine) + STRATEGY §3 map; dedup engine handles cannibalization |
| Content quality, freshness honesty, no fake dates | RUNNING — hard rules in PLAYBOOK; update events engine |
| Programmatic/AI content safety (scaled-content abuse) | RUNNING — hub gates, thin-page noindex, no mass generation |
| E-E-A-T / trust pages | RUNNING — About/Methodology/Editorial/Corrections/News Desk; named byline = OWNER DECISION deferred (STRATEGY M2 gate) |
| Topical authority (pillars, clusters, gaps) | RUNNING — 24 hubs/categories + STRATEGY build list |
| Structured data (NewsArticle, Organization, Breadcrumb, ItemList; no FAQ) | RUNNING — validated daily; FAQPage was never used (checklist confirms it died 2026-05) |
| Entity SEO (sameAs, profiles) | DECISION — no social profiles exist yet, so no sameAs (documented in structured-data.tsx); revisit when socials exist |
| Image SEO | ADOPTED — GSC "image" surface added to gsc-report.mjs 2026-08-24; alt text + og:image already RUNNING; image sitemap deferred until Images data justifies it |
| Video SEO | N/A — no video content |
| International / hreflang | N/A — one English site serves US+Canada; no localized variants to disambiguate |
| Local SEO (GBP, Bing Places, NAP) | N/A — online publication, no physical premises or service area |
| News SEO section | RUNNING/ADOPTED — core items live; **Google Preferred Sources = ADOPTED** (owner checks availability for currentwire.us, then the site adds the button — BACKLOG) |
| E-commerce SEO | N/A — nothing is sold |
| Backlinks / digital PR | RUNNING — STRATEGY BET 2 (data reports as the linkable asset) + off-page queue; avoid-list matches PLAYBOOK white-hat rules |
| Brand/reputation monitoring | RUNNING (lightweight) — brand SERP checked in weekly runs |
| AI search / GEO / AEO | RUNNING + ADOPTED — llms.txt, crawlable facts, citable URLs live; **Bing WMT AI-citation metrics (Total Citations, Grounding Queries) added to the Monday run's checks** |
| IndexNow | RUNNING for new URLs; ADOPTED — also ping updated/merged story URLs (BACKLOG, pairs with per-slug revalidation) |
| SERP-feature tracking | RUNNING via GSC surfaces (+ image as of today); Top Stories = the News-unfreeze work |
| Social/distribution | STRATEGY Sprint 3-4 (RSS images → Flipboard; beehiiv newsletter); social profiles = optional owner item |
| Security & site health, uptime, 5xx | RUNNING — uptime.yml 30-min probe + auto-alert issues; **GSC Manual-actions/Security tabs added to the Monday Chrome check** (API doesn't expose them) |
| Server/hosting | RUNNING — Vercel Pro (2026-08-24), spend-capped; crawler access verified |
| JavaScript SEO | N/A-mostly — SSR/ISR renders everything server-side; e2e asserts server HTML |
| Log-file analysis | N/A at our tier — no persistent server logs on Vercel; **GSC Crawl-stats report added to the Monday check as the free proxy** |
| Competitor intelligence | RUNNING — 2026-08-24 teardown baked into STRATEGY; refreshed at 90-day review |
| UX/behavior metrics (heatmaps, Clarity) | REJECTED for now — third-party tracker vs the standing no-CWV-regression rule; GA4 engagement suffices |
| Conversion SEO | Applies once the newsletter ships (Sprint 4) — signups become the conversion metric |
| Automation, QA-before-release, migration | RUNNING — gates, e2e seo spec, workflows; no migration planned (URLs are permanent by design) |
| Third-party DA/DR scores | REJECTED — paid tools, and the checklist itself says don't manage to them |
| Monthly operating review | RUNNING — weekly deep run + monthly cost/link checks cover the list |

Net-new adoptions from this audit (all shipped or queued 2026-08-24):
1. GSC **image surface** in gsc-report.mjs (shipped).
2. **Google Preferred Sources** availability check + button (BACKLOG; owner ~5 min).
3. **Bing WMT AI-citation metrics** in the Monday run (SKILL updated).
4. **GSC Manual actions / Security / Crawl-stats** peek in the Monday run (SKILL updated).
5. **IndexNow for updated/merged URLs** (BACKLOG).

## Operating note added 2026-08-31 — the GSC dashboards are NOT blocked

The three dashboard checks above (Manual actions, Security issues, Crawl stats)
looked unreachable for a week: Search Console answers *"you don't have access
to this property"* on Chrome's default profile, because the property belongs to
`ovyajewels@gmail.com` and the default profile is `sameerhameedbaba@gmail.com`.

**Both accounts are signed into the same Chrome, and the second one is `/u/1/`.**
Use `https://search.google.com/u/1/search-console/...` — for example
`https://search.google.com/u/1/search-console/manual-actions?resource_id=sc-domain%3Acurrentwire.us`
— and all three open. Verified 2026-08-31: Manual actions and Security issues
both clean, Crawl stats read in full (80,800 requests / 354 MB / 162 ms,
Refresh 95% vs Discovery 5%, Other file type 92% vs HTML 5%).

Do not record these as owner-blocked again.
