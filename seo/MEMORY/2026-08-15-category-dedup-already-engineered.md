One-line: The prompt pack's "data-quality bugs" item (wrong categories, duplicate stories) was already fixed upstream with measured benchmarks before SEO ops started — the SEO loop monitors, it does not re-fix.

Details: Classification and clustering were overhauled in audit rounds 3–6
(word-boundary scoring, gazetteer, cluster majority vote; event-fingerprint
clustering with a 491-pair benchmark, CI gates P≥0.98/R≥0.80). Real-production
accuracy is tracked in data/benchmark-history.json (59.7% → 73.2%) and on
/admin/status. If the SEO crawl finds a miscategorized or duplicated live story,
file it in BACKLOG.md as a classifier/clustering bug with the story URL — the fix
belongs in lib/news/, with benchmark coverage, not in page templates.
