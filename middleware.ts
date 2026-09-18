import { NextResponse, type NextRequest } from "next/server";
import keepList from "@/data/story-keep-list.json";
import { storyIdFromSlug } from "@/lib/editorial/retirement";

/**
 * Serves 410 Gone for the retired `/story/` corpus.
 *
 * ── OFF BY DEFAULT ──────────────────────────────────────────────────────────
 * This does nothing unless STORY_RETIREMENT=on is set in the environment.
 * Retiring a URL is effectively irreversible in search: once Google sees 410
 * it drops the page and the ranking does not come back. That is a decision the
 * owner takes deliberately, on a date they choose — never something that
 * switches itself on because code merged.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 * `config.matcher` below restricts this to `/story/*`. Middleware billed on
 * every request would be its own problem: edge requests were 2.1M against a
 * 1M cap in the blowout. Matching only the retired prefix keeps it to the
 * paths it exists for, and the keep-list is a static JSON import (no database,
 * no network, no per-request I/O).
 *
 * ── WHY 410 AND NOT 404 OR 301 ──────────────────────────────────────────────
 * See lib/editorial/retirement.ts. Short version: the content was deliberately
 * removed and is not republished elsewhere, so 410 is the truthful status;
 * redirecting to a non-equivalent page is a soft-404 and counts against the
 * domain.
 *
 * URLs on the keep-list fall through untouched and are served normally.
 */

const KEEP = new Set<string>(keepList.keep);

/** Minimal, honest body. Crawlers read the status; a human might read this. */
const GONE_BODY = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>This story has been retired — CurrentWire</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;
       display:grid;place-items:center;min-height:100vh;padding:24px}
  main{max-width:34rem}
  h1{font-size:1.5rem;margin:0 0 .75rem}
  p{margin:0 0 1rem}
  a{color:inherit}
</style></head>
<body><main>
<h1>This story has been retired</h1>
<p>CurrentWire no longer publishes automated story summaries. This page was
one of them, and it has been removed on purpose rather than left to rot.</p>
<p>We now publish a small number of original, multi-source articles each day.
<a href="/">Start from the front page</a>, or read
<a href="/editorial-standards">how we work</a>.</p>
</main></body></html>`;

export function middleware(request: NextRequest): NextResponse {
  if (process.env.STORY_RETIREMENT !== "on") return NextResponse.next();

  const slug = request.nextUrl.pathname.replace(/^\/story\//, "").replace(/\/$/, "");
  if (!slug) return NextResponse.next();

  const id = storyIdFromSlug(slug);
  if (id && KEEP.has(id)) return NextResponse.next();

  return new NextResponse(GONE_BODY, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Retirement is permanent; let caches and crawlers stop asking.
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}

export const config = {
  // Only the retired prefix. Everything else never reaches this file.
  matcher: "/story/:path*",
};
