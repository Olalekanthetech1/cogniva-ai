import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "../schema";

/**
 * A PostgreSQL connection factory. The URL is passed explicitly so importing
 * the package never reads environment variables or opens a live connection.
 *
 * postgres.js is supported by Drizzle's PostgreSQL driver and can connect to
 * standard PostgreSQL services, including managed PostgreSQL providers.
 */
export function createDatabase(databaseUrl: string) {
  if (!databaseUrl.trim()) {
    throw new Error("DATABASE_URL is required to connect to Cogniva's database.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const client: Sql = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });

  const db = drizzle(client, { schema });

  return { db, client };
}
