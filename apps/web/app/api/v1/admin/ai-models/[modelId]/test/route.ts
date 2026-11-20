import { generateTextWithProvider, AiProviderRuntimeError } from "@/lib/ai-provider-runtime";
import { resolveAiModelProbePolicy } from "@/lib/ai-model-test-policy";
import { getAdminAiModelForTest, recordAdminAiModelTest } from "@/lib/admin-ai-model-registry";
import { hasTrustedAiAdminOrigin, requireAiAdministrator } from "@/lib/admin-ai-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ modelId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  if (!hasTrustedAiAdminOrigin(request)) {
    return Response.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "This test must come from a trusted Cogniva origin." } }, { status: 403 });
  }
  const authorization = await requireAiAdministrator();
  if (!authorization.ok) return authorization.response;
  const { modelId } = await context.params;
  const model = await getAdminAiModelForTest(modelId);
  if (!model) return Response.json({ error: { code: "MODEL_NOT_FOUND", message: "The requested model is not registered." } }, { status: 404 });
  const credentialVariable = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", mistral: "MISTRAL_API_KEY" }[model.provider];
  if (!process.env[credentialVariable]?.trim()) {
    await recordAdminAiModelTest(modelId, { status: "failed", latencyMs: null, errorCode: "CREDENTIAL_MISSING" }, authorization.id);
    return Response.json({ error: { code: "CREDENTIAL_MISSING", message: "The matching provider credential is missing from the server environment." } }, { status: 409 });
  }
  const startedAt = Date.now();
  try {
    const policy = resolveAiModelProbePolicy({
      provider: model.provider,
      capabilities: model.capabilities,
      lastTestLatencyMs: model.lastTestLatencyMs
    });
    const result = await generateTextWithProvider({
      provider: model.provider,
      model: model.modelId,
      systemPrompt: "You are checking a text-generation model connection for Cogniva. Return the requested token without explanation.",
      userPrompt: "Reply with exactly this token and nothing else: COGNIVA_MODEL_CONNECTION_OK",
      maxOutputTokens: policy.maxOutputTokens,
      ...(policy.temperature !== undefined ? { temperature: policy.temperature } : {}),
      timeoutMs: policy.timeoutMs,
      ...(policy.reasoningControl ? { reasoningControl: policy.reasoningControl } : {})
    });
    const instructionCheck = result.text.trim() === "COGNIVA_MODEL_CONNECTION_OK" ? "passed" : "not_exact";
    await recordAdminAiModelTest(modelId, {
      status: instructionCheck === "passed" ? "connected" : "failed",
      latencyMs: result.latencyMs,
      errorCode: instructionCheck === "passed" ? null : "TEST_INSTRUCTION_NOT_EXACT"
    }, authorization.id);
    return Response.json({
      data: {
        modelId,
        provider: result.provider,
        requestedModel: result.requestedModel,
        resolvedModel: result.resolvedModel,
        status: instructionCheck === "passed" ? "connected" : "not_exact",
        instructionCheck,
        latencyMs: result.latencyMs,
        usage: result.usage,
        finishReason: result.finishReason,
        reasoningControlApplied: Boolean(policy.reasoningControl)
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof AiProviderRuntimeError ? error.code : "PROVIDER_TEST_UNAVAILABLE";
    const status = error instanceof AiProviderRuntimeError ? error.statusCode : 503;
    const latencyMs = Date.now() - startedAt;
    await recordAdminAiModelTest(modelId, { status: "failed", latencyMs, errorCode: code }, authorization.id).catch(() => undefined);
    return Response.json({
      error: {
        code,
        message: error instanceof AiProviderRuntimeError ? error.message : "The model connection test could not be completed."
      }
    }, { status });
  }
}
