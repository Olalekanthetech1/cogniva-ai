import { desc, eq, inArray } from "drizzle-orm";
import {
  learningPlanRevisions,
  learningPlans
} from "@cogniva/database";
import { generateOwnedLearningPlan } from "@/lib/learning-plan-service";
import {
  getSignedInStudent,
  getStudentDatabase
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to view your learning plans.", 401);
    }

    const db = getStudentDatabase();
    const plans = await db
      .select({
        id: learningPlans.id,
        intent: learningPlans.intent,
        initialInput: learningPlans.initialInput,
        status: learningPlans.status,
        generationStatus: learningPlans.generationStatus,
        lastGenerationErrorCode: learningPlans.lastGenerationErrorCode,
        version: learningPlans.version,
        createdAt: learningPlans.createdAt,
        updatedAt: learningPlans.updatedAt
      })
      .from(learningPlans)
      .where(eq(learningPlans.studentId, student.id))
      .orderBy(desc(learningPlans.updatedAt))
      .limit(50);

    if (plans.length === 0) {
      return Response.json({ data: [] }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const planIds = plans.map((plan) => plan.id);
    const revisions = await db
      .select({
        id: learningPlanRevisions.id,
        learningPlanId: learningPlanRevisions.learningPlanId,
        revisionNumber: learningPlanRevisions.revisionNumber,
        title: learningPlanRevisions.title,
        summary: learningPlanRevisions.summary,
        status: learningPlanRevisions.status,
        generatedAt: learningPlanRevisions.generatedAt
      })
      .from(learningPlanRevisions)
      .where(inArray(learningPlanRevisions.learningPlanId, planIds))
      .orderBy(desc(learningPlanRevisions.revisionNumber));

    const latestByPlan = new Map<string, (typeof revisions)[number]>();
    for (const revision of revisions) {
      if (!latestByPlan.has(revision.learningPlanId)) {
        latestByPlan.set(revision.learningPlanId, revision);
      }
    }

    return Response.json({
      data: plans.map((plan) => ({
        ...plan,
        latestRevision: latestByPlan.get(plan.id) ?? null
      }))
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse(
      "LEARNING_PLAN_DATA_UNAVAILABLE",
      "Your learning plans are temporarily unavailable. Please try again.",
      503
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let student: Awaited<ReturnType<typeof getSignedInStudent>>;

  try {
    student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to create a learning plan.", 401);
    }
  } catch {
    return errorResponse(
      "LEARNING_PLAN_DATA_UNAVAILABLE",
      "Learning-plan data is temporarily unavailable. Please try again.",
      503
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "The request body must be valid JSON.", 400);
  }

  if (!isObject(body)) {
    return errorResponse("VALIDATION_ERROR", "The request body must be a JSON object.", 400);
  }

  if (
    Object.keys(body).length !== 1 ||
    typeof body.topic !== "string"
  ) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Submit exactly one field: topic.",
      400
    );
  }

  const topic = body.topic.trim();
  if (topic.length < 1 || topic.length > 4000) {
    return errorResponse(
      "VALIDATION_ERROR",
      "The topic must contain between 1 and 4,000 characters.",
      400
    );
  }

  const db = getStudentDatabase();
  let planId: string;
  try {
    const [plan] = await db
      .insert(learningPlans)
      .values({
        studentId: student.id,
        intent: "learn_topic",
        initialInput: topic,
        generationStatus: "pending"
      })
      .returning({ id: learningPlans.id });

    if (!plan) throw new Error("Learning plan insert returned no row.");
    planId = plan.id;
  } catch {
    return errorResponse(
      "LEARNING_PLAN_CREATE_FAILED",
      "Cogniva could not save this topic. No learning plan was created.",
      503
    );
  }

  const result = await generateOwnedLearningPlan({
    db,
    planId,
    studentId: student.id
  }).catch(() => null);

  if (!result) {
    return Response.json({
      data: { id: planId, generationStatus: "failed" },
      error: {
        code: "LEARNING_PLAN_GENERATION_FAILED",
        message: "Cogniva could not complete plan generation. Your topic was saved and can be retried."
      }
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (!result.ok) {
    return Response.json({
      data: result.plan ?? { id: planId, generationStatus: "failed" },
      error: result.error
    }, {
      status: result.httpStatus,
      headers: { "Cache-Control": "no-store" }
    });
  }

  return Response.json({ data: result.plan }, {
    status: 201,
    headers: { "Cache-Control": "no-store" }
  });
}
