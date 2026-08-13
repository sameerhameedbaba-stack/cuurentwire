import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/auth";
import { env } from "@/lib/env";
import { secureCompare, sha256Hex } from "@/lib/utils/secure-compare";

export const dynamic = "force-dynamic";

/**
 * One-time admin sign-in: visit /admin/auth?key=<ADMIN_SECRET> once per
 * browser. On a valid key this sets an httpOnly cookie and redirects to
 * /admin/status, so the secret never lives in the address bar or logs beyond
 * this single exchange. An invalid key still redirects — without the cookie —
 * and /admin/status 404s in production as before.
 */
export async function GET(request: NextRequest) {
  const secret = env.adminSecret;
  // Mirror /admin/status: without ADMIN_SECRET the route does not exist in prod.
  if (env.isProduction && !secret) {
    return new NextResponse(null, { status: 404 });
  }

  const key = request.nextUrl.searchParams.get("key");
  const response = NextResponse.redirect(
    new URL("/admin/status", request.nextUrl.origin),
    307,
  );
  if (secret && secureCompare(key, secret)) {
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
