# The path to the dashboard is infrastructure too

**2026-09-14.** The weekly run found two failures at once. One was loud and one
was silent.

The loud one: production paused, every URL `503 DEPLOYMENT_PAUSED`, and five
auto-alert issues opened within hours. The monitoring did its job.

The silent one: the `google-site-verification` TXT record was gone from
`currentwire.us` DNS, and Search Console refused the owner account. Nothing in
the repo watches that record. Every Google instrument this loop owns (crawl
monitor, `gsc.yml`, URL Inspection, manual actions, Sitemaps report) sits
behind it. It was found only because a person tried to open a dashboard and
then ran `nslookup` instead of assuming the wrong Chrome profile. That profile
explanation had been right before (`gsc-dashboards-need-authuser-1`), which
made it the easy wrong answer this time. The page named the right account.

**The shape.** We monitor what the site serves and what Google does with it.
We did not monitor the *credential* that lets us see what Google does. When an
access path breaks, every instrument behind it goes dark at once, and each one
looks like its own transient failure.

**How to apply.** List the preconditions each instrument needs: a DNS record,
a secret, a signed-in profile, a token. Give each one a check that fails on
its own. A DNS TXT check is a free public query. And when a known explanation
("wrong profile") is available, check the one fact that would falsify it (the
account named on the page) before accepting it.

Related: [[2026-08-31-serving-200-is-not-being-read]],
[[2026-09-11-keeping-the-last-good-value-launders-failure-as-success]].
