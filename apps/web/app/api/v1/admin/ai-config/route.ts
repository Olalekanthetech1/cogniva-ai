import {
  aiProviderValues,
  aiTaskKeyValues
} from "@cogniva/database";
import {
  getAdminAiConfiguration,
  saveAdminAiTaskRoute
} from "@/lib/admin-ai-config";
import { getAdminAccess } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 503
): Response {
  return Response.json({ error: { code, message } }, { status });
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

async function requireAdministrator() {
  const access = await getAdminAccess();

  if (access.kind === "unauthenticated") {
    return {
      response: responseError(
        "UNAUTHENTICATED",
        "Sign in to access Cogniva administration.",
        401
      )
    };
  }

  if (access.kind === "forbidden") {
    return {
      response: responseError(
        "FORBIDDEN",
        "Administrator access is required.",
        403
      )
    };
  }

  return { access };
}

export async function GET(): Promise<Response> {
  try {
    const authorization = await requireAdministrator();
    if ("response" in authorization) return authorization.response;

    const data = await getAdminAiConfiguration();
    return Response.json({ data });
  } catch {
    return responseError(
      "ADMIN_AI_CONFIG_UNAVAILABLE",
      "AI configuration could not be loaded. No settings were estimated.",
      503
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    if (!hasTrustedOrigin(request)) {
      return responseError(
        "ORIGIN_NOT_ALLOWED",
        "This configuration change must come from a trusted Cogniva origin.",
        403
      );
    }

    const authorization = await requireAdministrator();
    if ("response" in authorization) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return responseError(
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
      return responseError(
        "VALIDATION_ERROR",
        "The request body must be a JSON object.",
        400
      );
    }

    const input = body as Record<string, unknown>;
    const allowedKeys = new Set(["task", "provider", "model"]);

    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      return responseError(
        "VALIDATION_ERROR",
        "The request contains unsupported configuration fields.",
        400
      );
    }

    if (
      typeof input.task !== "string" ||
      !aiTaskKeyValues.includes(input.task as (typeof aiTaskKeyValues)[number])
    ) {
      return responseError(
        "INVALID_TASK",
        "Choose a supported AI task.",
        400
      );
    }

    if (
      typeof input.provider !== "string" ||
      !aiProviderValues.includes(input.provider as (typeof aiProviderValues)[number])
    ) {
      return responseError(
        "INVALID_PROVIDER",
        "Choose Gemini, Groq, or Mistral.",
        400
      );
    }

    if (
      typeof input.model !== "string" ||
      input.model.trim().length < 1 ||
      input.model.trim().length > 160 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(input.model.trim())
    ) {
      return responseError(
        "INVALID_MODEL",
        "Enter an exact provider model ID using letters, numbers, dots, underscores, colons, slashes, or hyphens (up to 160 characters).",
        400
      );
    }

    const data = await saveAdminAiTaskRoute({
      task: input.task as (typeof aiTaskKeyValues)[number],
      provider: input.provider as (typeof aiProviderValues)[number],
      model: input.model.trim(),
      adminUserId: authorization.access.admin.id
    });

    return Response.json({ data });
  } catch {
    return responseError(
      "ADMIN_AI_CONFIG_SAVE_FAILED",
      "The routing preference could not be saved. No success was recorded.",
      503
    );
  }
}
