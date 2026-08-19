One-line: In this Next version a page-level metadata key REPLACES the root
layout's wholesale — and `undefined` counts as replacing it with nothing, so
`/us`, `/topics`, `/top-100`, `/politics`, `/sources`, `/methodology` and
`/about` shipped no `<meta name="robots">` at all for weeks.

Details: `lib/seo/metadata.ts` already knew this rule and documented it for
`openGraph` ("Page-level openGraph REPLACES the layout's wholesale in this Next
version, so the shared card must be restated here"), then broke the same rule
one field above by returning `robots: undefined` on the indexable path. The
layout's `max-image-preview: large` and `max-snippet: -1` — the directives that
make a page eligible for large Discover and Top Stories thumbnails — were
silently dropped on every page built with the helper. Measured live 2026-08-19:
`/` and `/story/*` (which build metadata by hand) carried the full directive;
seven sampled helper-built pages carried none.

Rules this leaves behind:

- **Restate, never omit.** Any metadata key the root layout sets must be
  restated in full by any page that sets that key at all. Returning `undefined`
  is not "inherit" — it is "replace with nothing".
- **A helper that gets this right for one field will get it wrong for the
  next.** The fix belongs in the helper with a unit test per field
  (`tests/unit/page-metadata-robots.test.ts`), because nothing in a page file
  shows the defect — every page just calls `pageMetadata()`.
- Same family as [[2026-08-19-declared-config-is-not-applied-config]]: the
  source reads correct and the response is wrong. Check the response.

Also from the same run — a rule for anything published on a public page:

- **Never quote synthetic-fixture accuracy as accuracy.** A draft transparency
  page was going to publish "on 491 pairs ... precision 0.989, recall 0.806"
  from `tests/fixtures/cluster-pairs.ts`, whose own header says every pair is
  invented ("fictional towns, companies, teams and people"). PLAYBOOK.md's rule
  is "Real-headline accuracy is the only accuracy we quote." CI **gates**
  (precision >= 0.98) may be published, because a gate is a contract value in
  the repo rather than a measurement of the world — but say plainly that the
  pairs are written for the test, not sampled from live coverage.
- **Prose about behaviour is a claim and needs the same check as a number.**
  The same draft asserted a story's address "does not change when a tenth
  publication joins" — false, `pickLead()` re-selects the lead and the slug is
  built from the lead's title, which is exactly why `/story/[slug]` 307s old
  addresses. Verify sentences against the code the way you verify statistics.
