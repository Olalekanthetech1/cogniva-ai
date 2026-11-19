import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  learningPlanConceptRelations,
  learningPlanConcepts,
  learningPlanObjectives,
  learningPlanRevisions,
  learningPlans,
  learningPlanUnitConcepts,
  learningPlanUnits
} from "@cogniva/database";
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

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function GET(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) {
      return errorResponse("UNAUTHENTICATED", "Sign in to view this learning plan.", 401);
    }

    const { planId } = await params;
    if (!isUuid(planId)) {
      return errorResponse("VALIDATION_ERROR", "The learning-plan ID is invalid.", 400);
    }

    const db = getStudentDatabase();
    const [plan] = await db
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
      .where(
        and(
          eq(learningPlans.id, planId),
          eq(learningPlans.studentId, student.id)
        )
      )
      .limit(1);

    if (!plan) {
      return errorResponse("LEARNING_PLAN_NOT_FOUND", "Learning plan not found.", 404);
    }

    const revisions = await db
      .select({
        id: learningPlanRevisions.id,
        learningPlanId: learningPlanRevisions.learningPlanId,
        revisionNumber: learningPlanRevisions.revisionNumber,
        title: learningPlanRevisions.title,
        summary: learningPlanRevisions.summary,
        sourceInput: learningPlanRevisions.sourceInput,
        status: learningPlanRevisions.status,
        generationProvider: learningPlanRevisions.generationProvider,
        generationModel: learningPlanRevisions.generationModel,
        promptVersion: learningPlanRevisions.promptVersion,
        outputSchemaVersion: learningPlanRevisions.outputSchemaVersion,
        generatedAt: learningPlanRevisions.generatedAt,
        reviewedAt: learningPlanRevisions.reviewedAt,
        createdAt: learningPlanRevisions.createdAt
      })
      .from(learningPlanRevisions)
      .where(eq(learningPlanRevisions.learningPlanId, planId))
      .orderBy(desc(learningPlanRevisions.revisionNumber));

    if (revisions.length === 0) {
      return Response.json({ data: { ...plan, revisions, selectedRevision: null } }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const requestedRevisionId = new URL(request.url).searchParams.get("revisionId");
    if (requestedRevisionId && !isUuid(requestedRevisionId)) {
      return errorResponse("VALIDATION_ERROR", "The revision ID is invalid.", 400);
    }

    const revision = requestedRevisionId
      ? revisions.find((item) => item.id === requestedRevisionId)
      : revisions[0];

    if (!revision) {
      return errorResponse("LEARNING_PLAN_REVISION_NOT_FOUND", "The requested plan revision was not found.", 404);
    }

    const [units, concepts, relations] = await Promise.all([
      db
        .select({
          id: learningPlanUnits.id,
          title: learningPlanUnits.title,
          description: learningPlanUnits.description,
          position: learningPlanUnits.position
        })
        .from(learningPlanUnits)
        .where(eq(learningPlanUnits.revisionId, revision.id))
        .orderBy(asc(learningPlanUnits.position)),
      db
        .select({
          id: learningPlanConcepts.id,
          name: learningPlanConcepts.name,
          kind: learningPlanConcepts.kind,
          description: learningPlanConcepts.description,
          position: learningPlanConcepts.position
        })
        .from(learningPlanConcepts)
        .where(eq(learningPlanConcepts.revisionId, revision.id))
        .orderBy(asc(learningPlanConcepts.position)),
      db
        .select({
          id: learningPlanConceptRelations.id,
          sourceConceptId: learningPlanConceptRelations.sourceConceptId,
          targetConceptId: learningPlanConceptRelations.targetConceptId,
          relationType: learningPlanConceptRelations.relationType,
          reviewStatus: learningPlanConceptRelations.reviewStatus,
          reviewedAt: learningPlanConceptRelations.reviewedAt
        })
        .from(learningPlanConceptRelations)
        .where(eq(learningPlanConceptRelations.revisionId, revision.id))
    ]);

    const unitIds = units.map((unit) => unit.id);
    const [objectives, unitConcepts] = unitIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: learningPlanObjectives.id,
              unitId: learningPlanObjectives.unitId,
              statement: learningPlanObjectives.statement,
              position: learningPlanObjectives.position
            })
            .from(learningPlanObjectives)
            .where(inArray(learningPlanObjectives.unitId, unitIds))
            .orderBy(asc(learningPlanObjectives.position)),
          db
            .select({
              unitId: learningPlanUnitConcepts.unitId,
              conceptId: learningPlanUnitConcepts.conceptId,
              position: learningPlanUnitConcepts.position
            })
            .from(learningPlanUnitConcepts)
            .where(eq(learningPlanUnitConcepts.revisionId, revision.id))
            .orderBy(asc(learningPlanUnitConcepts.position))
        ])
      : [[], []];

    const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));
    const selectedRevision = {
      ...revision,
      concepts,
      relationships: relations.map((relation) => ({
        id: relation.id,
        sourceConcept: conceptsById.get(relation.sourceConceptId)?.name ?? null,
        targetConcept: conceptsById.get(relation.targetConceptId)?.name ?? null,
        type: relation.relationType,
        reviewStatus: relation.reviewStatus,
        reviewedAt: relation.reviewedAt
      })),
      units: units.map((unit) => ({
        ...unit,
        objectives: objectives
          .filter((objective) => objective.unitId === unit.id)
          .map((objective) => ({
            id: objective.id,
            statement: objective.statement,
            position: objective.position
          })),
        concepts: unitConcepts
          .filter((mapping) => mapping.unitId === unit.id)
          .map((mapping) => ({
            ...conceptsById.get(mapping.conceptId),
            position: mapping.position
          }))
      }))
    };

    return Response.json({
      data: { ...plan, revisions, selectedRevision }
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse(
      "LEARNING_PLAN_DATA_UNAVAILABLE",
      "This learning plan is temporarily unavailable. Please try again.",
      503
    );
  }
}
