import { aiTaskKeyValues } from "@cogniva/database";
import {
  AdaptiveRoutingEmergencyOverrideError,
  AdaptiveRoutingNotReadyError,
  getAdminAiTaskRoutingSettings,
  updateAdminAiTaskRoutingMode
} from "@/lib/admin-ai-task-routing";
import {
  hasTrustedAiAdminOrigin,
  requireAiAdministrator
} from "@/lib/admin-ai-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const authorization = await requireAiAdministrator();
  if (!authorization.ok) return authorization.response;

  try {
    return Response.json(
      { data: await getAdminAiTaskRoutingSettings() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "AI_TASK_ROUTING_SETTINGS_UNAVAILABLE",
          message: "Task routing controls could not be loaded. No default state was substituted."
        }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!hasTrustedAiAdminOrigin(request)) {
    return Response.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "This change must come from a trusted Cogniva origin." } },
      { status: 403 }
    );
  }

  const authorization = await requireAiAdministrator();
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be a JSON object." } },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    typeof input.task !== "string" ||
    !aiTaskKeyValues.includes(input.task as (typeof aiTaskKeyValues)[number]) ||
    (input.mode !== "pinned" && input.mode !== "adaptive")
  ) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Choose a supported task and either pinned or adaptive mode." } },
      { status: 400 }
    );
  }

  try {
    const data = await updateAdminAiTaskRoutingMode({
      task: input.task as (typeof aiTaskKeyValues)[number],
      mode: input.mode,
      adminUserId: authorization.id
    });
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AdaptiveRoutingEmergencyOverrideError) {
      return Response.json(
        { error: { code: "AI_ROUTING_FORCE_PINNED_ACTIVE", message: error.message } },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (error instanceof AdaptiveRoutingNotReadyError) {
      return Response.json(
        {
          error: {
            code: "ADAPTIVE_ROUTING_NOT_READY",
            message: error.message,
            readiness: error.readiness
          }
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json(
      {
        error: {
          code: "AI_TASK_ROUTING_UPDATE_FAILED",
          message: "The task routing mode could not be saved. No successful change was recorded."
        }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
