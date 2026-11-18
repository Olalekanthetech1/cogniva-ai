import { and, asc, eq } from "drizzle-orm";
import { tutorMessages, tutorSessions } from "@cogniva/database";
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

export async function GET(
  _request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to view this tutor session.", 401);
    }

    const { sessionId } = await params;
    if (!isUuid(sessionId)) {
      return errorResponse("VALIDATION_ERROR", "The tutor session ID is invalid.", 400);
    }

    const db = getStudentDatabase();
    const [session] = await db
      .select({
        id: tutorSessions.id,
        intent: tutorSessions.intent,
        initialPrompt: tutorSessions.initialPrompt,
        state: tutorSessions.state,
        currentStepIndex: tutorSessions.currentStepIndex,
        version: tutorSessions.version,
        learningPlanRevisionId: tutorSessions.learningPlanRevisionId,
        learningPlanUnitId: tutorSessions.learningPlanUnitId,
        createdAt: tutorSessions.createdAt,
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

    if (!session) {
      return errorResponse("TUTOR_SESSION_NOT_FOUND", "Tutor session not found.", 404);
    }

    const messages = await db
      .select({
        id: tutorMessages.id,
        role: tutorMessages.role,
        content: tutorMessages.content,
        sequenceNumber: tutorMessages.sequenceNumber,
        createdAt: tutorMessages.createdAt
      })
      .from(tutorMessages)
      .where(eq(tutorMessages.sessionId, session.id))
      .orderBy(asc(tutorMessages.sequenceNumber));

    return Response.json({ data: { ...session, messages } });
  } catch {
    return errorResponse(
      "TUTOR_DATA_UNAVAILABLE",
      "Tutor sessions are temporarily unavailable. Please try again.",
      503
    );
  }
}
