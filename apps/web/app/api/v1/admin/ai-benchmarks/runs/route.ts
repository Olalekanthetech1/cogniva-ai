import { desc } from "drizzle-orm";
import { aiBenchmarkRuns } from "@cogniva/database";
import { getAdminAccess } from "@/lib/admin-data";
import { getStudentDatabase } from "@/lib/student-data";
import {
  createAiBenchmarkRun,
  getAiBenchmarkSnapshot,
  getBenchmarkCredentialStatus
} from "@/lib/ai-benchmark-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function authorizationResponse(kind: "unauthenticated" | "forbidden") {
  return Response.json(
    {
      error: {
        code: kind === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN",
        message: kind === "unauthenticated"
          ? "Sign in to access Cogniva administration."
          : "Administrator access is required."
      }
    },
    { status: kind === "unauthenticated" ? 401 : 403 }
  );
}

export async function GET(): Promise<Response> {
  try {
    const access = await getAdminAccess();
    if (access.kind !== "authorized") return authorizationResponse(access.kind);

    const db = getStudentDatabase();
    const [latest] = await db
      .select({ id: aiBenchmarkRuns.id })
      .from(aiBenchmarkRuns)
      .orderBy(desc(aiBenchmarkRuns.createdAt))
      .limit(1);

    const snapshot = latest
      ? await getAiBenchmarkSnapshot(latest.id, access.admin.id)
      : null;

    return Response.json(
      {
        data: snapshot,
        credentials: getBenchmarkCredentialStatus()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "AI_BENCHMARK_UNAVAILABLE",
          message: "Benchmark data could not be loaded. No results were estimated."
        }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json(
      {
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "Benchmark runs must be started from a trusted Cogniva origin."
        }
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const access = await getAdminAccess();
    if (access.kind !== "authorized") return authorizationResponse(access.kind);

    const result = await createAiBenchmarkRun(access.admin.id);
    if (result.kind === "missing_credentials") {
      return Response.json(
        {
          error: {
            code: "BENCHMARK_CREDENTIALS_MISSING",
            message: "Configure all three provider credentials in Render before starting a comparative run.",
            missingProviders: result.missingProviders
          }
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (result.kind === "active_run") {
      return Response.json(
        {
          error: {
            code: "BENCHMARK_ALREADY_RUNNING",
            message: "A benchmark run is already active. Resume that run instead of starting another.",
            runId: result.runId
          }
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const snapshot = await getAiBenchmarkSnapshot(result.runId, access.admin.id);
    return Response.json(
      { data: snapshot },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "AI_BENCHMARK_START_FAILED",
          message: "The benchmark run could not be started. No successful run was recorded."
        }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
