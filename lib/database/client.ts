import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Lazy PostgreSQL client. The app runs fully without a database — this only
 * connects when DATABASE_URL is configured and persistence is requested.
 */

type Db = NodePgDatabase<typeof schema>;

const globalDb = globalThis as unknown as { __newsDb?: Db | null };

export function getDb(): Db | null {
  if (globalDb.__newsDb !== undefined) return globalDb.__newsDb;
  const url = env.databaseUrl;
  if (!url) {
    globalDb.__newsDb = null;
    return null;
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  globalDb.__newsDb = drizzle(pool, { schema });
  return globalDb.__newsDb;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}
