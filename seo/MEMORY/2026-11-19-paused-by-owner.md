# 2026-11-19 — CurrentWire paused by the owner

Owner, in chat: "I wanna drop this service… I don't want currentwire.us to run
for a while. Let's pause it and also remove the cron jobs."

## What was switched off, and how to undo it

| Thing | State now | Undo |
|---|---|---|
| GitHub workflows: uptime, seo-health, pages, bluesky-post, cwv, gsc, gsc-crawl-freshness, deploy-watch, surface-coherence, url-survival | **disabled manually** (Actions API, 2026-11-19). No code changed; the `schedule:` lines are still in the files. | Actions → workflow → "Enable workflow", or `PUT /repos/sameerhameedbaba-stack/cuurentwire/actions/workflows/<file>/enable`. Enable uptime + seo-health LAST — they re-enable the others on their next run. |
| `ci.yml` | still enabled — runs only on push / pull request, never on a timer | — |
| Claude routines "CurrentWire SEO daily loop" and "…weekly deep run" | owner switches them off at claude.ai/code/routines (agents cannot edit routines created via the HTTP API). Backstop: daily/weekly/offpage/publish.md now open with a PAUSED block telling any run to stop without committing. | Re-enable the routines; delete the PAUSED blocks. |
| "CurrentWire SEO off-page loop" routine | already disabled since 2026-09-14 | — |
| The site on GitHub Pages | still serving the last deploy over HTTP (HTTPS never got its certificate) until the owner unpublishes it: Settings → Pages → Unpublish | Re-enable Pages (Source: GitHub Actions), enable pages.yml, run it. |
| DNS at Hostinger | still points at GitHub Pages. After unpublishing, the owner should delete the 4 A + 4 AAAA records for `@` and the `www` CNAME (keep MX/TXT) — a custom domain pointing at GitHub Pages with no site behind it can be claimed by another GitHub account. | Re-add the records listed in `seo/reports/2026-09-30.md`. |
| Vercel | already paused (402) since 2026-09-14; git deployments off | — |
| Hostinger cron jobs | none for CurrentWire — Hostinger only holds its domain and email | — |

Nothing was deleted: content, code, history, data and the routines all remain.
