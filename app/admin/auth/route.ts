import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/auth";
import { env } from "@/lib/env";
import { secureCompare, sha256Hex } from "@/lib/utils/secure-compare";

export const dynamic = "force-dynamic";

/**
 * Admin sign-in, once per browser. GET renders a minimal form; POST checks
 * the submitted key (timing-safe) and on success sets the httpOnly cookie
 * before redirecting to /admin/status. The key travels only in the POST
 * body — never the query string, which lands in access logs, browser
 * history and proxies. A legacy GET with ?key= no longer authenticates: it
 * ignores the param and shows the form. An invalid POST key still redirects
 * — without the cookie — and /admin/status 404s in production as before.
 */

const SIGN_IN_FORM = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin sign-in</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #fafaf9; color: #1c1917; }
  form { display: grid; gap: 12px; width: min(320px, 90vw); }
  h1 { margin: 0; font-size: 1.125rem; }
  input, button { font: inherit; padding: 10px 12px; border: 1px solid #d6d3d1; border-radius: 4px; }
  button { background: #1c1917; color: #fff; border-color: #1c1917; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
<form method="POST" action="/admin/auth">
  <h1>CurrentWire admin</h1>
  <input type="password" name="key" aria-label="Admin key" placeholder="Admin key" autocomplete="current-password" required autofocus>
  <button type="submit">Sign in</button>
</form>
</body>
</html>`;

export async function GET() {
  // Mirror /admin/status: without ADMIN_SECRET the route does not exist in prod.
  if (env.isProduction && !env.adminSecret) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(SIGN_IN_FORM, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const secret = env.adminSecret;
  if (env.isProduction && !secret) {
    return new NextResponse(null, { status: 404 });
  }

  let key: FormDataEntryValue | null = null;
  try {
    key = (await request.formData()).get("key");
  } catch {
    // Malformed or non-form body — treated as a missing key below.
  }
  // 303 so the browser follows with a GET and the secret is never
  // re-submitted on refresh or kept anywhere in the address bar.
  const response = NextResponse.redirect(
    new URL("/admin/status", request.nextUrl.origin),
    303,
  );
  if (secret && typeof key === "string" && secureCompare(key, secret)) {
    response.cookies.set(ADMIN_COOKIE, sha256Hex(secret), {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return response;
}
