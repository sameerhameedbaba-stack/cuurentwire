/**
 * Shared bits of the admin auth flow (see app/admin/auth/route.ts and
 * app/admin/status/page.tsx).
 */

/** Cookie proving admin access. Holds sha256(ADMIN_SECRET), never the secret. */
export const ADMIN_COOKIE = "cw-admin";
