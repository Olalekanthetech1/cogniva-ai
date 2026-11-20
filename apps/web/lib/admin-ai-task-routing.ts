import { asc, eq } from "drizzle-orm";
import {
  adminAuditEvents,
  aiModels,
  aiTaskModelCandidates,
  aiTaskRoutingSettings,
  aiTaskKeyValues
} from "@cogniva/database";
import type { AiTaskKey } from "@/lib/admin-ai-config";
import type { AiTaskRoutingMode } from "@/lib/ai-task-runtime";
import type { AdaptiveModelCandidate } from "@/lib/ai-adaptive-routing";
import {
  assessAdaptiveTaskReadiness,
  selectAdaptiveCandidate
} from "@/lib/ai-adaptive-routing";
import { getStudentDatabase } from "@/lib/student-data";

const credentialVariables = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY"
} as const;

const taskLabels: Record<AiTaskKey, string> = {
  learning_plan_generation: "Learning plan generation",
  socratic_tutor_response: "Socratic tutor response"
};

export type AiTaskRoutingReadiness = {
  ready: boolean;
  eligibleCandidateCount: number;
  totalCandidateCount: number;
  exclusionCounts: Record<string, number>;
  selectedCandidate: {
    provider: AdaptiveModelCandidate["provider"];
    modelId: string;
    priority: number;
    lastTestLatencyMs: number | null;
  } | null;
  message: string;
};

export type AdminAiTaskRoutingSnapshot = {
  emergencyPinned: boolean;
  tasks: Array<{
    id: AiTaskKey;
    label: string;
    mode: AiTaskRoutingMode;
    updatedAt: string;
    readiness: AiTaskRoutingReadiness;
  }>;
};

export class AdaptiveRoutingNotReadyError extends Error {
  constructor(readonly readiness: AiTaskRoutingReadiness) {
    super(
      "Adaptive routing cannot be enabled until at least one candidate for this task is enabled, tested, capability-reviewed, credential-ready, and large enough for the task's readiness budget."
    );
    this.name = "AdaptiveRoutingNotReadyError";
  }
}

export class AdaptiveRoutingEmergencyOverrideError extends Error {
  constructor() {
    super("AI_ROUTING_FORCE_PINNED is active. Clear the emergency pinned override before enabling adaptive routing.");
    this.name = "AdaptiveRoutingEmergencyOverrideError";
  }
}


function assessTaskReadiness(
  task: AiTaskKey,
  candidates: AdaptiveModelCandidate[]
): AiTaskRoutingReadiness {
  const assessment = assessAdaptiveTaskReadiness(task);
  const selection = selectAdaptiveCandidate(candidates, assessment);
  const selected = selection.selected;

  return {
    ready: selected !== null,
    eligibleCandidateCount: selection.eligibleCandidateCount,
    totalCandidateCount: selection.totalCandidateCount,
    exclusionCounts: selection.exclusionCounts,
    selectedCandidate: selected
      ? {
          provider: selected.provider,
          modelId: selected.modelId,
          priority: selected.priority,
          lastTestLatencyMs: selected.lastTestLatencyMs
        }
      : null,
    message: selected
      ? "At least one currently eligible candidate satisfies this task's rollout-readiness budget. Each learner request is checked again against its actual prompt."
      : "No candidate currently satisfies all task readiness requirements. Review model status, task assignment, exact-model test, capability evidence, provider credential, context window, and output limit."
  };
}

export async function getAdminAiTaskRoutingSettings(): Promise<AdminAiTaskRoutingSnapshot> {
  const db = getStudentDatabase();
  const [settings, candidateRows] = await Promise.all([
    db.select().from(aiTaskRoutingSettings),
    db
      .select({
        task: aiTaskModelCandidates.task,
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
      .orderBy(asc(aiTaskModelCandidates.task), asc(aiTaskModelCandidates.priority))
  ]);

  const settingByTask = new Map(settings.map((setting) => [setting.task, setting]));
  const candidatesByTask = new Map<AiTaskKey, AdaptiveModelCandidate[]>();

  for (const row of candidateRows) {
    const list = candidatesByTask.get(row.task) ?? [];
    list.push({
      modelRecordId: row.modelRecordId,
      provider: row.provider,
      modelId: row.modelId,
      modelStatus: row.modelStatus,
      candidateEnabled: row.candidateEnabled,
      priority: row.priority,
      capabilities: row.capabilities,
      capabilityEvidenceUrl: row.capabilityEvidenceUrl,
      capabilitiesVerifiedAt: row.capabilitiesVerifiedAt,
      lastTestStatus: row.lastTestStatus,
      lastTestedAt: row.lastTestedAt,
      lastTestLatencyMs: row.lastTestLatencyMs,
      credentialConfigured: Boolean(
        process.env[credentialVariables[row.provider]]?.trim()
      )
    });
    candidatesByTask.set(row.task, list);
  }

  const emergencyValue = process.env.AI_ROUTING_FORCE_PINNED?.trim().toLowerCase();
  if (emergencyValue && emergencyValue !== "true" && emergencyValue !== "false") {
    throw new Error("AI_ROUTING_FORCE_PINNED_INVALID");
  }
  const emergencyPinned = emergencyValue === "true";

  return {
    emergencyPinned,
    tasks: aiTaskKeyValues.map((task) => {
      const setting = settingByTask.get(task);
      if (!setting) {
        throw new Error("AI_TASK_ROUTING_SETTING_MISSING:" + task);
      }
      return {
        id: task,
        label: taskLabels[task],
        mode: setting.mode,
        updatedAt: setting.updatedAt.toISOString(),
        readiness: assessTaskReadiness(task, candidatesByTask.get(task) ?? [])
      };
    })
  };
}

export async function updateAdminAiTaskRoutingMode(input: {
  task: AiTaskKey;
  mode: AiTaskRoutingMode;
  adminUserId: string;
}): Promise<AdminAiTaskRoutingSnapshot> {
  const snapshot = await getAdminAiTaskRoutingSettings();
  const taskSetting = snapshot.tasks.find((task) => task.id === input.task);
  if (!taskSetting) throw new Error("AI_TASK_ROUTING_SETTING_MISSING:" + input.task);

  if (input.mode === "adaptive" && process.env.AI_ROUTING_FORCE_PINNED?.trim().toLowerCase() === "true") {
    throw new AdaptiveRoutingEmergencyOverrideError();
  }
  if (input.mode === "adaptive" && !taskSetting.readiness.ready) {
    throw new AdaptiveRoutingNotReadyError(taskSetting.readiness);
  }

  const db = getStudentDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        mode: aiTaskRoutingSettings.mode
      })
      .from(aiTaskRoutingSettings)
      .where(eq(aiTaskRoutingSettings.task, input.task))
      .limit(1);

    if (!current) throw new Error("AI_TASK_ROUTING_SETTING_MISSING:" + input.task);
    if (current.mode === input.mode) return;

    await tx
      .update(aiTaskRoutingSettings)
      .set({
        mode: input.mode,
        updatedBy: input.adminUserId,
        updatedAt: now
      })
      .where(eq(aiTaskRoutingSettings.task, input.task));

    await tx.insert(adminAuditEvents).values({
      actorUserId: input.adminUserId,
      action: "ai.task_routing_mode.updated",
      resourceType: "ai_task_routing_setting",
      resourceId: input.task,
      metadata: {
        task: input.task,
        previousMode: current.mode,
        mode: input.mode,
        eligibleCandidateCount: taskSetting.readiness.eligibleCandidateCount,
        totalCandidateCount: taskSetting.readiness.totalCandidateCount
      },
      createdAt: now
    });
  });

  return getAdminAiTaskRoutingSettings();
}
