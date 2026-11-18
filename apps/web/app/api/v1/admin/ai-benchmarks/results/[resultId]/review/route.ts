import { eq } from "drizzle-orm";
import {
  adminAuditEvents,
  aiBenchmarkResults,
  aiBenchmarkReviews
} from "@cogniva/database";
import { getAdminAccess } from "@/lib/admin-data";
import { getBenchmarkCase } from "@/lib/ai-benchmark-service";
import { getStudentDatabase, isUuid } from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ resultId: string }> };

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

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Review must come from a trusted Cogniva origin." } },
      { status: 403 }
    );
  }

  try {
    const access = await getAdminAccess();
    if (access.kind === "unauthenticated") {
      return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to access Cogniva administration." } }, { status: 401 });
    }
    if (access.kind === "forbidden") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Administrator access is required." } }, { status: 403 });
    }

    const { resultId } = await context.params;
    if (!isUuid(resultId)) {
      return Response.json({ error: { code: "INVALID_RESULT_ID", message: "The benchmark result ID is invalid." } }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: { code: "INVALID_JSON", message: "Review data must be valid JSON." } }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: { code: "INVALID_REVIEW", message: "Review data must be a JSON object." } }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["scores", "notes"].includes(key))) {
      return Response.json({ error: { code: "INVALID_REVIEW", message: "Review data contains unsupported fields." } }, { status: 400 });
    }

    const db = getStudentDatabase();
    const [result] = await db
      .select({
        id: aiBenchmarkResults.id,
        task: aiBenchmarkResults.task,
        caseId: aiBenchmarkResults.caseId,
        caseTitle: aiBenchmarkResults.caseTitle,
        status: aiBenchmarkResults.status
      })
      .from(aiBenchmarkResults)
      .where(eq(aiBenchmarkResults.id, resultId))
      .limit(1);

    if (!result) {
      return Response.json({ error: { code: "BENCHMARK_RESULT_NOT_FOUND", message: "The benchmark result was not found." } }, { status: 404 });
    }
    if (result.status !== "succeeded") {
      return Response.json({ error: { code: "RESULT_NOT_REVIEWABLE", message: "Only successful provider outputs can be scored." } }, { status: 409 });
    }

    const benchmarkCase = getBenchmarkCase(result.task, result.caseId);
    if (!benchmarkCase) {
      return Response.json({ error: { code: "BENCHMARK_CASE_NOT_FOUND", message: "The versioned review criteria could not be found." } }, { status: 409 });
    }

    if (typeof input.scores !== "object" || input.scores === null || Array.isArray(input.scores)) {
      return Response.json({ error: { code: "INVALID_SCORES", message: "Provide a score for every review criterion." } }, { status: 400 });
    }

    const scores = input.scores as Record<string, unknown>;
    const expectedKeys = benchmarkCase.reviewCriteria.map((_, index) => `criterion_${index + 1}`);
    if (
      Object.keys(scores).length !== expectedKeys.length ||
      expectedKeys.some(
        (key) =>
          !Number.isInteger(scores[key]) ||
          (scores[key] as number) < 1 ||
          (scores[key] as number) > 5
      )
    ) {
      return Response.json({ error: { code: "INVALID_SCORES", message: "Each criterion must have one integer score from 1 to 5." } }, { status: 400 });
    }

    if (input.notes !== undefined && input.notes !== null && typeof input.notes !== "string") {
      return Response.json({ error: { code: "INVALID_NOTES", message: "Review notes must be text." } }, { status: 400 });
    }
    const notes = typeof input.notes === "string" ? input.notes.trim() : null;
    if (notes && notes.length > 2000) {
      return Response.json({ error: { code: "NOTES_TOO_LONG", message: "Review notes must be 2,000 characters or fewer." } }, { status: 400 });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .insert(aiBenchmarkReviews)
        .values({
          resultId,
          reviewerId: access.admin.id,
          scores: scores as Record<string, number>,
          notes,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [
            aiBenchmarkReviews.resultId,
            aiBenchmarkReviews.reviewerId
          ],
          set: {
            scores: scores as Record<string, number>,
            notes,
            updatedAt: now
          }
        });

      await tx.insert(adminAuditEvents).values({
        actorUserId: access.admin.id,
        action: "ai.benchmark.output_reviewed",
        resourceType: "ai_benchmark_result",
        resourceId: resultId,
        metadata: {
          task: result.task,
          caseId: result.caseId,
          caseTitle: result.caseTitle
        },
        createdAt: now
      });
    });

    return Response.json(
      { data: { saved: true } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: { code: "BENCHMARK_REVIEW_SAVE_FAILED", message: "The review could not be saved." } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
