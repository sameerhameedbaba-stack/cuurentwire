# 2026-10-16 — Don't trust raw curl/openssl cert metadata in a cloud run

A cloud agent's outbound HTTPS goes through a TLS-intercepting egress
proxy (Anthropic's agent proxy, `/root/.ccr/`). It re-signs **every**
outbound TLS connection with its own CA and its own synthetic validity
window (observed: `notBefore` = the moment of the request, `notAfter` =
+30 days) — confirmed by probing unrelated domains (`google.com`,
`github.com`) in the same run and seeing the identical pattern of
"issuer: Anthropic Egress Gateway, valid now→+30d" regardless of what the
real origin's certificate actually says.

**What this means for this routine's TLS checks on currentwire.us:**

- The certificate **issuer and date fields** read via `curl -v` or
  `openssl s_client` in a cloud run are the proxy's own synthetic values,
  not GitHub's. Do not compare "validity window" or "issuer" across days
  as if they describe the real origin cert — they don't.
- The certificate **CN/SAN (hostname)** field does appear to reflect
  something real about the upstream connection (seen to vary between
  `*.github.io` and `currentwire.us` depending on which client/path hit
  which GitHub edge node in the same run on 2026-10-16), so CN/SAN is
  still informationally useful, but can legitimately be inconsistent
  within a single run if GitHub's own cert rollout across its edge
  network is itself mid-rollout — that inconsistency is not a tooling bug
  to "fix" by retrying until you get the answer you expect.
- **HTTP-layer status codes and response bodies obtained via Node's
  native `fetch`** (the client `scripts/seo-health-static.mjs` already
  uses, and which does not opt into `HTTPS_PROXY` via
  `NODE_USE_ENV_PROXY`) are the most trustworthy signal available in this
  sandbox. Cross-check any surprising status code against 1-2 unrelated
  HTTPS domains in the same run before concluding it's a real production
  symptom rather than a sandbox/proxy artifact — that's what distinguished
  the 2026-10-16 finding (a real `503 upstream connect error` from
  GitHub's own Fastly/Envoy-fronted serving layer, not a local artifact)
  from noise.

**Action for future watchdog runs:** keep using
`node scripts/seo-health-static.mjs` as the primary signal. If doing extra
`curl`/`openssl` cert inspection for a report, state plainly that
issuer/date fields are not meaningful in this environment, and sanity-check
any cert or status-code finding against an unrelated domain before writing
it into a report as a production fact.
