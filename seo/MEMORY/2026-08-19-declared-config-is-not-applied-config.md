One-line: A framework config line that is *present* is not a config line that
is *in effect* — `export const revalidate` sat in four route files for days
doing nothing, and only live response headers exposed it.

Details: `/story/[slug]`, `/topic/[slug]`, `/source/[slug]` and
`/archive/[date]` each declared `export const revalidate` with a comment
explaining the ISR intent, and `app/api/cron/news-refresh/route.ts` listed
three of them in `ISR_SURFACES` and called `revalidatePath` on them after every
dataset. Everything read as if ISR were on. It was not: Next 16 applies ISR to
a *dynamic* segment only when the page also exports `generateStaticParams`
("You must return an empty array from generateStaticParams ... in order to
revalidate (ISR) paths at runtime" —
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md`).
Production served `Cache-Control: private, no-cache, no-store` with
`X-Vercel-Cache: MISS` on repeat fetches of the same URL; warm TTFB fell from a
557 ms median to 110-125 ms once the empty array was added.

Rules this leaves behind:

- **Read the response, not the source, to decide whether a caching or
  indexing directive is live.** Source review cannot distinguish "declared"
  from "applied"; `curl -D -` can. The same is true of `robots`, `canonical`
  and any header a framework decides to emit.
- **`next build`'s route table is the cheap oracle.** ƒ (Dynamic) versus
  ○/● (Static/SSG) tells you in one line which routes will be cached. A route
  with `revalidate` that prints ƒ is a bug, always.
- **Read the bundled docs for this Next version before assuming a config
  works the way it used to.** `node_modules/next/dist/docs/` stated the
  requirement explicitly; no amount of prior-version knowledge would have.
- The regression guard for a "silently inert config" bug cannot be a unit
  test of behaviour — there is no behaviour to assert. It has to assert the
  *shape of the source* (`tests/unit/isr-route-config.test.ts`: every page
  under a `[param]` segment that sets `revalidate` and is not `force-dynamic`
  must export `generateStaticParams`).

Related: `2026-08-18-monitor-and-renderer-must-agree-on-the-field.md` — same
family of bug, where what a thing declares and what it actually emits diverge.
