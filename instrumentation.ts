/** Server startup hook: loud warning if production is serving demo data. */
export async function register() {
  const mode = process.env.NEWS_DATA_MODE?.toLowerCase();
  const hasProvider = Boolean(
    process.env.GNEWS_API_KEY || process.env.NEWS_API_KEY || process.env.RSS_FEEDS,
  );
  const effectiveMock = mode === "mock" || (mode !== "live" && !hasProvider);
  if (process.env.NODE_ENV === "production" && effectiveMock) {
    console.warn(
      "\n⚠  CurrentWire is running in PRODUCTION with MOCK news data.\n" +
        "   Every story is clearly-labeled demo content from fictional outlets.\n" +
        "   Set GNEWS_API_KEY / NEWS_API_KEY / RSS_FEEDS (and NEWS_DATA_MODE=live)\n" +
        "   to serve real coverage.\n",
    );
  }
}
