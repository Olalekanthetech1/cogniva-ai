import { and, asc, eq, lt, or } from "drizzle-orm";
import {
  aiBenchmarkResults,
  aiBenchmarkRuns
} from "@cogniva/database";
import {
  AiProviderRuntimeError,
  generateTextWithProvider
} from "@/lib/ai-provider-runtime";
import { getAdminAccess } from "@/lib/admin-data";
import {
  calculateBenchmarkCost,
  updateAiBenchmarkRunProgress,
  validateBenchmarkOutput
} from "@/lib/ai-benchmark-service";
import { getStudentDatabase, isUuid } from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ runId: string }> };

function hasTrustedOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return false;

  try {
    const normalizedOrigin = new URL(requestOrigin).origin;
    const configuredOrigins = [
      process.env.BETTER_AUTH_URL,
      ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",")
    ].filter((value): value is string => Boolean(value?.trim()));

    return configuredOrigins.some((value) => {
      try {
        return new URL(value).origin === normalizedOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function fail(code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 503) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return fail(
      "ORIGIN_NOT_ALLOWED",
      "Benchmark execution must come from a trusted Cogniva origin.",
      403
    );
  }

  try {
    const access = await getAdminAccess();
    if (access.kind === "unauthenticated") {
      return fail("UNAUTHENTICATED", "Sign in to access Cogniva administration.", 401);
    }
    if (access.kind === "forbidden") {
      return fail("FORBIDDEN", "Administrator access is required.", 403);
    }

    const { runId } = await context.params;
    if (!isUuid(runId)) return fail("INVALID_RUN_ID", "The benchmark run ID is invalid.", 400);

    const db = getStudentDatabase();
    const [run] = await db
      .select({ id: aiBenchmarkRuns.id, status: aiBenchmarkRuns.status })
      .from(aiBenchmarkRuns)
      .where(eq(aiBenchmarkRuns.id, runId))
      .limit(1);

    if (!run) return fail("BENCHMARK_RUN_NOT_FOUND", "The benchmark run was not found.", 404);
    if (run.status !== "running") {
      const progress = await updateAiBenchmarkRunProgress(runId);
      return Response.json(
        { data: { processed: false, done: progress.done, ...progress } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const staleClaimBefore = new Date(Date.now() - 60_000);
    const claimed = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select()
        .from(aiBenchmarkResults)
        .where(
          and(
            eq(aiBenchmarkResults.runId, runId),
            or(
              eq(aiBenchmarkResults.status, "pending"),
              and(
                eq(aiBenchmarkResults.status, "running"),
                lt(aiBenchmarkResults.claimedAt, staleClaimBefore)
              )
            )
          )
        )
        .orderBy(asc(aiBenchmarkResults.position))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!pending) return null;

      const [updated] = await tx
        .update(aiBenchmarkResults)
        .set({ status: "running", claimedAt: new Date() })
        .where(eq(aiBenchmarkResults.id, pending.id))
        .returning();

      return updated ?? null;
    });

    if (!claimed) {
      const progress = await updateAiBenchmarkRunProgress(runId);
      return Response.json(
        {
          data: {
            processed: false,
            busy: !progress.done,
            done: progress.done,
            ...progress
          }
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    try {
      const response = await generateTextWithProvider({
        provider: claimed.provider,
        model: claimed.model,
        systemPrompt: claimed.systemPrompt,
        userPrompt: claimed.userPrompt,
        maxOutputTokens: claimed.maxOutputTokens,
        temperature: 1,
        timeoutMs: 20000
      });

      if (response.text.length > 32000) {
        await db
          .update(aiBenchmarkResults)
          .set({
            status: "failed",
            failureCode: "OUTPUT_TOO_LARGE",
            failureMessage: "The provider output exceeded the benchmark storage limit.",
            latencyMs: response.latencyMs,
            completedAt: new Date()
          })
          .where(eq(aiBenchmarkResults.id, claimed.id));
      } else {
        const mechanicalCheck = validateBenchmarkOutput(
          claimed.task,
          response.text
        );
        const estimatedCost = calculateBenchmarkCost(
          claimed.candidateId,
          response.usage.inputTokens,
          response.usage.outputTokens
        );

        await db
          .update(aiBenchmarkResults)
          .set({
            status: "succeeded",
            outputText: response.text,
            usageInputTokens: response.usage.inputTokens,
            usageOutputTokens: response.usage.outputTokens,
            usageTotalTokens: response.usage.totalTokens,
            estimatedCostUsd:
              estimatedCost === null ? null : estimatedCost.toFixed(10),
            latencyMs: response.latencyMs,
            finishReason: response.finishReason,
            mechanicalCheck,
            completedAt: new Date(),
            failureCode: null,
            failureMessage: null
          })
          .where(eq(aiBenchmarkResults.id, claimed.id));
      }
    } catch (error) {
      const failureCode =
        error instanceof AiProviderRuntimeError
          ? error.code
          : "BENCHMARK_EXECUTION_FAILED";
      const failureMessage =
        error instanceof AiProviderRuntimeError
          ? error.message
          : "Cogniva could not complete this provider request.";

      await db
        .update(aiBenchmarkResults)
        .set({
          status: "failed",
          failureCode,
          failureMessage,
          completedAt: new Date()
        })
        .where(eq(aiBenchmarkResults.id, claimed.id));
    }

    const progress = await updateAiBenchmarkRunProgress(runId);
    return Response.json(
      { data: { processed: true, done: progress.done, ...progress } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return fail(
      "BENCHMARK_EXECUTION_UNAVAILABLE",
      "The next benchmark case could not be executed. Check the run and resume it; completed results remain saved.",
      503
    );
  }
}
