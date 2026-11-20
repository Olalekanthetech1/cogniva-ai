import { asc, eq } from "drizzle-orm";
import {
  aiModels,
  aiTaskModelCandidates,
  aiTaskRoutes,
  aiTaskRoutingSettings
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
        "The stored task routing mode or emergency pinned override is invalid. Review the administrator routing settings and AI_ROUTING_FORCE_PINNED value."
    };
    super(messages[code]);
    this.name = "AiTaskRoutingError";
  }
}

async function readRoutingMode(
  db: AiDatabase,
  task: AiTaskKey
): Promise<AiTaskRoutingMode> {
  const emergencyOverride = process.env.AI_ROUTING_FORCE_PINNED?.trim().toLowerCase();
  if (emergencyOverride === "true") return "pinned";
  if (emergencyOverride && emergencyOverride !== "false") {
    throw new AiTaskRoutingError("AI_ROUTING_CONFIGURATION_INVALID");
  }

  const [setting] = await db
    .select({ mode: aiTaskRoutingSettings.mode })
    .from(aiTaskRoutingSettings)
    .where(eq(aiTaskRoutingSettings.task, task))
    .limit(1);

  // Missing settings are fail-safe: the legacy pinned route remains in control.
  return setting?.mode ?? "pinned";
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
  const mode = await readRoutingMode(input.db, input.task);
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
