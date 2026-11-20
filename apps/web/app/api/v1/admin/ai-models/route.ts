import { registerAdminAiModel, getAdminAiModelRegistry } from "@/lib/admin-ai-model-registry";
import { hasTrustedAiAdminOrigin, requireAiAdministrator } from "@/lib/admin-ai-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const authorization = await requireAiAdministrator();
    if (!authorization.ok) return authorization.response;
    return Response.json({ data: await getAdminAiModelRegistry() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "AI_MODEL_REGISTRY_UNAVAILABLE", message: "The model registry could not be loaded." } }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
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
    const data = await registerAdminAiModel(body, authorization.id);
    return Response.json({ data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model registration failed.";
    const duplicate = /unique constraint|duplicate key/i.test(message);
    return Response.json({ error: { code: duplicate ? "MODEL_ALREADY_REGISTERED" : "VALIDATION_ERROR", message: duplicate ? "This exact provider model ID is already registered." : message } }, { status: duplicate ? 409 : 400 });
  }
}
