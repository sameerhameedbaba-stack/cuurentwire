/**
 * Compact, log-friendly description of a database error.
 *
 * Drizzle wraps failures in a DrizzleQueryError whose message embeds the
 * full SQL text and every bound parameter — for a bulk dataset insert that
 * is a ~260 KB log line that buries the actual Postgres error. This walks
 * the cause chain to the underlying driver error and reports its message
 * plus the structured fields Postgres attaches (code, detail, constraint),
 * truncated to a sane length.
 */
export function describeDbError(error: unknown): string {
  let cause: unknown = error;
  const seen = new Set<unknown>();
  while (
    cause instanceof Error &&
    cause.cause instanceof Error &&
    !seen.has(cause.cause)
  ) {
    seen.add(cause);
    cause = cause.cause;
  }
  if (!(cause instanceof Error)) return "unknown";

  const pg = cause as Error & {
    code?: string;
    detail?: string;
    constraint?: string;
    table?: string;
  };
  const parts = [pg.message];
  if (pg.code) parts.push(`code=${pg.code}`);
  if (pg.constraint) parts.push(`constraint=${pg.constraint}`);
  if (pg.table) parts.push(`table=${pg.table}`);
  if (pg.detail) parts.push(`detail=${pg.detail}`);
  return parts.join(" | ").slice(0, 600);
}
