import { and, eq, notInArray, sql } from "drizzle-orm";
import { tutorSessions } from "@cogniva/database";
import { getSignedInStudent, getStudentDatabase, isUuid } from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(
  _request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to end this tutor session.", 401);
    }

    const { sessionId } = await params;
    if (!isUuid(sessionId)) {
      return errorResponse("VALIDATION_ERROR", "The tutor session ID is invalid.", 400);
    }

    const db = getStudentDatabase();
    const [cancelled] = await db
      .update(tutorSessions)
      .set({
        state: "cancelled",
        version: sql`${tutorSessions.version} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(tutorSessions.id, sessionId),
          eq(tutorSessions.studentId, student.id),
          notInArray(tutorSessions.state, ["completed", "failed", "cancelled"])
        )
      )
      .returning({
        id: tutorSessions.id,
        state: tutorSessions.state,
        version: tutorSessions.version,
        updatedAt: tutorSessions.updatedAt,
        completedAt: tutorSessions.completedAt
      });

    if (cancelled) {
      return Response.json({ data: cancelled, ended: true });
    }

    const [existing] = await db
      .select({
        id: tutorSessions.id,
        state: tutorSessions.state,
        version: tutorSessions.version,
        updatedAt: tutorSessions.updatedAt,
        completedAt: tutorSessions.completedAt
      })
      .from(tutorSessions)
      .where(
        and(
          eq(tutorSessions.id, sessionId),
          eq(tutorSessions.studentId, student.id)
        )
      )
      .limit(1);

    if (!existing) {
      return errorResponse("TUTOR_SESSION_NOT_FOUND", "Tutor session not found.", 404);
    }

    return Response.json({ data: existing, ended: false });
  } catch {
    return errorResponse(
      "TUTOR_DATA_UNAVAILABLE",
      "Tutor sessions are temporarily unavailable. Please try again.",
      503
    );
  }
}
