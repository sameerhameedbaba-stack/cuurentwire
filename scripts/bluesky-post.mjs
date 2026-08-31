/**
 * Bluesky auto-poster for @currentwire.bsky.social.
 *
 * Every run posts AT MOST ONE story: the newest item in the site's /rss
 * feed that the account has not already posted. Dedup is stateless — the
 * account's own recent feed is the ledger (the story URL lives in each
 * post's external-embed uri), so there is no state file and no commit-back.
 *
 * The post is the story headline plus a link card (title, description and
 * og:image thumbnail from the story page). Own headlines, own site, ~8
 * posts/day ceiling from the workflow cron — distribution, not spam.
 *
 * One-time bootstrap folded in: if the profile has no avatar yet, the
 * brand icon (/icon-512.png) is uploaded and set, preserving the existing
 * display name and bio. Any failure there is logged and skipped — it must
 * never block posting.
 *
 * Env: BLUESKY_APP_PASSWORD (required; GitHub Actions secret),
 *      BLUESKY_IDENTIFIER (default currentwire.bsky.social),
 *      SITE_ORIGIN (default https://currentwire.us).
 * Exits 0 with "skipped" when the secret is absent, so the workflow stays
 * green on forks and before setup — same convention as gsc-report.mjs.
 */

const PDS = "https://bsky.social";
const IDENTIFIER = process.env.BLUESKY_IDENTIFIER || "currentwire.bsky.social";
const SITE = (process.env.SITE_ORIGIN || "https://currentwire.us").replace(/\/$/, "");
const PASSWORD = process.env.BLUESKY_APP_PASSWORD;

/** Bluesky post text limit is 300 graphemes; stay comfortably under it. */
const TEXT_LIMIT = 280;
/** uploadBlob rejects blobs over ~1MB; leave headroom. */
const BLOB_LIMIT = 950_000;
/** How many recent own posts form the dedup window. */
const FEED_DEPTH = 50;
/** How many fresh RSS items are candidates each run. */
const RSS_DEPTH = 10;

if (!PASSWORD) {
  console.log("bluesky-post: skipped — BLUESKY_APP_PASSWORD not set.");
  process.exit(0);
}

function truncate(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function decodeEntities(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function fieldOf(itemXml, tag) {
  const match = itemXml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return match ? decodeEntities(match[1].trim()) : "";
}

async function xrpc(method, path, { token, params, body, contentType } = {}) {
  const url = new URL(`/xrpc/${path}`, PDS);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    if (contentType) {
      headers["content-type"] = contentType;
      payload = body;
    } else {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }
  const response = await fetch(url, { method, headers, body: payload });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${path} -> ${response.status} ${detail.slice(0, 300)}`);
  }
  return response.json();
}

async function ogTags(storyUrl) {
  try {
    const html = await (await fetch(storyUrl)).text();
    const tag = (property) => {
      const match =
        html.match(
          new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`),
        ) ??
        html.match(
          new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`),
        );
      return match ? decodeEntities(match[1]) : "";
    };
    return { image: tag("og:image"), description: tag("og:description") };
  } catch {
    return { image: "", description: "" };
  }
}

async function uploadBlobFrom(url, token) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > BLOB_LIMIT) return null;
    const result = await xrpc("POST", "com.atproto.repo.uploadBlob", {
      token,
      body: bytes,
      contentType: type,
    });
    return result.blob ?? null;
  } catch {
    return null;
  }
}

/** One-time, self-healing: set the brand icon if the profile has none. */
async function ensureAvatar(session) {
  try {
    const profile = await xrpc("GET", "app.bsky.actor.getProfile", {
      token: session.accessJwt,
      params: { actor: session.did },
    });
    if (profile.avatar) return;
    const blob = await uploadBlobFrom(`${SITE}/icon-512.png`, session.accessJwt);
    if (!blob) return;
    const existing = await xrpc("GET", "com.atproto.repo.getRecord", {
      token: session.accessJwt,
      params: { repo: session.did, collection: "app.bsky.actor.profile", rkey: "self" },
    });
    await xrpc("POST", "com.atproto.repo.putRecord", {
      token: session.accessJwt,
      body: {
        repo: session.did,
        collection: "app.bsky.actor.profile",
        rkey: "self",
        record: { ...existing.value, avatar: blob },
        swapRecord: existing.cid,
      },
    });
    console.log("bluesky-post: avatar set from /icon-512.png");
  } catch (error) {
    console.log(`bluesky-post: avatar bootstrap skipped (${error.message})`);
  }
}

const session = await xrpc("POST", "com.atproto.server.createSession", {
  body: { identifier: IDENTIFIER, password: PASSWORD },
});

await ensureAvatar(session);

const feed = await xrpc("GET", "app.bsky.feed.getAuthorFeed", {
  token: session.accessJwt,
  params: { actor: session.did, limit: String(FEED_DEPTH) },
});
const alreadyPosted = new Set();
for (const entry of feed.feed ?? []) {
  const uri = entry?.post?.record?.embed?.external?.uri ?? entry?.post?.embed?.external?.uri;
  if (uri) alreadyPosted.add(uri.replace(/\/$/, ""));
}

const rss = await (await fetch(`${SITE}/rss`)).text();
const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .slice(0, RSS_DEPTH)
  .map(([, xml]) => ({ title: fieldOf(xml, "title"), link: fieldOf(xml, "link") }))
  .filter((item) => item.title && item.link);

const candidate = items.find(
  (item) => !alreadyPosted.has(item.link.replace(/\/$/, "")),
);
if (!candidate) {
  console.log("bluesky-post: nothing new to post — all fresh stories already shared.");
  process.exit(0);
}

const og = await ogTags(candidate.link);
const thumb = og.image ? await uploadBlobFrom(og.image, session.accessJwt) : null;

const external = {
  uri: candidate.link,
  title: truncate(candidate.title, 300),
  description: truncate(og.description || "", 280),
};
if (thumb) external.thumb = thumb;

await xrpc("POST", "com.atproto.repo.createRecord", {
  token: session.accessJwt,
  body: {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: {
      $type: "app.bsky.feed.post",
      text: truncate(candidate.title, TEXT_LIMIT),
      createdAt: new Date().toISOString(),
      langs: ["en"],
      embed: { $type: "app.bsky.embed.external", external },
    },
  },
});

console.log(`bluesky-post: posted "${truncate(candidate.title, 80)}" -> ${candidate.link}`);
