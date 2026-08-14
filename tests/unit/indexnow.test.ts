import { describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_MAX_URLS,
  pingIndexNow,
} from "@/lib/seo/indexnow";

function fetchReturning(status: number) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

describe("pingIndexNow", () => {
  it("resolves true for an empty list without calling fetch", async () => {
    const fetchMock = fetchReturning(200);
    await expect(pingIndexNow([], fetchMock)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the documented payload shape to the IndexNow endpoint", async () => {
    const fetchMock = fetchReturning(200);
    const url = `${siteConfig.url}/story/example-story`;
    await expect(pingIndexNow([url], fetchMock)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe(INDEXNOW_ENDPOINT);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      host: new URL(siteConfig.url).host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteConfig.url}/${INDEXNOW_KEY}.txt`,
      urlList: [url],
    });
  });

  it("accepts 202 as success and non-2xx as rejection", async () => {
    await expect(pingIndexNow(["https://x/1"], fetchReturning(202))).resolves.toBe(true);
    await expect(pingIndexNow(["https://x/1"], fetchReturning(429))).resolves.toBe(false);
  });

  it("never throws when fetch fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(pingIndexNow(["https://x/1"], failing)).resolves.toBe(false);
  });

  it("caps the submission at the protocol limit", async () => {
    const fetchMock = fetchReturning(200);
    const urls = Array.from({ length: INDEXNOW_MAX_URLS + 5 }, (_, i) => `https://x/${i}`);
    await pingIndexNow(urls, fetchMock);
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.urlList).toHaveLength(INDEXNOW_MAX_URLS);
  });
});
