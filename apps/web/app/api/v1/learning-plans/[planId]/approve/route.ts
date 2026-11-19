import { and, desc, eq, sql } from "drizzle-orm";
import {
  learningPlanConceptRelations,
  learningPlanRevisions,
  learningPlans
} from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid
} from "@/lib/student-data";
import { parsePlanApprovalInput } from "@/lib/learning-plan-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

type ApprovalResult =
  | {
      ok: true;
      data: {
        planId: string;
        planStatus: "active";
        revisionId: string;
        revisionStatus: "approved";
        planVersion: number;
      };
    }
  | {
      ok: false;
      httpStatus: 404 | 409;
      code: string;
      message: string;
    };

class ConcurrentPlanApprovalError extends Error {}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to approve this learning plan.", 401);
    }

    const { planId } = await params;
    if (!isUuid(planId)) {
      return errorResponse("VALIDATION_ERROR", "The learning-plan ID is invalid.", 400);
    }

    const body: unknown = await request.json().catch(() => null);
    const input = parsePlanApprovalInput(body);
    if (!input) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Submit exactly one field: expectedVersion.",
        400
      );
    }

    const db = getStudentDatabase();
    const result = await db.transaction(async (tx): Promise<ApprovalResult> => {
      const [plan] = await tx
        .select({
          id: learningPlans.id,
          status: learningPlans.status,
          generationStatus: learningPlans.generationStatus,
          version: learningPlans.version
        })
        .from(learningPlans)
        .where(and(
          eq(learningPlans.id, planId),
          eq(learningPlans.studentId, student.id)
        ))
        .limit(1);

      if (!plan) {
        return {
          ok: false,
          httpStatus: 404,
          code: "LEARNING_PLAN_NOT_FOUND",
          message: "Learning plan not found."
        };
      }

      if (plan.version !== input.expectedVersion) {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_VERSION_CONFLICT",
          message: "This plan changed in another request. Refresh it before approving."
        };
      }

      if (plan.status !== "draft" || plan.generationStatus !== "succeeded") {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_NOT_APPROVABLE",
          message: "Only a successfully generated draft plan can be approved."
        };
      }

      const [latestRevision] = await tx
        .select({
          id: learningPlanRevisions.id,
          status: learningPlanRevisions.status
        })
        .from(learningPlanRevisions)
        .where(eq(learningPlanRevisions.learningPlanId, planId))
        .orderBy(desc(learningPlanRevisions.revisionNumber))
        .limit(1);

      if (!latestRevision || latestRevision.status !== "proposed") {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_REVISION_NOT_APPROVABLE",
          message: "The latest plan revision is not awaiting approval."
        };
      }

      const [unreviewedRelationship] = await tx
        .select({ id: learningPlanConceptRelations.id })
        .from(learningPlanConceptRelations)
        .where(and(
          eq(learningPlanConceptRelations.revisionId, latestRevision.id),
          eq(learningPlanConceptRelations.reviewStatus, "proposed")
        ))
        .limit(1);

      if (unreviewedRelationship) {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_RELATIONSHIPS_UNREVIEWED",
          message: "Review every suggested relationship before approving this plan."
        };
      }

      const reviewedAt = new Date();
      const [updatedPlan] = await tx
        .update(learningPlans)
        .set({
          status: "active",
          version: sql`${learningPlans.version} + 1`,
          updatedAt: reviewedAt
        })
        .where(and(
          eq(learningPlans.id, planId),
          eq(learningPlans.studentId, student.id),
          eq(learningPlans.status, "draft"),
          eq(learningPlans.generationStatus, "succeeded"),
          eq(learningPlans.version, input.expectedVersion)
        ))
        .returning({
          id: learningPlans.id,
          status: learningPlans.status,
          version: learningPlans.version
        });

      if (!updatedPlan) throw new ConcurrentPlanApprovalError();

      const [updatedRevision] = await tx
        .update(learningPlanRevisions)
        .set({
          status: "approved",
          reviewedAt,
          updatedAt: reviewedAt
        })
        .where(and(
          eq(learningPlanRevisions.id, latestRevision.id),
          eq(learningPlanRevisions.status, "proposed")
        ))
        .returning({ id: learningPlanRevisions.id });

      if (!updatedRevision) throw new ConcurrentPlanApprovalError();

      return {
        ok: true,
        data: {
          planId: updatedPlan.id,
          planStatus: "active",
          revisionId: updatedRevision.id,
          revisionStatus: "approved",
          planVersion: updatedPlan.version
        }
      };
    });

    if (!result.ok) {
      return errorResponse(result.code, result.message, result.httpStatus);
    }

    return Response.json({ data: result.data }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (cause) {
    if (cause instanceof ConcurrentPlanApprovalError) {
      return errorResponse(
        "LEARNING_PLAN_VERSION_CONFLICT",
        "This plan changed in another request. Refresh it before approving.",
        409
      );
    }
    return errorResponse(
      "LEARNING_PLAN_APPROVAL_UNAVAILABLE",
      "Cogniva could not approve this plan. Refresh it and try again.",
      503
    );
  }
}
