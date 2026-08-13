import { normalizeArticle } from "../lib/news/normalization/normalize";
import { rssProvider } from "../lib/news/providers/rss";

/** Quick check: fetch configured RSS_FEEDS and report parse/normalize rates. */
async function main() {
  const raw = await rssProvider.fetchLatest();
  console.log(`raw items: ${raw.length}`);
  const now = new Date();
  let ok = 0;
  const bySource = new Map<string, number>();
  for (const item of raw) {
    const article = normalizeArticle(item, now);
    if (article) {
      ok++;
      bySource.set(article.source, (bySource.get(article.source) ?? 0) + 1);
    }
  }
  console.log(`normalized ok: ${ok}`);
  for (const [source, count] of bySource) console.log(`  ${source}: ${count}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
