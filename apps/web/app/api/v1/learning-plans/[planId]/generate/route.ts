import { generateOwnedLearningPlan } from "@/lib/learning-plan-service";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return Response.json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in to generate this learning plan."
        }
      }, { status: 401 });
    }

    const { planId } = await params;
    if (!isUuid(planId)) {
      return Response.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The learning-plan ID is invalid."
        }
      }, { status: 400 });
    }

    const result = await generateOwnedLearningPlan({
      db: getStudentDatabase(),
      planId,
      studentId: student.id
    });

    if (!result.ok) {
      return Response.json({
        data: result.plan ?? null,
        error: result.error
      }, {
        status: result.httpStatus,
        headers: { "Cache-Control": "no-store" }
      });
    }

    return Response.json({ data: result.plan }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return Response.json({
      error: {
        code: "LEARNING_PLAN_GENERATION_FAILED",
        message: "Cogniva could not retry plan generation. Your saved topic remains available."
      }
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
