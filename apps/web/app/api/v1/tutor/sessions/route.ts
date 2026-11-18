import { and, desc, eq } from "drizzle-orm";
import {
  learningPlanRevisions,
  learningPlans,
  learningPlanUnits,
  tutorMessages,
  tutorSessions
} from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedIntents = [
  "learn_topic",
  "understand_concept",
  "solve_problem"
] as const;

function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json({ error: { code, message } }, { status });
}

function optionalUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !isUuid(value)) return undefined;
  return value;
}

export async function GET(): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to view your tutor sessions.", 401);
    }

    const db = getStudentDatabase();
    const data = await db
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
      .where(eq(tutorSessions.studentId, student.id))
      .orderBy(desc(tutorSessions.updatedAt))
      .limit(50);

    return Response.json({ data });
  } catch {
    return errorResponse(
      "TUTOR_DATA_UNAVAILABLE",
      "Tutor sessions are temporarily unavailable. Please try again.",
      503
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to start a tutor session.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "The request body must be valid JSON.", 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse("VALIDATION_ERROR", "The request body must be a JSON object.", 400);
    }

    const input = body as Record<string, unknown>;
    const allowedKeys = new Set([
      "intent",
      "prompt",
      "learningPlanRevisionId",
      "learningPlanUnitId"
    ]);

    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      return errorResponse("VALIDATION_ERROR", "The request contains unsupported fields.", 400);
    }

    if (
      typeof input.intent !== "string" ||
      !allowedIntents.includes(input.intent as (typeof allowedIntents)[number])
    ) {
      return errorResponse("VALIDATION_ERROR", "Choose a valid learning intent.", 400);
    }

    if (typeof input.prompt !== "string") {
      return errorResponse("VALIDATION_ERROR", "Enter a learning prompt.", 400);
    }

    const prompt = input.prompt.trim();
    if (prompt.length < 1 || prompt.length > 4000) {
      return errorResponse(
        "VALIDATION_ERROR",
        "The learning prompt must contain between 1 and 4,000 characters.",
        400
      );
    }

    const requestedRevisionId = optionalUuid(input.learningPlanRevisionId);
    const requestedUnitId = optionalUuid(input.learningPlanUnitId);

    if (requestedRevisionId === undefined || requestedUnitId === undefined) {
      return errorResponse("VALIDATION_ERROR", "The learning-plan reference is invalid.", 400);
    }

    const db = getStudentDatabase();
    let resolvedRevisionId = requestedRevisionId;

    if (requestedRevisionId) {
      const [ownedRevision] = await db
        .select({ id: learningPlanRevisions.id })
        .from(learningPlanRevisions)
        .innerJoin(
          learningPlans,
          eq(learningPlanRevisions.learningPlanId, learningPlans.id)
        )
        .where(
          and(
            eq(learningPlanRevisions.id, requestedRevisionId),
            eq(learningPlans.studentId, student.id)
          )
        )
        .limit(1);

      if (!ownedRevision) {
        return errorResponse(
          "LEARNING_PLAN_NOT_FOUND",
          "The selected learning plan is not available to this account.",
          404
        );
      }
    }

    if (requestedUnitId) {
      const [ownedUnit] = await db
        .select({
          id: learningPlanUnits.id,
          revisionId: learningPlanUnits.revisionId
        })
        .from(learningPlanUnits)
        .innerJoin(
          learningPlanRevisions,
          eq(learningPlanUnits.revisionId, learningPlanRevisions.id)
        )
        .innerJoin(
          learningPlans,
          eq(learningPlanRevisions.learningPlanId, learningPlans.id)
        )
        .where(
          and(
            eq(learningPlanUnits.id, requestedUnitId),
            eq(learningPlans.studentId, student.id)
          )
        )
        .limit(1);

      if (!ownedUnit) {
        return errorResponse(
          "LEARNING_PLAN_UNIT_NOT_FOUND",
          "The selected learning-plan unit is not available to this account.",
          404
        );
      }

      if (resolvedRevisionId && resolvedRevisionId !== ownedUnit.revisionId) {
        return errorResponse(
          "LEARNING_PLAN_REFERENCE_MISMATCH",
          "The selected unit does not belong to the selected learning-plan revision.",
          422
        );
      }

      resolvedRevisionId = ownedUnit.revisionId;
    }

    const created = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(tutorSessions)
        .values({
          studentId: student.id,
          intent: input.intent as (typeof allowedIntents)[number],
          initialPrompt: prompt,
          learningPlanRevisionId: resolvedRevisionId,
          learningPlanUnitId: requestedUnitId
        })
        .returning({
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
        });

      if (!session) throw new Error("Tutor session creation returned no record.");

      const [initialMessage] = await tx
        .insert(tutorMessages)
        .values({
          sessionId: session.id,
          role: "student",
          content: prompt,
          sequenceNumber: 1
        })
        .returning({
          id: tutorMessages.id,
          role: tutorMessages.role,
          content: tutorMessages.content,
          sequenceNumber: tutorMessages.sequenceNumber,
          createdAt: tutorMessages.createdAt
        });

      if (!initialMessage) throw new Error("Initial tutor message creation returned no record.");

      return { session, initialMessage };
    });

    return Response.json({ data: created }, { status: 201 });
  } catch {
    return errorResponse(
      "TUTOR_DATA_UNAVAILABLE",
      "Tutor sessions are temporarily unavailable. Please try again.",
      503
    );
  }
}
