import { count } from "drizzle-orm";
import { headers } from "next/headers";
import {
  learningPlans,
  tutorSessions,
  user
} from "@cogniva/database";
import { getAuth } from "@/lib/auth";
import { getStudentDatabase } from "@/lib/student-data";

export type AdminAccess =
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | {
      kind: "authorized";
      admin: { id: string; name: string; email: string };
    };

export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await getAuth().api.getSession({
    headers: await headers()
  });

  if (!session?.user) return { kind: "unauthenticated" };

  if (!session.user.emailVerified || session.user.role !== "admin") {
    return { kind: "forbidden" };
  }

  return {
    kind: "authorized",
    admin: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email
    }
  };
}

export async function getAdminDashboardMetrics() {
  const db = getStudentDatabase();

  const [userRows, planRows, tutorRows] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(learningPlans),
    db.select({ value: count() }).from(tutorSessions)
  ]);

  return {
    users: userRows[0]?.value ?? 0,
    learningPlans: planRows[0]?.value ?? 0,
    tutorSessions: tutorRows[0]?.value ?? 0,
    database: "available" as const
  };
}

export function adminErrorResponse(
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "ADMIN_OVERVIEW_UNAVAILABLE",
  message: string,
  status: 401 | 403 | 503
): Response {
  return Response.json({ error: { code, message } }, { status });
}
