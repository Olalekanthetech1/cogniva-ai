import { updateAdminAiModel } from "@/lib/admin-ai-model-registry";
import { hasTrustedAiAdminOrigin, requireAiAdministrator } from "@/lib/admin-ai-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ modelId: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  if (!hasTrustedAiAdminOrigin(request)) {
    return Response.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "This change must come from a trusted Cogniva origin." } }, { status: 403 });
  }
  const authorization = await requireAiAdministrator();
  if (!authorization.ok) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  try {
    const { modelId } = await context.params;
    const data = await updateAdminAiModel(modelId, body, authorization.id);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model update failed.";
    const code = message === "MODEL_NOT_FOUND" ? "MODEL_NOT_FOUND" : "VALIDATION_ERROR";
    return Response.json({ error: { code, message: code === "MODEL_NOT_FOUND" ? "The requested model is not registered." : message } }, { status: code === "MODEL_NOT_FOUND" ? 404 : 400 });
  }
}
