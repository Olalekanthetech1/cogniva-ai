import { headers } from "next/headers";
import { createDatabase } from "@cogniva/database";
import { getAuth } from "@/lib/auth";

let database: ReturnType<typeof createDatabase> | undefined;

/**
 * Reuse one small PostgreSQL pool per server runtime. The database URL is
 * resolved only when a request actually needs the academic data layer.
 */
export function getStudentDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("The student data database is not configured.");
  }

  database ??= createDatabase(databaseUrl);
  return database.db;
}

export async function getSignedInStudent() {
  const session = await getAuth().api.getSession({
    headers: await headers()
  });

  return session?.user ?? null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function unauthenticatedResponse(): Response {
  return Response.json(
    {
      error: {
        code: "UNAUTHENTICATED",
        message: "Sign in to access your academic profile."
      }
    },
    { status: 401 }
  );
}

export function serviceUnavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: "STUDENT_DATA_UNAVAILABLE",
        message: "Academic data is temporarily unavailable. Please try again."
      }
    },
    { status: 503 }
  );
}
