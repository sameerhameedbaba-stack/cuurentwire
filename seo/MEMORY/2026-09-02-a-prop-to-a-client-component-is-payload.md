# A prop to a client component is payload

**2026-09-02.** The homepage was known to spend ~9.3 s of main thread before
it painted with all 343 KB of HTML already delivered (`domInteractive` 9,684 ms
against `responseEnd` 410 ms, backlog item 3). The eager-image fix had already
been tried and had not moved it, and the backlog's conclusion — "the real
target is main-thread cost, not images" — was right but had no named cause.

Splitting the document instead of guessing found one: **62% of the homepage
HTML (213 KB of 343 KB) is not markup at all**, it is the RSC flight payload
— the serialized React tree Next embeds in the page and parses on the main
thread during hydration. Counting keys inside it pointed straight at the
defect: 112 `stroke`, 84 `x1`/`y1`/`x2`/`y2`, 29 `cx`/`cy`. Line and circle
geometry, ~28 copies of it, on a page that shows one placeholder.

`RemoteImage` is a Client Component, and `StoryImage` handed it the dead-image
placeholder as an already-rendered node:

```tsx
fallback={<CategoryPlaceholder category={category} />}
```

**Every prop a Server Component passes to a Client Component is serialized into
the flight payload**, whether or not it ever renders. So a ~1,045-byte SVG
element tree shipped with EVERY image on the page, to be shown only when a
publisher's CDN had killed that particular asset. Measured live, counting the
escaped fingerprint (in the payload) against the unescaped one (in the markup):

```
/                                28 serialized,  1 shown
/top-100                         25 serialized,  0 shown
/most-covered                    25 serialized,  0 shown
/topic/artificial-intelligence   31 serialized, 17 shown
```

120.4 KB across nine sampled pages — **6.6% of all document bytes** — for
artwork no viewer could ever see.

**The rule:** props to a client boundary are wire format, not function
arguments. Pass the smallest value that reconstructs the thing (here the
category *label*, ~26 bytes) and let the client component build it, because
the component's own JSX ships once in the bundle while a prop ships once per
instance. The cheap audit is to count a distinctive attribute of any
server-rendered node you pass across the boundary and compare it against how
many are actually rendered; the two numbers should match.

A second-order trap this exposed: the obvious next step is to pass the
`CategoryId` and let the client resolve it. That would have dragged
`config/categories.ts` — 26 KB of classifier keyword dictionaries — into the
browser bundle and lost more than it saved. **Resolve on the server, send the
result.**

## The guard could not see the thing it guarded

The first test written for this was an e2e assertion on the rendered page, and
it passed — for the wrong reason. Without a news API key the dev server
Playwright drives serves fixture stories whose art is **all local placeholder
SVG**, so `RemoteImage` never renders there at all. The assertion was vacuous
in CI and would have stayed green through a full reintroduction.

The fix was a unit test that calls `StoryImage` directly on a remote `src` and
fails on any element-valued prop, naming it. Proved by reintroducing the defect
and watching it fail, then reverting — a guard nobody has watched fail is a
guard nobody has tested.

Same family as `2026-08-31-a-gate-that-fails-on-design-hides-the-bug.md` and
`2026-08-21-the-instrument-breaks-first-and-quietly.md`: **ask what data the
check runs against before trusting that it is green.** Fixture data that omits
the production case turns a real assertion into a decoration.

**Status caveat.** The fix is merged (`6c63626`) and green in CI, but it is
NOT serving: production stopped deploying on 2026-08-31 21:39 UTC and nobody
noticed for a day — see
`2026-09-02-a-healthy-site-is-not-a-shipped-deploy.md`. Every number above is a
real measurement of the DEFECT on live production; none of them is a
measurement of the fix in production. That confirmation is still owed.

Related: `2026-09-01-cache-the-thing-not-the-question.md` (the other half of
"measure the thing, not the question that found it"),
`2026-08-31-fixing-the-mechanism-is-not-moving-the-metric.md` — this removes a
measured cost, and LCP is set by the whole main-thread budget, so it is a
contribution to the Discover threshold, not a claim to have reached it.
