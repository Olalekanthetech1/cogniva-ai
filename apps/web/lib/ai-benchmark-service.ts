import { randomInt } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import {
  adminAuditEvents,
  aiBenchmarkResults,
  aiBenchmarkReviews,
  aiBenchmarkRuns
} from "@cogniva/database";
import { getStudentDatabase } from "@/lib/student-data";
import {
  AI_BENCHMARK_CANDIDATES,
  AI_BENCHMARK_CASES,
  AI_BENCHMARK_PRICING_SNAPSHOT,
  AI_BENCHMARK_SUITE_VERSION,
  AI_BENCHMARK_SYSTEM_PROMPTS,
  type AiBenchmarkCase,
  estimateBenchmarkCostUsd
} from "@/lib/ai-benchmark-suite";
import type { AiTaskKey } from "@/lib/admin-ai-config";

export type BenchmarkMechanicalCheck = {
  valid: boolean;
  issues: string[];
  wordCount?: number;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function getBenchmarkCredentialStatus() {
  return (["gemini", "groq", "mistral"] as const).map((provider) => {
    const variable = {
      gemini: "GEMINI_API_KEY",
      groq: "GROQ_API_KEY",
      mistral: "MISTRAL_API_KEY"
    }[provider];

    return {
      provider,
      credentialVariable: variable,
      configured: Boolean(process.env[variable]?.trim())
    };
  });
}

export async function createAiBenchmarkRun(adminUserId: string) {
  const missingProviders = getBenchmarkCredentialStatus()
    .filter((item) => !item.configured)
    .map((item) => item.provider);

  if (missingProviders.length > 0) {
    return { kind: "missing_credentials" as const, missingProviders };
  }

  const db = getStudentDatabase();
  const shuffledCandidates = shuffle([...AI_BENCHMARK_CANDIDATES]);
  const blindLabels = new Map(
    shuffledCandidates.map((candidate, index) => [
      candidate.id,
      String.fromCharCode(65 + index)
    ] as const)
  );

  const allCases = [
    ...AI_BENCHMARK_CASES.learning_plan_generation,
    ...AI_BENCHMARK_CASES.socratic_tutor_response
  ] as readonly AiBenchmarkCase[];

  const workItems = shuffle(
    AI_BENCHMARK_CANDIDATES.flatMap((candidate) =>
      allCases.map((benchmarkCase) => ({ candidate, benchmarkCase }))
    )
  );

  const now = new Date();
  const creation = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(827364190)`);
    const [activeRun] = await tx
      .select({ id: aiBenchmarkRuns.id })
      .from(aiBenchmarkRuns)
      .where(eq(aiBenchmarkRuns.status, "running"))
      .limit(1);

    if (activeRun) {
      return { kind: "active_run" as const, runId: activeRun.id };
    }

    const [run] = await tx
      .insert(aiBenchmarkRuns)
      .values({
        startedBy: adminUserId,
        suiteVersion: AI_BENCHMARK_SUITE_VERSION,
        pricingSnapshotId: AI_BENCHMARK_PRICING_SNAPSHOT,
        status: "running",
        totalResults: workItems.length,
        completedResults: 0,
        createdAt: now,
        startedAt: now
      })
      .returning({ id: aiBenchmarkRuns.id });

    if (!run) throw new Error("Benchmark run could not be created.");

    const rows = workItems.map(({ candidate, benchmarkCase }, index) => ({
      runId: run.id,
      position: index + 1,
      candidateId: candidate.id,
      provider: candidate.provider,
      model: candidate.model,
      blindLabel: blindLabels.get(candidate.id) ?? "X",
      task: benchmarkCase.task,
      caseId: benchmarkCase.id,
      caseTitle: benchmarkCase.title,
      systemPrompt: AI_BENCHMARK_SYSTEM_PROMPTS[benchmarkCase.task],
      userPrompt: benchmarkCase.userPrompt,
      maxOutputTokens: benchmarkCase.maxOutputTokens,
      inputUsdPerMillion: candidate.inputUsdPerMillion.toFixed(6),
      outputUsdPerMillion: candidate.outputUsdPerMillion.toFixed(6),
      pricingReviewedAt: candidate.pricingReviewedAt,
      pricingEffectiveThrough: candidate.pricingEffectiveThrough,
      pricingSource: candidate.pricingSource,
      status: "pending" as const,
      createdAt: now
    }));

    await tx.insert(aiBenchmarkResults).values(rows);
    await tx.insert(adminAuditEvents).values({
      actorUserId: adminUserId,
      action: "ai.benchmark.run_started",
      resourceType: "ai_benchmark_run",
      resourceId: run.id,
      metadata: {
        suiteVersion: AI_BENCHMARK_SUITE_VERSION,
        pricingSnapshotId: AI_BENCHMARK_PRICING_SNAPSHOT,
        totalResults: rows.length
      },
      createdAt: now
    });

    return { kind: "created" as const, runId: run.id };
  });

  return creation;
}

export function validateBenchmarkOutput(
  task: AiTaskKey,
  output: string
): BenchmarkMechanicalCheck {
  const issues: string[] = [];

  if (task === "learning_plan_generation") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return { valid: false, issues: ["Output is not valid JSON."] };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { valid: false, issues: ["Output must be a JSON object."] };
    }

    const plan = parsed as Record<string, unknown>;
    for (const field of ["title", "topic", "learnerLevel"] as const) {
      if (typeof plan[field] !== "string" || !plan[field].trim()) {
        issues.push(`Missing non-empty ${field}.`);
      }
    }

    if (!Array.isArray(plan.units) || plan.units.length !== 3) {
      issues.push("The plan must contain exactly three units.");
    } else {
      plan.units.forEach((unit, index) => {
        if (typeof unit !== "object" || unit === null || Array.isArray(unit)) {
          issues.push(`Unit ${index + 1} must be an object.`);
          return;
        }

        const item = unit as Record<string, unknown>;
        if (typeof item.title !== "string" || !item.title.trim()) {
          issues.push(`Unit ${index + 1} is missing a title.`);
        }
        if (
          !Array.isArray(item.objectives) ||
          item.objectives.length < 2 ||
          item.objectives.length > 3 ||
          !item.objectives.every(
            (objective) => typeof objective === "string" && objective.trim()
          )
        ) {
          issues.push(`Unit ${index + 1} must have two or three objective strings.`);
        }
        if (
          !Array.isArray(item.concepts) ||
          item.concepts.length < 2 ||
          item.concepts.length > 4 ||
          !item.concepts.every(
            (concept) => typeof concept === "string" && concept.trim()
          )
        ) {
          issues.push(`Unit ${index + 1} must have two to four concept strings.`);
        }
        if (
          !Array.isArray(item.prerequisites) ||
          !item.prerequisites.every(
            (prerequisite) =>
              typeof prerequisite === "string" && prerequisite.trim()
          )
        ) {
          issues.push(`Unit ${index + 1} must have a prerequisites array.`);
        }
        if (
          typeof item.estimatedMinutes !== "number" ||
          !Number.isInteger(item.estimatedMinutes) ||
          item.estimatedMinutes <= 0
        ) {
          issues.push(`Unit ${index + 1} must have positive estimatedMinutes.`);
        }
      });
    }

    return { valid: issues.length === 0, issues };
  }

  const wordCount = output.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 80) issues.push("Response exceeds the 80-word benchmark limit.");
  if (!output.trim().endsWith("?")) issues.push("Response does not end with a question prompt.");

  return { valid: issues.length === 0, issues, wordCount };
}

export async function updateAiBenchmarkRunProgress(runId: string) {
  const db = getStudentDatabase();
  const rows = await db
    .select({ status: aiBenchmarkResults.status })
    .from(aiBenchmarkResults)
    .where(eq(aiBenchmarkResults.runId, runId));

  const completedResults = rows.filter(
    (row) => row.status === "succeeded" || row.status === "failed"
  ).length;
  const failedResults = rows.filter((row) => row.status === "failed").length;
  const isComplete = rows.length > 0 && completedResults === rows.length;

  await db
    .update(aiBenchmarkRuns)
    .set({
      completedResults,
      ...(isComplete
        ? {
            status: failedResults === 0
              ? "completed" as const
              : "completed_with_failures" as const,
            completedAt: new Date()
          }
        : { status: "running" as const, completedAt: null })
    })
    .where(eq(aiBenchmarkRuns.id, runId));

  return {
    totalResults: rows.length,
    completedResults,
    failedResults,
    done: isComplete
  };
}

export async function getAiBenchmarkSnapshot(runId: string, reviewerId: string) {
  const db = getStudentDatabase();
  const [run] = await db
    .select()
    .from(aiBenchmarkRuns)
    .where(eq(aiBenchmarkRuns.id, runId))
    .limit(1);

  if (!run) return null;

  const [results, reviews] = await Promise.all([
    db.select().from(aiBenchmarkResults)
      .where(eq(aiBenchmarkResults.runId, runId))
      .orderBy(aiBenchmarkResults.position),
    db.select().from(aiBenchmarkReviews)
      .where(eq(aiBenchmarkReviews.reviewerId, reviewerId))
  ]);

  const reviewsByResult = new Map(reviews.map((review) => [review.resultId, review]));
  const succeeded = results.filter((result) => result.status === "succeeded");
  const reviewedCount = succeeded.filter((result) =>
    reviewsByResult.has(result.id)
  ).length;
  const identitiesRevealed =
    run.status !== "running" &&
    (succeeded.length === 0 || reviewedCount === succeeded.length);

  const resultCards = results.map((result) => {
    const review = reviewsByResult.get(result.id);
    const benchmarkCase = [
      ...AI_BENCHMARK_CASES.learning_plan_generation,
      ...AI_BENCHMARK_CASES.socratic_tutor_response
    ].find((item) => item.id === result.caseId);

    return {
      id: result.id,
      blindLabel: result.blindLabel,
      task: result.task,
      caseId: result.caseId,
      caseTitle: result.caseTitle,
      status: result.status,
      outputText: result.outputText,
      usage: {
        inputTokens: result.usageInputTokens,
        outputTokens: result.usageOutputTokens,
        totalTokens: result.usageTotalTokens
      },
      estimatedCostUsd: result.estimatedCostUsd,
      latencyMs: result.latencyMs,
      finishReason: result.finishReason,
      mechanicalCheck: result.mechanicalCheck,
      failureCode: result.failureCode,
      reviewCriteria: benchmarkCase?.reviewCriteria ?? [],
      reviewedByMe: Boolean(review),
      myScores: review?.scores ?? null,
      myNotes: review?.notes ?? null,
      ...(identitiesRevealed
        ? {
            provider: result.provider,
            model: result.resolvedModel ?? result.model,
            pricing: {
              inputUsdPerMillion: result.inputUsdPerMillion,
              outputUsdPerMillion: result.outputUsdPerMillion,
              reviewedAt: result.pricingReviewedAt,
              effectiveThrough: result.pricingEffectiveThrough,
              source: result.pricingSource
            }
          }
        : {})
    };
  });

  const failedResults = results.filter((result) => result.status === "failed").length;

  return {
    run: {
      id: run.id,
      suiteVersion: run.suiteVersion,
      pricingSnapshotId: run.pricingSnapshotId,
      status: run.status,
      totalResults: run.totalResults,
      completedResults: run.completedResults,
      succeededResults: succeeded.length,
      failedResults,
      reviewedResults: reviewedCount,
      identitiesRevealed,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null
    },
    results: resultCards,
    credentials: getBenchmarkCredentialStatus()
  };
}

export function getBenchmarkCase(task: AiTaskKey, caseId: string) {
  return AI_BENCHMARK_CASES[task].find((item) => item.id === caseId);
}

export function calculateBenchmarkCost(
  candidateId: string,
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  const candidate = AI_BENCHMARK_CANDIDATES.find(
    (item) => item.id === candidateId
  );
  return candidate
    ? estimateBenchmarkCostUsd(candidate, inputTokens, outputTokens)
    : null;
}

export async function getLatestAiBenchmarkRunId(): Promise<string | null> {
  const db = getStudentDatabase();
  const [run] = await db
    .select({ id: aiBenchmarkRuns.id })
    .from(aiBenchmarkRuns)
    .orderBy(desc(aiBenchmarkRuns.createdAt))
    .limit(1);
  return run?.id ?? null;
}
