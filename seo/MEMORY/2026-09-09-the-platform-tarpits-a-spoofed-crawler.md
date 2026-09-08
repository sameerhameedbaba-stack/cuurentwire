# A spoofed crawler is not the crawler — and the control is another site

**2026-09-09.** Chasing the two-week Googlebot blackout, this run curled
production with Googlebot's user-agent string and found what looked like the
answer:

```
/robots.txt  browser UA   0.14 s      (X-Vercel-Cache: HIT, Age 817)
/robots.txt  Googlebot UA 7.2 / 10.1 / 8.7 s   (X-Vercel-Cache: HIT, Age 828)
```

Reproducible, interleaved, on a **cache HIT of a static file** from the same
edge node — so not origin work and not a cold cache. The whole delay is TTFB
(`time_starttransfer` 6.78 s of a 6.78 s total; TLS handshake normal). It fires
only on the exact-case substring `Googlebot`: `googlebot` lowercase, `bingbot`,
`GPTBot`, `Google-InspectionTool`, `curl/8.5.0` and an empty UA were all
~0.13 s. Nothing in this repo does it — there is no `middleware.ts` and no
user-agent branch anywhere in `app/`, `lib/` or `vercel.json`.

Every ingredient of a finding was there: a big effect, a clean mechanism, a
matching symptom, and a plausible story (a crawler that waits 10 s for
`robots.txt` backs off hard).

**The control refuted it in one command.** Three unrelated Vercel-hosted sites,
same probe:

| host | browser UA | Googlebot UA |
|---|---|---|
| currentwire.us | 0.23 s | 10.18 s |
| vercel.com | 0.24 s | 10.20 s |
| nextjs.org | 0.72 s | 10.19 s |
| resend.com | 0.51 s | 10.16 s |

A ~10.2 s hold on every Vercel property, including Vercel's own, is platform
behaviour — almost certainly the reverse-DNS verification of a *claimed*
Googlebot that fails because the request comes from a residential IP. Real
Googlebot fetches from verified Google ranges and is not this client. **The
site is not tarpitting Googlebot, and this is not the cause of the crawl
collapse.**

**Why this is worth remembering.** The probe is the obvious thing to try when a
crawler stops fetching, the reading is dramatic, and it is available to any
future run in one curl. Published as a finding it would have sent the owner to
a Vercel firewall setting that does not exist, and it would have "explained"
the collapse — closing the real investigation.

**How to apply:** a measurement taken *as* someone is a measurement of what the
server does to an impostor, not of what it does to them. Before any
identity-conditioned finding — user agent, IP, referrer, cookie, header —
run the same probe against a site whose behaviour you already know. If the
control moves with you, the effect is not yours. Related:
[[2026-08-31-a-control-proves-ranking-not-magnitude]],
[[2026-09-07-a-dashboard-read-is-not-a-dashboard-understood]].
