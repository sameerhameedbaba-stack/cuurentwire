One-line: When a monitor checks one field and the renderer filters on a
different one, the site ships a spec violation that nothing catches until the
monitor fires — check what is actually *emitted*, not what feeds it.

Details: `scripts/seo-health.mjs` validated the 48h Google News window by
reading `<news:publication_date>` out of the live XML, but
`lib/seo/news-sitemap.ts` decided inclusion from `cluster.lastPublishedAt`
(latest source coverage) while emitting `first_seen_at` as the publication
date. Those two fields diverge exactly when a story we published days ago picks
up fresh coverage — so 9 live entries carried publication dates up to 65h old
and Google would have rejected them. The bug was invisible to unit tests because
every fixture set the two timestamps within hours of each other.

Rules this leaves behind:
- A windowed feed must filter on the value it emits. If two timestamps decide
  inclusion, assert on both.
- Unit-test the divergent case explicitly (fresh coverage + old publication
  date, and fresh publication date + old coverage), not just the happy path.
- The health check is the spec. When it fails, fix the renderer to match it —
  do not relax the threshold. Its `NEWS_WINDOW_HOURS = 49` is deliberately
  48h + 1h grace and should stay stricter-or-equal to the renderer's
  `NEWS_SITEMAP_WINDOW_HOURS = 48`.

Also: `npx eslint .` silently lints `.next/` build output inside agent git
worktrees under `.claude/worktrees/` unless ignore patterns are `**/`-prefixed.
A gate that reports 1398 errors on a clean tree is a gate everyone learns to
ignore — keep `eslint .` at zero problems so a real regression is visible.
