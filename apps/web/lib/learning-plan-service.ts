import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  aiTaskRoutes,
  learningPlanConceptRelations,
  learningPlanConcepts,
  learningPlanObjectives,
  learningPlanRevisions,
  learningPlans,
  learningPlanUnitConcepts,
  learningPlanUnits
} from "@cogniva/database";
import {
  AiProviderRuntimeError,
  generateTextWithProvider
} from "@/lib/ai-provider-runtime";
import { getStudentDatabase } from "@/lib/student-data";
import {
  buildLearningPlanSystemPrompt,
  buildLearningPlanUserPrompt,
  LEARNING_PLAN_OUTPUT_SCHEMA_VERSION,
  LEARNING_PLAN_PROMPT_VERSION,
  LearningPlanOutputValidationError,
  parseLearningPlanOutput
} from "@/lib/learning-plan-output";

const GENERATION_LEASE_MS = 120_000;
const MAX_OUTPUT_TOKENS = 2048;

type LearningDatabase = ReturnType<typeof getStudentDatabase>;

type GenerationResult =
  | {
      ok: true;
      plan: {
        id: string;
        generationStatus: "succeeded";
        revisionId: string;
        revisionNumber: number;
        title: string;
        summary: string;
      };
    }
  | {
      ok: false;
      httpStatus: 404 | 409 | 422 | 502 | 503 | 504;
      error: { code: string; message: string };
      plan?: { id: string; generationStatus: string };
    };

function failure(
  httpStatus: 404 | 409 | 422 | 502 | 503 | 504,
  code: string,
  message: string,
  plan?: { id: string; generationStatus: string }
): GenerationResult {
  return { ok: false, httpStatus, error: { code, message }, plan };
}

function providerFailure(error: AiProviderRuntimeError) {
  if (
    error.code === "CREDENTIAL_MISSING" ||
    error.code === "CREDENTIAL_REJECTED" ||
    error.code === "MODEL_NOT_FOUND" ||
    error.code === "UPSTREAM_REJECTED"
  ) {
    return {
      generationStatus: "unavailable" as const,
      httpStatus: 503 as const,
      code: error.code,
      message: "The configured learning-plan provider is not ready. Check its administrator settings and server credential."
    };
  }

  if (error.code === "UPSTREAM_TIMEOUT") {
    return {
      generationStatus: "failed" as const,
      httpStatus: 504 as const,
      code: error.code,
      message: "Learning-plan generation timed out. Your topic is saved; retry generation when the provider is available."
    };
  }

  if (error.code === "RATE_LIMITED") {
    return {
      generationStatus: "failed" as const,
      httpStatus: 503 as const,
      code: error.code,
      message: "The learning-plan provider is rate-limited. Your topic is saved; retry later."
    };
  }

  return {
    generationStatus: "failed" as const,
    httpStatus: 503 as const,
    code: error.code,
    message: "The learning-plan provider is temporarily unavailable. Your topic is saved; retry later."
  };
}

async function setGenerationFailure(
  db: LearningDatabase,
  input: {
    planId: string;
    studentId: string;
    generationStatus: "failed" | "unavailable";
    errorCode: string;
  }
): Promise<void> {
  await db
    .update(learningPlans)
    .set({
      generationStatus: input.generationStatus,
      lastGenerationErrorCode: input.errorCode.slice(0, 80),
      version: sql`${learningPlans.version} + 1`,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(learningPlans.id, input.planId),
        eq(learningPlans.studentId, input.studentId),
        eq(learningPlans.generationStatus, "running")
      )
    );
}

export async function generateOwnedLearningPlan(input: {
  db: LearningDatabase;
  planId: string;
  studentId: string;
}): Promise<GenerationResult> {
  const { db, planId, studentId } = input;

  const [existing] = await db
    .select({
      id: learningPlans.id,
      initialInput: learningPlans.initialInput,
      generationStatus: learningPlans.generationStatus,
      updatedAt: learningPlans.updatedAt
    })
    .from(learningPlans)
    .where(
      and(
        eq(learningPlans.id, planId),
        eq(learningPlans.studentId, studentId)
      )
    )
    .limit(1);

  if (!existing) {
    return failure(404, "LEARNING_PLAN_NOT_FOUND", "Learning plan not found.");
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - GENERATION_LEASE_MS);
  const [claimed] = await db
    .update(learningPlans)
    .set({
      generationStatus: "running",
      lastGenerationErrorCode: null,
      version: sql`${learningPlans.version} + 1`,
      updatedAt: now
    })
    .where(
      and(
        eq(learningPlans.id, planId),
        eq(learningPlans.studentId, studentId),
        or(
          inArray(learningPlans.generationStatus, ["pending", "failed", "unavailable"]),
          and(
            eq(learningPlans.generationStatus, "running"),
            lt(learningPlans.updatedAt, staleBefore)
          )
        )
      )
    )
    .returning({ id: learningPlans.id, initialInput: learningPlans.initialInput });

  if (!claimed) {
    if (existing.generationStatus === "succeeded") {
      return failure(
        409,
        "LEARNING_PLAN_ALREADY_GENERATED",
        "This plan already has a generated revision. Editing and explicit regeneration are not available in this release.",
        { id: planId, generationStatus: existing.generationStatus }
      );
    }

    if (existing.generationStatus === "running" && existing.updatedAt.getTime() >= staleBefore.getTime()) {
      return failure(
        409,
        "LEARNING_PLAN_GENERATION_IN_PROGRESS",
        "Plan generation is already in progress. Refresh the plan before retrying.",
        { id: planId, generationStatus: existing.generationStatus }
      );
    }

    return failure(
      409,
      "LEARNING_PLAN_GENERATION_CONFLICT",
      "The plan changed while generation was being claimed. Refresh and try again.",
      { id: planId, generationStatus: existing.generationStatus }
    );
  }

  try {
    const [taskRoute] = await db
      .select({
        provider: aiTaskRoutes.provider,
        model: aiTaskRoutes.model
      })
      .from(aiTaskRoutes)
      .where(eq(aiTaskRoutes.task, "learning_plan_generation"))
      .limit(1);

    if (!taskRoute) {
      await setGenerationFailure(db, {
        planId,
        studentId,
        generationStatus: "unavailable",
        errorCode: "AI_ROUTE_NOT_CONFIGURED"
      });
      return failure(
        503,
        "AI_ROUTE_NOT_CONFIGURED",
        "Learning-plan generation is not configured by a Cogniva administrator. Your topic has been saved and can be retried later.",
        { id: planId, generationStatus: "unavailable" }
      );
    }

    let providerResult: Awaited<ReturnType<typeof generateTextWithProvider>>;
    try {
      providerResult = await generateTextWithProvider({
        provider: taskRoute.provider,
        model: taskRoute.model,
        systemPrompt: buildLearningPlanSystemPrompt(),
        userPrompt: buildLearningPlanUserPrompt(claimed.initialInput),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(taskRoute.provider !== "gemini" ? { temperature: 0.2 } : {}),,
        timeoutMs: 30_000
      });
    } catch (error) {
      if (error instanceof AiProviderRuntimeError) {
        const mapped = providerFailure(error);
        await setGenerationFailure(db, {
          planId,
          studentId,
          generationStatus: mapped.generationStatus,
          errorCode: mapped.code
        });
        return failure(
          mapped.httpStatus,
          mapped.code,
          mapped.message,
          { id: planId, generationStatus: mapped.generationStatus }
        );
      }

      await setGenerationFailure(db, {
        planId,
        studentId,
        generationStatus: "failed",
        errorCode: "PROVIDER_REQUEST_FAILED"
      });
      return failure(
        503,
        "PROVIDER_REQUEST_FAILED",
        "Cogniva could not complete the provider request. Your topic is saved and can be retried.",
        { id: planId, generationStatus: "failed" }
      );
    }

    if (
      ["length", "max_tokens", "max_output_tokens", "max_token_limit"].includes(
        providerResult.finishReason?.trim().toLowerCase() ?? ""
      )
    ) {
      await setGenerationFailure(db, {
        planId,
        studentId,
        generationStatus: "failed",
        errorCode: "GENERATED_PLAN_TRUNCATED"
      });
      return failure(
        502,
        "GENERATED_PLAN_TRUNCATED",
        "The provider response ended before the plan was complete. No partial plan was saved; retry generation.",
        { id: planId, generationStatus: "failed" }
      );
    }

    let planOutput;
    try {
      planOutput = parseLearningPlanOutput(providerResult.text);
    } catch (error) {
      const validationError =
        error instanceof LearningPlanOutputValidationError
          ? error
          : new LearningPlanOutputValidationError(
              "INVALID_GENERATED_PLAN",
              "The generated plan did not satisfy Cogniva's output contract."
            );
      await setGenerationFailure(db, {
        planId,
        studentId,
        generationStatus: "failed",
        errorCode: validationError.code
      });
      return failure(
        502,
        validationError.code,
        validationError.message + " Your topic is saved and can be retried.",
        { id: planId, generationStatus: "failed" }
      );
    }

    const persisted = await db.transaction(async (tx) => {
      const [latestRevision] = await tx
        .select({ revisionNumber: learningPlanRevisions.revisionNumber })
        .from(learningPlanRevisions)
        .where(eq(learningPlanRevisions.learningPlanId, planId))
        .orderBy(desc(learningPlanRevisions.revisionNumber))
        .limit(1);

      const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;
      const [revision] = await tx
        .insert(learningPlanRevisions)
        .values({
          learningPlanId: planId,
          revisionNumber,
          title: planOutput.title,
          summary: planOutput.summary,
          sourceInput: claimed.initialInput,
          status: "proposed",
          generationProvider: providerResult.provider,
          generationModel: providerResult.resolvedModel,
          promptVersion: LEARNING_PLAN_PROMPT_VERSION,
          outputSchemaVersion: LEARNING_PLAN_OUTPUT_SCHEMA_VERSION,
          generatedAt: new Date()
        })
        .returning({ id: learningPlanRevisions.id });

      if (!revision) throw new Error("Learning plan revision insert returned no row.");

      const insertedConcepts = await tx
        .insert(learningPlanConcepts)
        .values(
          planOutput.concepts.map((concept, index) => ({
            revisionId: revision.id,
            kind: concept.kind,
            name: concept.name,
            description: concept.description,
            position: index + 1
          }))
        )
        .returning({
          id: learningPlanConcepts.id,
          name: learningPlanConcepts.name
        });

      const conceptIdByName = new Map(
        insertedConcepts.map((concept) => [concept.name.trim().toLocaleLowerCase("en"), concept.id])
      );

      const unitConceptRows: Array<{
        revisionId: string;
        unitId: string;
        conceptId: string;
        position: number;
      }> = [];

      for (const [unitIndex, unit] of planOutput.units.entries()) {
        const [insertedUnit] = await tx
          .insert(learningPlanUnits)
          .values({
            revisionId: revision.id,
            title: unit.title,
            description: unit.description,
            position: unitIndex + 1
          })
          .returning({ id: learningPlanUnits.id });

        if (!insertedUnit) throw new Error("Learning plan unit insert returned no row.");

        if (unit.objectives.length > 0) {
          await tx.insert(learningPlanObjectives).values(
            unit.objectives.map((statement, objectiveIndex) => ({
              unitId: insertedUnit.id,
              statement,
              position: objectiveIndex + 1
            }))
          );
        }

        for (const [conceptIndex, conceptName] of unit.concepts.entries()) {
          const conceptId = conceptIdByName.get(conceptName.trim().toLocaleLowerCase("en"));
          if (!conceptId) throw new Error("Validated learning-plan concept mapping could not be resolved.");
          unitConceptRows.push({
            revisionId: revision.id,
            unitId: insertedUnit.id,
            conceptId,
            position: conceptIndex + 1
          });
        }
      }

      if (unitConceptRows.length > 0) {
        await tx.insert(learningPlanUnitConcepts).values(unitConceptRows);
      }

      if (planOutput.relationships.length > 0) {
        await tx.insert(learningPlanConceptRelations).values(
          planOutput.relationships.map((relationship) => {
            const sourceConceptId = conceptIdByName.get(
              relationship.sourceConcept.trim().toLocaleLowerCase("en")
            );
            const targetConceptId = conceptIdByName.get(
              relationship.targetConcept.trim().toLocaleLowerCase("en")
            );
            if (!sourceConceptId || !targetConceptId) {
              throw new Error("Validated learning-plan relationship could not be resolved.");
            }
            return {
              revisionId: revision.id,
              sourceConceptId,
              targetConceptId,
              relationType: relationship.type,
              reviewStatus: "proposed" as const
            };
          })
        );
      }

      const [updatedPlan] = await tx
        .update(learningPlans)
        .set({
          generationStatus: "succeeded",
          lastGenerationErrorCode: null,
          version: sql`${learningPlans.version} + 1`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(learningPlans.id, planId),
            eq(learningPlans.studentId, studentId),
            eq(learningPlans.generationStatus, "running")
          )
        )
        .returning({ id: learningPlans.id });

      if (!updatedPlan) throw new Error("Learning plan generation state changed before commit.");

      return { revisionId: revision.id, revisionNumber };
    });

    return {
      ok: true,
      plan: {
        id: planId,
        generationStatus: "succeeded",
        revisionId: persisted.revisionId,
        revisionNumber: persisted.revisionNumber,
        title: planOutput.title,
        summary: planOutput.summary
      }
    };
  } catch {
    try {
      await setGenerationFailure(db, {
        planId,
        studentId,
        generationStatus: "failed",
        errorCode: "PLAN_PERSISTENCE_FAILED"
      });
    } catch {
      // Preserve the original failure response; the stored running state remains visible.
    }

    return failure(
      503,
      "PLAN_PERSISTENCE_FAILED",
      "Cogniva could not save the complete generated plan. No partial revision was committed; retry generation.",
      { id: planId, generationStatus: "failed" }
    );
  }
}
