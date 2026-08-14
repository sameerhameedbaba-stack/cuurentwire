import { siteConfig } from "@/config/site";
import { logger } from "@/lib/utils/logger";

/**
 * IndexNow: free, keyless-account protocol that tells Bing (and other
 * participating engines) about new URLs the moment they exist, instead of
 * waiting for a crawl. Ownership is proven by serving the key file at the
 * site root — the key is public by design, so committing it is safe.
 */

export const INDEXNOW_KEY = "d67fe7ac1896e8fd9e691a2d2abeca89";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Protocol limit per submission. */
export const INDEXNOW_MAX_URLS = 10_000;

const PING_TIMEOUT_MS = 5_000;

/**
 * Submit URLs to IndexNow. Never throws — a failed ping is a lost hint, not
 * an error worth breaking a refresh over. Returns true when the endpoint
 * accepted the submission (HTTP 200/202).
 */
export async function pingIndexNow(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (urls.length === 0) return true;
  const body = {
    host: new URL(siteConfig.url).host,
    key: INDEXNOW_KEY,
    keyLocation: `${siteConfig.url}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, INDEXNOW_MAX_URLS),
  };
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    const accepted = res.status === 200 || res.status === 202;
    if (accepted) {
      logger.info("indexnow.submitted", { urls: body.urlList.length });
    } else {
      logger.warn("indexnow.rejected", { status: res.status, urls: body.urlList.length });
    }
    return accepted;
  } catch (error) {
    logger.warn("indexnow.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
