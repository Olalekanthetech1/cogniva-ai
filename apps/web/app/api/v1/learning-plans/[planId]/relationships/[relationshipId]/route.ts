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
import { parseRelationshipReviewInput } from "@/lib/learning-plan-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ planId: string; relationshipId: string }>;
};

type ReviewResult =
  | {
      ok: true;
      data: {
        relationshipId: string;
        reviewStatus: "accepted" | "rejected";
        planVersion: number;
      };
    }
  | {
      ok: false;
      httpStatus: 404 | 409;
      code: string;
      message: string;
    };

class ConcurrentPlanReviewError extends Error {}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to review this learning plan.", 401);
    }

    const { planId, relationshipId } = await params;
    if (!isUuid(planId) || !isUuid(relationshipId)) {
      return errorResponse("VALIDATION_ERROR", "The learning-plan or relationship ID is invalid.", 400);
    }

    const body: unknown = await request.json().catch(() => null);
    const input = parseRelationshipReviewInput(body);
    if (!input) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Submit exactly expectedVersion and a decision of accepted or rejected.",
        400
      );
    }

    const db = getStudentDatabase();
    const result = await db.transaction(async (tx): Promise<ReviewResult> => {
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
          message: "This plan changed in another request. Refresh it before reviewing the relationship."
        };
      }

      if (plan.status !== "draft" || plan.generationStatus !== "succeeded") {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_NOT_REVIEWABLE",
          message: "Only a successfully generated draft plan can be reviewed."
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
          code: "LEARNING_PLAN_REVISION_NOT_REVIEWABLE",
          message: "The latest plan revision is not awaiting review."
        };
      }

      const [existingRelation] = await tx
        .select({
          id: learningPlanConceptRelations.id,
          reviewStatus: learningPlanConceptRelations.reviewStatus
        })
        .from(learningPlanConceptRelations)
        .where(and(
          eq(learningPlanConceptRelations.id, relationshipId),
          eq(learningPlanConceptRelations.revisionId, latestRevision.id)
        ))
        .limit(1);

      if (!existingRelation) {
        return {
          ok: false,
          httpStatus: 404,
          code: "LEARNING_PLAN_RELATIONSHIP_NOT_FOUND",
          message: "The suggested relationship was not found in the latest revision."
        };
      }

      if (existingRelation.reviewStatus !== "proposed") {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_RELATIONSHIP_ALREADY_REVIEWED",
          message: "This relationship already has a saved learner decision."
        };
      }

      const reviewedAt = new Date();
      const [updatedRelation] = await tx
        .update(learningPlanConceptRelations)
        .set({
          reviewStatus: input.decision,
          reviewedAt
        })
        .where(and(
          eq(learningPlanConceptRelations.id, relationshipId),
          eq(learningPlanConceptRelations.revisionId, latestRevision.id),
          eq(learningPlanConceptRelations.reviewStatus, "proposed")
        ))
        .returning({ id: learningPlanConceptRelations.id });

      if (!updatedRelation) {
        return {
          ok: false,
          httpStatus: 409,
          code: "LEARNING_PLAN_RELATIONSHIP_ALREADY_REVIEWED",
          message: "This relationship changed before your decision could be saved. Refresh the plan."
        };
      }

      const [updatedPlan] = await tx
        .update(learningPlans)
        .set({
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
        .returning({ version: learningPlans.version });

      if (!updatedPlan) throw new ConcurrentPlanReviewError();

      return {
        ok: true,
        data: {
          relationshipId,
          reviewStatus: input.decision,
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
    if (cause instanceof ConcurrentPlanReviewError) {
      return errorResponse(
        "LEARNING_PLAN_VERSION_CONFLICT",
        "This plan changed in another request. Refresh it before reviewing the relationship.",
        409
      );
    }
    return errorResponse(
      "LEARNING_PLAN_REVIEW_UNAVAILABLE",
      "Cogniva could not save this relationship decision. Refresh the plan and try again.",
      503
    );
  }
}
