import { asc, eq } from "drizzle-orm";
import {
  aiModels,
  aiTaskModelCandidates,
  aiTaskRoutes
} from "@cogniva/database";
import type { AiProviderId, AiTaskKey } from "@/lib/admin-ai-config";
import type { getStudentDatabase } from "@/lib/student-data";
import {
  ADAPTIVE_ROUTING_POLICY_VERSION,
  assessAdaptiveRequest,
  buildAdaptiveGenerationSettings,
  selectAdaptiveCandidate
} from "@/lib/ai-adaptive-routing";
import type {
  AdaptiveComplexityBand,
  AdaptiveModelCandidate
} from "@/lib/ai-adaptive-routing";
import {
  generateTextWithProvider
} from "@/lib/ai-provider-runtime";
import type {
  AiTextGenerationResult
} from "@/lib/ai-provider-runtime";

type AiDatabase = ReturnType<typeof getStudentDatabase>;

const credentialVariables: Record<AiProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY"
};

const routingModeVariables: Record<AiTaskKey, string> = {
  learning_plan_generation: "AI_ROUTING_MODE_LEARNING_PLAN_GENERATION",
  socratic_tutor_response: "AI_ROUTING_MODE_SOCRATIC_TUTOR_RESPONSE"
};

export type AiTaskRoutingMode = "pinned" | "adaptive";

export type AiTaskRoutingMetadata = {
  mode: AiTaskRoutingMode;
  task: AiTaskKey;
  policyVersion: string | null;
  complexityBand: AdaptiveComplexityBand | null;
  estimatedInputTokens: number | null;
  eligibleCandidateCount: number | null;
  totalTaskCandidates: number | null;
  selectedModelId: string;
  selectedProvider: AiProviderId;
  administratorPriority: number | null;
  selectionReason: string;
};

export type AiTaskTextGenerationResult = AiTextGenerationResult & {
  routing: AiTaskRoutingMetadata;
};

export type AiTaskRoutingErrorCode =
  | "AI_ROUTE_NOT_CONFIGURED"
  | "AI_ADAPTIVE_MODEL_UNAVAILABLE"
  | "AI_ROUTING_CONFIGURATION_INVALID";

export class AiTaskRoutingError extends Error {
  constructor(readonly code: AiTaskRoutingErrorCode) {
    const messages: Record<AiTaskRoutingErrorCode, string> = {
      AI_ROUTE_NOT_CONFIGURED:
        "This AI task has no administrator-configured pinned route.",
      AI_ADAPTIVE_MODEL_UNAVAILABLE:
        "No administrator-enabled model currently satisfies this task's verified capabilities, provider credential, and output requirements. No alternative provider was selected.",
      AI_ROUTING_CONFIGURATION_INVALID:
        "The AI routing mode is invalid. Set this task's server-side routing mode to pinned or adaptive."
    };
    super(messages[code]);
    this.name = "AiTaskRoutingError";
  }
}

function readRoutingMode(task: AiTaskKey): AiTaskRoutingMode {
  const configured = process.env[routingModeVariables[task]]?.trim().toLowerCase();
  if (!configured) return "pinned";
  if (configured === "pinned" || configured === "adaptive") return configured;
  throw new AiTaskRoutingError("AI_ROUTING_CONFIGURATION_INVALID");
}

function getPinnedTaskSettings(task: AiTaskKey, provider: AiProviderId) {
  const temperature = task === "learning_plan_generation" ? 0.2 : 0.25;
  return {
    timeoutMs: task === "learning_plan_generation" ? 30000 : 25000,
    ...(provider !== "gemini" ? { temperature } : {})
  };
}

export async function generateTextForTask(input: {
  db: AiDatabase;
  task: AiTaskKey;
  systemPrompt: string;
  userPrompt: string;
  requestedMaxOutputTokens?: number;
}): Promise<AiTaskTextGenerationResult> {
  const mode = readRoutingMode(input.task);
  const requestedMaxOutputTokens = input.task === "learning_plan_generation"
    ? 2048
    : input.requestedMaxOutputTokens;

  if (mode === "pinned") {
    const [route] = await input.db
      .select({
        provider: aiTaskRoutes.provider,
        model: aiTaskRoutes.model
      })
      .from(aiTaskRoutes)
      .where(eq(aiTaskRoutes.task, input.task))
      .limit(1);

    if (!route) throw new AiTaskRoutingError("AI_ROUTE_NOT_CONFIGURED");

    const result = await generateTextWithProvider({
      provider: route.provider,
      model: route.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      maxOutputTokens: requestedMaxOutputTokens ?? 2048,
      ...getPinnedTaskSettings(input.task, route.provider)
    });

    return {
      ...result,
      routing: {
        mode: "pinned",
        task: input.task,
        policyVersion: null,
        complexityBand: null,
        estimatedInputTokens: null,
        eligibleCandidateCount: null,
        totalTaskCandidates: null,
        selectedModelId: route.model,
        selectedProvider: route.provider,
        administratorPriority: null,
        selectionReason:
          "Adaptive selection is not enabled for this task; Cogniva used the administrator's existing pinned route."
      }
    };
  }

  const assessment = assessAdaptiveRequest({
    task: input.task,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    ...(requestedMaxOutputTokens !== undefined
      ? { requestedMaxOutputTokens }
      : {})
  });

  const rows = await input.db
    .select({
      modelRecordId: aiModels.id,
      provider: aiModels.provider,
      modelId: aiModels.modelId,
      modelStatus: aiModels.status,
      candidateEnabled: aiTaskModelCandidates.isEnabled,
      priority: aiTaskModelCandidates.priority,
      capabilities: aiModels.capabilities,
      capabilityEvidenceUrl: aiModels.capabilityEvidenceUrl,
      capabilitiesVerifiedAt: aiModels.capabilitiesVerifiedAt,
      lastTestStatus: aiModels.lastTestStatus,
      lastTestedAt: aiModels.lastTestedAt,
      lastTestLatencyMs: aiModels.lastTestLatencyMs
    })
    .from(aiTaskModelCandidates)
    .innerJoin(aiModels, eq(aiTaskModelCandidates.modelId, aiModels.id))
    .where(eq(aiTaskModelCandidates.task, input.task))
    .orderBy(asc(aiTaskModelCandidates.priority), asc(aiTaskModelCandidates.createdAt));

  const candidates: AdaptiveModelCandidate[] = rows.map((row) => ({
    ...row,
    credentialConfigured: Boolean(
      process.env[credentialVariables[row.provider]]?.trim()
    )
  }));

  const selection = selectAdaptiveCandidate(candidates, assessment);
  const selected = selection.selected;
  if (!selected) {
    throw new AiTaskRoutingError("AI_ADAPTIVE_MODEL_UNAVAILABLE");
  }

  const settings = buildAdaptiveGenerationSettings({
    task: input.task,
    candidate: selected,
    assessment
  });

  // Exactly one selected model is called. Provider failure never triggers a
  // hidden switch to another candidate or the legacy pinned route.
  const result = await generateTextWithProvider({
    provider: selected.provider,
    model: selected.modelId,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    ...settings
  });

  return {
    ...result,
    routing: {
      mode: "adaptive",
      task: input.task,
      policyVersion: ADAPTIVE_ROUTING_POLICY_VERSION,
      complexityBand: assessment.complexityBand,
      estimatedInputTokens: assessment.estimatedInputTokens,
      eligibleCandidateCount: selection.eligibleCandidateCount,
      totalTaskCandidates: selection.totalCandidateCount,
      selectedModelId: selected.modelId,
      selectedProvider: selected.provider,
      administratorPriority: selected.priority,
      selectionReason: selection.selectionReason ?? "Selected from the verified task candidate pool."
    }
  };
}
