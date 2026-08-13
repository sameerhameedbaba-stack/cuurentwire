# CurrentWire

**The stories shaping the United States, Canada, and the world.**

CurrentWire is a production-grade current-affairs platform that continuously
discovers, deduplicates, ranks and presents the **Top 100 news stories**
affecting the United States and Canada — with transparent attribution and
direct links to every original publisher.

It is an aggregation and discovery product, not a publisher: story pages show
headlines, short summaries and metadata, and always link out to the original
reporting.

---

## Architecture

```
Providers (GNews / NewsAPI / RSS / mock)
   → Normalize (validate, strip HTML, canonicalize URLs)
   → Deduplicate (exact canonical-URL match)
   → Classify (geography US/CA/US+CA/Global, category, entities)
   → Cluster (headline token/bigram/entity similarity, 48h window)
   → Rank (0–100: freshness 35, authority 20, coverage 20,
            geography 10, prominence 10, velocity 5)
   → Cache (in-process, stale-while-revalidate, ~5 min refresh)
   → Serve (React Server Components)
   → Archive (optional PostgreSQL, via cron endpoint)
```

Key directories:

| Path | Purpose |
| --- | --- |
| `config/` | Centralized branding (`site.ts`), category taxonomy, source authority tiers |
| `lib/news/providers/` | Provider adapters behind one `NewsProvider` interface |
| `lib/news/normalization/` | Validation, HTML stripping, URL canonicalization |
| `lib/news/classification/` | Deterministic geography/category/entity classifiers |
| `lib/news/clustering/` | Duplicate-story clustering (union-find over similarity) |
| `lib/news/ranking/` | Transparent scoring + time decay + breaking rules |
| `lib/news/queries.ts` | All page-facing data queries and URL filter parsing |
| `lib/cache/` | Stale-while-revalidate in-process cache |
| `lib/database/` | Drizzle schema, client, best-effort persistence |
| `lib/news/intelligence.ts` | Optional AI abstraction with deterministic fallback |
| `components/` | Layout, news card system, section composites, UI |
| `app/` | All routes (App Router, server components) |
| `drizzle/` | Generated SQL migrations |
| `tests/` | Vitest unit + integration, Playwright e2e |

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict)
· Tailwind CSS 4 · Drizzle ORM + PostgreSQL (optional) · Vitest · Playwright ·
Lucide icons.

The site works fully **without** any API key or database: it auto-falls back
to clearly-labeled demo data from fictional outlets, with a site-wide
`DEMO DATA` banner and per-story `DEMO` badges.

---

## Prerequisites

- Node.js **20.9+** (22 recommended)
- npm 10+
- PostgreSQL 14+ — **optional**, only for durable archiving

## Installation

```bash
npm install
cp .env.example .env.local   # then edit as needed
```

## Local development

```bash
npm run dev
```

Open http://localhost:3000. With no provider keys configured you will see the
demo dataset (labeled as such). This is the intended zero-config experience.

## Environment variables

See [.env.example](.env.example) for the full annotated list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | prod | Canonical site URL (SEO, RSS, OG) |
| `NEWS_DATA_MODE` | no | `mock` / `live`; unset = auto |
| `NEWS_REFRESH_MINUTES` | no | Cache refresh interval (default 5) |
| `GNEWS_API_KEY` | live mode | [gnews.io](https://gnews.io) API key |
| `NEWS_API_KEY` | live mode | [newsapi.org](https://newsapi.org) key (their free tier is dev-only) |
| `RSS_FEEDS` | live mode | Comma-separated publisher RSS URLs you may use |
| `DATABASE_URL` | no | PostgreSQL connection string |
| `CRON_SECRET` | prod | Bearer token protecting `/api/cron/news-refresh` |
| `ADMIN_SECRET` | prod | Key for `/admin/status?key=...` diagnostics |
| `CONTACT_EMAIL` etc. | no | Contact addresses shown on the site |

Configure **at least one** provider for live news. Multiple providers improve
clustering and coverage counts.

## Database (optional)

The app serves entirely from its in-process cache; PostgreSQL adds a durable
archive of articles, clusters, ingestion runs and ranking snapshots.

```bash
# 1. Set DATABASE_URL in .env.local, then:
npm run db:migrate   # apply migrations in ./drizzle
npm run db:seed      # seed source tiers + categories
```

Schema lives in `lib/database/schema.ts`; regenerate migrations after schema
changes with `npm run db:generate`.

## News refresh / cron

Data refreshes automatically in-process every `NEWS_REFRESH_MINUTES`. For
serverless deployments (short-lived processes) schedule the refresh endpoint:

```
GET /api/cron/news-refresh
Authorization: Bearer <CRON_SECRET>
```

- **Vercel:** [vercel.json](vercel.json) already schedules it every 5 minutes;
  Vercel sends the `Authorization: Bearer <CRON_SECRET>` header automatically
  when `CRON_SECRET` is set in project env.
- **Anywhere else:** any scheduler works, e.g.
  `curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/news-refresh`
  from cron/systemd/GitHub Actions every 5 minutes.

The endpoint also persists the dataset to PostgreSQL when `DATABASE_URL` is set.

## Testing

```bash
npm run typecheck    # strict TypeScript
npm run lint         # ESLint
npm test             # Vitest unit + integration (64 tests)
npm run test:e2e     # Playwright e2e (desktop + mobile projects)
```

First-time Playwright setup: `npx playwright install chromium`.

## Production build

```bash
npm run build
npm start
```

If mock data is active in production, a warning is printed at startup and the
site shows the demo banner — mock stories are never presented as real news.

## Deployment

### Vercel

1. Import the repository.
2. Set env vars (`NEXT_PUBLIC_SITE_URL`, provider keys, `CRON_SECRET`,
   `ADMIN_SECRET`, optionally `DATABASE_URL`).
3. Deploy — the included `vercel.json` wires the 5-minute cron.

### Docker / generic Node hosting

```bash
docker build -t currentwire .
docker run -p 3000:3000 --env-file .env.local currentwire
```

The image uses Next.js standalone output (no dev dependencies at runtime).
Schedule the cron endpoint with your platform's scheduler.

## Operational notes & fallbacks

- **Provider outage:** each provider is isolated; remaining providers keep the
  feed alive and ranking recalculates with available data.
- **All providers fail:** the last successful dataset keeps serving
  (stale-while-revalidate); the homepage never becomes an error page.
- **No key at all:** demo mode, clearly labeled.
- **Diagnostics:** `/admin/status` (open in dev; `?key=<ADMIN_SECRET>` in
  prod) shows ingestion stats, provider health and ranking breakdowns.
- **Observability:** structured JSON logs for ingestion start/finish, provider
  errors, and counts. Secrets are never logged.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Site shows DEMO DATA banner | No provider configured or `NEWS_DATA_MODE=mock` — add a key and set `live` |
| `401` from cron endpoint | Send `Authorization: Bearer <CRON_SECRET>` |
| `/admin/status` 404 in prod | Set `ADMIN_SECRET` and pass `?key=` |
| Empty category page | Normal when the current window has no matching stories; check `/latest` |
| DB writes failing | App keeps serving from cache; check `DATABASE_URL` and run `npm run db:migrate` |

## Legal

CurrentWire aggregates and summarizes third-party reporting. Copyright in
original articles belongs to the respective publishers. The bundled privacy
and terms pages describe implemented functionality and should receive
professional legal review before commercial launch.
