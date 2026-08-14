# CurrentWire — Response to Round-4 Focused Items (8 items)

All eight items are resolved, deployed and live-verified. Two of the eight were
stale observations (already fixed and live before your review); the other six
produced real work, including one production hole YOUR suggested probe caught
that none of us had spotted. Details with evidence below.

---

## 1. The remaining ABC "Kevin Rideout" cluster — CONFIRMED live, root-caused, fixed

You were right: production had TWO live clusters ("American missionary Kevin
Rideout released after 9 months in captivity in Niger" — ABC, and the
BBC/NPR/CBS cluster). I reproduced it offline by replaying the **real 342
headlines from the live dataset** through the exact production decision code.

Root cause was NOT the containment rule failing pairwise — five of six member
pairs already merged. Two compounding defects:

1. The BBC headline's word "**following**" ("released *following* kidnap") was
   treated as an event-identity stem. It is a sequence connective — it relates
   events, it never identifies one — and its inverse-document-frequency weight
   dragged BBC×ABC containment to 0.612 vs the 0.62 bar. "following", "amid"
   and "ago" are now weak tokens, like the demonyms and attribution vocabulary
   already excluded.
2. The anti-chaining validation pass measured every member **only against the
   cluster lead**. Union-find joined all four; ABC became lead; BBC (which
   matched NPR and CBS at containment **1.0**) was evicted for weak similarity
   to ABC alone. Validation now keeps a member that supports the lead **or a
   majority of the other members** — a genuinely chained outlier supports only
   one neighbor and is still evicted.

After the fix, the replay of the real corpus yields **one cluster: ABC + CBS +
NPR + BBC**. The four verbatim production headlines are a permanent regression
test (pairwise must-merge cases + a full clusterArticles test asserting one
4-source cluster that survives validation).

## 2. Homepage section bands — NOT REPRODUCIBLE post-deploy

Precise DOM parsing of the live homepage (band = `<section aria-label=…>` to
its closing tag): the World band contains only World-labeled cards; Culture
6/6, Sports 6/6, Technology 3/3 clean. The off-category labels a coarse scan
picks up are the mobile-drawer/footer navigation links (one per category) and
the explicitly titled "Health & Science" combined band. The primary-only
invariant is also unit-tested per band. Your observation almost certainly
predates the previous deploy (same as items 5 and the category pages last
round).

## 3. World → General flapping on one cluster — CONFIRMED, root-caused, fixed

Exact mechanism: a cluster's category was the LEAD article's category, and the
lead changes as coverage/images arrive. In the Niger cluster, NPR/CBS
headlines classify world ("kidnapped"), while ABC's ("held… in captivity")
carried no world keyword and classified general — so the label flapped with
the lead pick. Fix: **cluster category is now a deterministic member majority
vote** — general (the low-confidence bucket) never outvotes actual evidence,
the lead's category breaks ties, remaining ties break alphabetically. A
regression test rotates lead selection across all four members and asserts the
category never changes.

## 4. World cleanup for domestic stories — implemented two-sided

- **Foreign-place gazetteer**: ~45 country names (niger, mexico, china, iran,
  ukraine, …; collision-prone ones deliberately excluded: georgia, jordan,
  chad, turkey) are now world keywords — genuinely international stories earn
  World from the place itself, not from crime vocabulary.
- **Domestic demotion**: a story whose geography is confidently domestic
  (US/CA) and whose ONLY world evidence is a single weak signal ("Man
  kidnapped at gunpoint in Toronto, police say") is demoted to its next
  specific category or the internal general bucket. Multi-signal world stories
  about US/Canadian subjects (sanctions + airstrike + embassy) stay World, and
  the gazetteer prevents wrongful demotion of foreign stories about Americans
  (the Niger story itself is the regression test).

Benchmark after the change: category **99.6% high-confidence (260/261), 98.9%
overall**; geography unchanged at 100%/99.6%.

## 5. Editorial Standards Opinion text — was already deployed

Live production HTML (fetched this session):

> "CurrentWire indexes opinion and analysis pieces where publisher feeds carry
> them, and labels them visibly ("Opinion", "Analysis")… Opinion pieces are
> never eligible for the BREAKING label, which is reserved for reported news
> events."

plus the new "Press releases" policy section. Deployed in the previous round;
your crawler saw a stale copy.

## 6. Benchmark 220 → 491 pairs; the recall/precision frontier, measured

The benchmark now holds **491 labeled pairs** (227 SAME_EVENT, 141
RELATED_EVENT, 123 DIFFERENT_EVENT), deliberately heavy on deep paraphrases
and day-2 near-miss traps, with per-storyline unique fictional names so IDF
rarity behaves like a real corpus. Engine improvements this round: ~20 new
action-synonym families (fines~penalized, destroyed~gutted~leveled,
repairs~fixes, capsizes~overturns, earns~becomes, restored~resumes, …), adverb
stemming (narrowly~narrow), day-2 verb groups so follow-ups CONFLICT instead
of slipping through ("trial begins" vs "witness testifies"), and a three-tier
containment rule (shared-action 0.65 / no-action 0.72 / wide-anchor ≥3 rare
anchored stems + same action 0.62).

Measured trade-off on the 491 pairs (each floor fully evaluated):

```
floor 0.55 → precision 0.964  recall 0.833   (7 false merges)
floor 0.58 → precision 0.979  recall 0.815   (4 false merges)
floor 0.60 → precision 0.984  recall 0.806   (3 false merges)
floor 0.62 → precision 0.989  recall 0.806   (2 false merges)   ← shipped
```

**Straight answer on the 0.94 recall target: not reachable with this
deterministic lexical engine without materially damaging precision.** Every
recall point past ~0.83 on this set is bought by admitting day-2 follow-up
merges ("ferry capsizes, twelve rescued" absorbing "ferry operator faces
safety inquiry after capsize") — the false-merge class you explicitly warned
against. We ship the precision-first point (0.989/0.806; on the previous
220-pair set this same engine measures 0.989/0.900 — the expanded set is
deliberately harder than production traffic). CI now asserts precision ≥ 0.98
(raised from 0.95) and recall ≥ 0.80. The honest path to 0.94+ recall is
semantic similarity via the existing IntelligenceProvider hook (embeddings),
not more lexical rules; that is the designated next step when a $0-compatible
option is chosen.

## 7. Published-URL survival test — running daily, and it already earned its keep

`scripts/url-survival.mjs` + a daily GitHub Actions workflow: every /story/
URL ever advertised by sitemap.xml or news-sitemap.xml enters a committed
ledger; EVERY run re-checks the full ledger and fails loudly on anything that
is not 200 or a valid redirect-to-200. Your 7-day evidence will accumulate
automatically (first ledger commit: 318 URLs).

**The very first run caught a real hole**: 3 advertised URLs returned 404.
Root cause: the permanent archive was written only on cron-triggered
refreshes, but the shared cache also regenerates the dataset mid-window — a
cluster id born in such a generation was publicly advertised yet never
archived, so a later membership change killed its URL. Fixed: **every dataset
generation that becomes public is archived immediately** (same code path that
persists the coherence snapshot). This closes the last known
published-but-never-archived gap.

## 8. Operator disclosure — owner-confirmed deferral

Confirmed directly with the owner: the deferral is genuine and deliberate.
The site is operated on behalf of a client who will be named publicly at a
planned date roughly six months out; until then the About page intentionally
carries "Operator details: to be published." Nothing is fabricated and the
disclosure is scheduled, not forgotten.

---

## Gates (all green before deploy)

```
TypeScript strict:  PASS
ESLint:             PASS
Unit/integration:   223 tests passing (incl. new regression suites)
Playwright e2e:     desktop + mobile, passing
Production build:   PASS
Benchmarks:         category 99.6% | geography 100% | content-type 100% (high-conf)
                    clustering 491 pairs P=0.989 R=0.806 (P≥0.98 gate in CI)
```

## Live verification (post-deploy)

```
Niger story:        one cluster (see section 1 regression + live check)
Homepage bands:     primary-category only (DOM-parsed)
Editorial page:     new Opinion + Press-release sections live
URL survival:       daily probe active; producer-archive fix deployed
datasetVersion:     stamped on every refresh response
```
