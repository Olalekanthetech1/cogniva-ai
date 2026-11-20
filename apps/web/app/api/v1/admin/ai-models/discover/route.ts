import { aiProviderValues } from "@cogniva/database";
import { discoverAdminAiProviderModels } from "@/lib/admin-ai-model-registry";
import { requireAiAdministrator } from "@/lib/admin-ai-api-guard";
import type { AiProviderId } from "@/lib/admin-ai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authorization = await requireAiAdministrator();
  if (!authorization.ok) return authorization.response;
  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider || !aiProviderValues.includes(provider as AiProviderId)) {
    return Response.json({ error: { code: "INVALID_PROVIDER", message: "Choose Gemini, Groq, or Mistral." } }, { status: 400 });
  }
  try {
    const data = await discoverAdminAiProviderModels(provider as AiProviderId);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider discovery could not be completed.";
    return Response.json({ error: { code: "MODEL_DISCOVERY_FAILED", message } }, { status: 503 });
  }
}
