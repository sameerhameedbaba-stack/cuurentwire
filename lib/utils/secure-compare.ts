import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets.
 * `timingSafeEqual` throws on length mismatch, so unequal lengths short-circuit
 * to false (revealing only the length, never the content). Non-string inputs
 * (missing headers/params) are never equal.
 */
export function secureCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Hex-encoded SHA-256 digest — used to derive cookie values from secrets. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
