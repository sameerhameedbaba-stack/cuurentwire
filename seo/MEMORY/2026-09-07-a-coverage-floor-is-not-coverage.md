# A coverage floor is not coverage

**2026-09-07, weekly deep run.**

The 2026-09-04 sweep trimmed eleven meta descriptions and shipped
`tests/unit/meta-description-length.test.ts` to hold the ceiling. That test was
written carefully: it scans `app/**/page.tsx` for description literals, asserts
each is ≤160, **and** asserts `found.length > 10` — a guard explicitly added so
that "a regex that silently stops matching would not turn this whole test into a
no-op". The report recorded a negative control: padding a hub description makes
it fail.

Three days later, `/canada` was still serving **161 decoded characters** on
production.

The scan matched `const DESCRIPTION = "..."`. `/canada` passes its string inline
to `pageMetadata({ description: "..." })`. Counted under `app/`: **19
const-form literals and 5 inline-form**. The guard saw 19 of 24 and reported
green.

**The anti-no-op check could not catch this, and that is the whole lesson.** It
asks "did the scan find *something*?" — and the scan found nineteen things. A
floor detects a regex that broke completely. It is blind to a regex that was
never complete, because a partial scan and a full one both clear the floor.

**The rule.** A coverage assertion has to be tied to a number you *measured in
the codebase*, not to a number that merely proves the machinery ran. Count the
population, write the count down with the date you counted it, and floor the
test there — so that adding a page in the unscanned spelling, or dropping one of
the patterns, fails the test instead of quietly shrinking it. `MIN_LITERALS = 22`
with a comment saying where 22 came from is a different kind of assertion from
`> 10`.

**And how it was actually found:** not by the test, which was green, but by
re-fetching all 31 list pages from production and decoding the HTML entities.
Same shape as [[2026-08-31-serving-200-is-not-being-read]] and
[[2026-09-02-a-healthy-site-is-not-a-shipped-deploy]] — the green check
described our intent, and only the live surface described the outcome. A test
you shipped as part of a fix is not exempt from being verified against reality;
if anything it is the first thing that should be.
