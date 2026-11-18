import {
  aiTaskKeyValues
} from "@cogniva/database";
import {
  getAdminAiConfiguration,
  type AiTaskKey
} from "@/lib/admin-ai-config";
import {
  AiProviderRuntimeError,
  generateTextWithProvider
} from "@/lib/ai-provider-runtime";
import { getAdminAccess } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 409 | 422 | 429 | 502 | 504 | 503
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function hasTrustedOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return false;

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(requestOrigin).origin;
  } catch {
    return false;
  }

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
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      "ORIGIN_NOT_ALLOWED",
      "This provider test must come from a trusted Cogniva origin.",
      403
    );
  }

  try {
    const access = await getAdminAccess();

    if (access.kind === "unauthenticated") {
      return errorResponse(
        "UNAUTHENTICATED",
        "Sign in to access Cogniva administration.",
        401
      );
    }

    if (access.kind === "forbidden") {
      return errorResponse(
        "FORBIDDEN",
        "Administrator access is required.",
        403
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "The request body must be valid JSON.",
        400
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "The request body must be a JSON object.",
        400
      );
    }

    const input = body as Record<string, unknown>;
    if (
      Object.keys(input).length !== 1 ||
      typeof input.task !== "string" ||
      !aiTaskKeyValues.includes(input.task as AiTaskKey)
    ) {
      return errorResponse(
        "INVALID_TASK",
        "Choose one supported AI task to test its saved provider route.",
        400
      );
    }

    const task = input.task as AiTaskKey;
    const configuration = await getAdminAiConfiguration();
    const taskConfiguration = configuration.tasks.find(
      (item) => item.id === task
    );

    if (!taskConfiguration?.route) {
      return errorResponse(
        "ROUTE_NOT_CONFIGURED",
        "Save a provider and exact model ID for this task before testing it.",
        409
      );
    }

    const providerConfiguration = configuration.providers.find(
      (item) => item.id === taskConfiguration.route?.provider
    );

    if (!providerConfiguration?.credentialConfigured) {
      return errorResponse(
        "CREDENTIAL_MISSING",
        `The ${providerConfiguration?.credentialVariable ?? "provider API key"} environment variable is not configured.`,
        409
      );
    }

    const result = await generateTextWithProvider({
      provider: taskConfiguration.route.provider,
      model: taskConfiguration.route.model,
      systemPrompt:
        "You are checking a text-generation provider connection for Cogniva. Follow the user's instruction exactly and return no explanation.",
      userPrompt:
        "Reply with exactly this token and nothing else: COGNIVA_PROVIDER_CONNECTION_OK",
      maxOutputTokens: 24,
      temperature: 0,
      timeoutMs: 20000
    });

    const instructionCheck =
      result.text.trim() === "COGNIVA_PROVIDER_CONNECTION_OK"
        ? "passed"
        : "not_exact";

    return Response.json(
      {
        data: {
          task,
          provider: result.provider,
          requestedModel: result.requestedModel,
          resolvedModel: result.resolvedModel,
          status: "connected",
          instructionCheck,
          latencyMs: result.latencyMs,
          usage: result.usage
        }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AiProviderRuntimeError) {
      return errorResponse(
        error.code,
        error.message,
        error.statusCode
      );
    }

    return errorResponse(
      "PROVIDER_TEST_UNAVAILABLE",
      "Cogniva could not complete the provider test. No successful result was recorded.",
      503
    );
  }
}
