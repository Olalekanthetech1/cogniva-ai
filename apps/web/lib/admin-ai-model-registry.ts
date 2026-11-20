import { and, asc, eq } from "drizzle-orm";
import {
  adminAuditEvents,
  aiModels,
  aiProviderValues,
  aiTaskKeyValues,
  aiTaskModelCandidates
} from "@cogniva/database";
import type { AiModelCapabilities } from "@cogniva/database";
import {
  validateCapabilityEvidenceUrl,
  validateModelCapabilities
} from "@/lib/ai-model-capabilities";
import { getStudentDatabase } from "@/lib/student-data";
import type { AiProviderId, AiTaskKey } from "@/lib/admin-ai-config";

const providerDetails: Record<AiProviderId, { label: string; credentialVariable: string }> = {
  gemini: { label: "Google Gemini", credentialVariable: "GEMINI_API_KEY" },
  groq: { label: "Groq", credentialVariable: "GROQ_API_KEY" },
  mistral: { label: "Mistral", credentialVariable: "MISTRAL_API_KEY" }
};

export type AdminAiModelInput = {
  provider: AiProviderId;
  modelId: string;
  displayName: string;
  capabilities: AiModelCapabilities;
  capabilityEvidenceUrl: string | null;
  initialTasks: AiTaskKey[];
};

function assertSafeIdentity(input: { provider: unknown; modelId: unknown; displayName: unknown }): asserts input is {
  provider: AiProviderId; modelId: string; displayName: string;
} {
  if (typeof input.provider !== "string" || !aiProviderValues.includes(input.provider as AiProviderId)) {
    throw new Error("Choose a supported provider.");
  }
  if (typeof input.modelId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(input.modelId.trim())) {
    throw new Error("Enter the exact provider model ID.");
  }
  if (typeof input.displayName !== "string" || input.displayName.trim().length < 1 || input.displayName.trim().length > 160) {
    throw new Error("Display name must contain 1 to 160 characters.");
  }
}

export async function getAdminAiModelRegistry() {
  const db = getStudentDatabase();
  const [models, candidates] = await Promise.all([
    db.select().from(aiModels).orderBy(asc(aiModels.provider), asc(aiModels.displayName)),
    db.select().from(aiTaskModelCandidates).orderBy(asc(aiTaskModelCandidates.task), asc(aiTaskModelCandidates.priority))
  ]);
  const byModel = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const list = byModel.get(candidate.modelId) ?? [];
    list.push(candidate);
    byModel.set(candidate.modelId, list);
  }

  return {
    providers: aiProviderValues.map((id) => ({
      id,
      label: providerDetails[id].label,
      credentialVariable: providerDetails[id].credentialVariable,
      credentialConfigured: Boolean(process.env[providerDetails[id].credentialVariable]?.trim())
    })),
    tasks: aiTaskKeyValues.map((id) => ({ id, label: id === "learning_plan_generation" ? "Learning plan generation" : "Socratic tutor response" })),
    models: models.map((model) => ({
      id: model.id,
      provider: model.provider,
      modelId: model.modelId,
      displayName: model.displayName,
      status: model.status,
      capabilities: model.capabilities,
      capabilityEvidenceUrl: model.capabilityEvidenceUrl,
      capabilitiesVerifiedAt: model.capabilitiesVerifiedAt?.toISOString() ?? null,
      lastTestStatus: model.lastTestStatus,
      lastTestedAt: model.lastTestedAt?.toISOString() ?? null,
      lastTestLatencyMs: model.lastTestLatencyMs,
      lastTestErrorCode: model.lastTestErrorCode,
      candidates: (byModel.get(model.id) ?? []).map((candidate) => ({
        task: candidate.task,
        isEnabled: candidate.isEnabled,
        priority: candidate.priority
      }))
    }))
  };
}

export async function registerAdminAiModel(input: unknown, adminUserId: string) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Request must be a JSON object.");
  const value = input as Record<string, unknown>;
  const identity = { provider: value.provider, modelId: value.modelId, displayName: value.displayName };
  assertSafeIdentity(identity);
  if (Object.keys(value).some((key) => !["provider","modelId","displayName","capabilities","capabilityEvidenceUrl","initialTasks"].includes(key))) {
    throw new Error("Request contains unsupported fields.");
  }
  const capabilities = validateModelCapabilities(value.capabilities ?? {});
  const evidenceUrl = validateCapabilityEvidenceUrl(value.capabilityEvidenceUrl);
  const tasks = value.initialTasks ?? [];
  if (!Array.isArray(tasks) || tasks.some((task) => typeof task !== "string" || !aiTaskKeyValues.includes(task as AiTaskKey))) {
    throw new Error("initialTasks contains an unsupported task.");
  }
  if (new Set(tasks).size !== tasks.length) throw new Error("initialTasks cannot contain duplicate task assignments.");
  const db = getStudentDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(aiModels).values({
      provider: identity.provider,
      modelId: identity.modelId.trim(),
      displayName: identity.displayName.trim(),
      status: "pending",
      capabilities,
      capabilityEvidenceUrl: evidenceUrl,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      createdAt: now,
      updatedAt: now
    }).returning({ id: aiModels.id });
    if (!created) throw new Error("Model registration was not saved.");
    if (tasks.length) {
      await tx.insert(aiTaskModelCandidates).values((tasks as AiTaskKey[]).map((task) => ({
        task, modelId: created.id, isEnabled: false, priority: 100,
        createdBy: adminUserId, updatedBy: adminUserId, createdAt: now, updatedAt: now
      })));
    }
    await tx.insert(adminAuditEvents).values({
      actorUserId: adminUserId,
      action: "ai.model.registered",
      resourceType: "ai_model",
      resourceId: created.id,
      metadata: { provider: identity.provider, model: identity.modelId.trim(), status: "pending" },
      createdAt: now
    });
  });
  return getAdminAiModelRegistry();
}

export async function updateAdminAiModel(modelId: string, input: unknown, adminUserId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(modelId)) throw new Error("Model ID is invalid.");
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Request must be a JSON object.");
  const value = input as Record<string, unknown>;
  const allowed = new Set(["status","capabilities","capabilityEvidenceUrl","verifyCapabilities","assignments"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Request contains unsupported fields.");
  if (value.verifyCapabilities !== undefined && typeof value.verifyCapabilities !== "boolean") {
    throw new Error("verifyCapabilities must be a boolean.");
  }

  const db = getStudentDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [model] = await tx.select().from(aiModels).where(eq(aiModels.id, modelId)).limit(1);
    if (!model) throw new Error("MODEL_NOT_FOUND");

    const requestedStatus = value.status ?? model.status;
    if (!["pending","enabled","disabled"].includes(String(requestedStatus))) throw new Error("Model status is invalid.");

    const capabilities = value.capabilities === undefined ? model.capabilities : validateModelCapabilities(value.capabilities);
    const evidenceUrl = value.capabilityEvidenceUrl === undefined
      ? model.capabilityEvidenceUrl
      : validateCapabilityEvidenceUrl(value.capabilityEvidenceUrl);
    const verifyCapabilities = value.verifyCapabilities === true;
    if (verifyCapabilities && !evidenceUrl) throw new Error("Provide an HTTPS capability evidence URL before verifying capabilities.");
    const capabilityClaimsChanged = value.capabilities !== undefined || value.capabilityEvidenceUrl !== undefined;
    const verifiedAt = verifyCapabilities ? now : capabilityClaimsChanged ? null : model.capabilitiesVerifiedAt;
    const verifiedBy = verifyCapabilities ? adminUserId : capabilityClaimsChanged ? null : model.capabilitiesVerifiedBy;
    const status = capabilityClaimsChanged && !verifyCapabilities ? "pending" : requestedStatus;

    if (status === "enabled" && (
      model.lastTestStatus !== "connected" ||
      !evidenceUrl ||
      !verifiedAt
    )) {
      throw new Error("A model must pass its exact-model connection test and have reviewed capability evidence before it can be enabled.");
    }

    await tx.update(aiModels).set({
      status: status as "pending" | "enabled" | "disabled",
      capabilities,
      capabilityEvidenceUrl: evidenceUrl,
      capabilitiesVerifiedAt: verifiedAt,
      capabilitiesVerifiedBy: verifiedBy,
      ...(capabilityClaimsChanged
        ? {
            lastTestStatus: null,
            lastTestedAt: null,
            lastTestLatencyMs: null,
            lastTestErrorCode: null
          }
        : {}),
      updatedBy: adminUserId,
      updatedAt: now
    }).where(eq(aiModels.id, modelId));

    if (status !== "enabled") {
      await tx.update(aiTaskModelCandidates).set({
        isEnabled: false, updatedBy: adminUserId, updatedAt: now
      }).where(eq(aiTaskModelCandidates.modelId, modelId));
    }

    if (value.assignments !== undefined) {
      if (!Array.isArray(value.assignments) || value.assignments.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
        throw new Error("assignments must be an array of task eligibility objects.");
      }
      const existingTasks = new Set<AiTaskKey>();
      for (const raw of value.assignments as Array<Record<string, unknown>>) {
        if (Object.keys(raw).some((key) => !["task", "isEnabled", "priority"].includes(key))) {
          throw new Error("Task assignment contains an unsupported field.");
        }
        if (typeof raw.task !== "string" || !aiTaskKeyValues.includes(raw.task as AiTaskKey) || typeof raw.isEnabled !== "boolean") {
          throw new Error("Each task assignment requires a supported task and boolean isEnabled value.");
        }
        const task = raw.task as AiTaskKey;
        if (existingTasks.has(task)) throw new Error("A task may appear only once in assignments.");
        existingTasks.add(task);
        const priority = raw.priority ?? 100;
        if (!Number.isInteger(priority) || (priority as number) < 0 || (priority as number) > 10000) {
          throw new Error("Task assignment priority must be an integer between 0 and 10000.");
        }
        if (raw.isEnabled && status !== "enabled") throw new Error("Only enabled, verified models can be enabled for a task.");
        const [existing] = await tx.select({ id: aiTaskModelCandidates.id }).from(aiTaskModelCandidates)
          .where(and(eq(aiTaskModelCandidates.task, task), eq(aiTaskModelCandidates.modelId, modelId))).limit(1);
        if (existing) {
          await tx.update(aiTaskModelCandidates).set({
            isEnabled: raw.isEnabled, priority: priority as number,
            updatedBy: adminUserId, updatedAt: now
          }).where(eq(aiTaskModelCandidates.id, existing.id));
        } else {
          await tx.insert(aiTaskModelCandidates).values({
            task, modelId, isEnabled: raw.isEnabled, priority: priority as number,
            createdBy: adminUserId, updatedBy: adminUserId, createdAt: now, updatedAt: now
          });
        }
      }
    }

    await tx.insert(adminAuditEvents).values({
      actorUserId: adminUserId,
      action: "ai.model.updated",
      resourceType: "ai_model",
      resourceId: modelId,
      metadata: { status: String(status), capabilitiesVerified: verifyCapabilities },
      createdAt: now
    });
  });
  return getAdminAiModelRegistry();
}

export async function recordAdminAiModelTest(
  modelId: string,
  result: { status: "connected" | "failed"; latencyMs: number | null; errorCode: string | null },
  adminUserId: string
) {
  const db = getStudentDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [model] = await tx.select({ id: aiModels.id }).from(aiModels).where(eq(aiModels.id, modelId)).limit(1);
    if (!model) throw new Error("MODEL_NOT_FOUND");
    await tx.update(aiModels).set({
      lastTestStatus: result.status,
      lastTestedAt: now,
      lastTestLatencyMs: result.latencyMs,
      lastTestErrorCode: result.errorCode,
      ...(result.status === "failed" ? { status: "pending" as const } : {}),
      updatedBy: adminUserId,
      updatedAt: now
    }).where(eq(aiModels.id, modelId));
    if (result.status === "failed") {
      await tx.update(aiTaskModelCandidates).set({
        isEnabled: false, updatedBy: adminUserId, updatedAt: now
      }).where(eq(aiTaskModelCandidates.modelId, modelId));
    }
    await tx.insert(adminAuditEvents).values({
      actorUserId: adminUserId,
      action: result.status === "connected" ? "ai.model.connection_test_succeeded" : "ai.model.connection_test_failed",
      resourceType: "ai_model",
      resourceId: modelId,
      metadata: {
        status: result.status,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode
      },
      createdAt: now
    });
  });
}

export async function getAdminAiModelForTest(modelId: string) {
  const db = getStudentDatabase();
  const [model] = await db.select().from(aiModels).where(eq(aiModels.id, modelId)).limit(1);
  return model ?? null;
}

export type DiscoveredProviderModel = {
  provider: AiProviderId;
  modelId: string;
  displayName: string;
  capabilities: AiModelCapabilities;
  evidenceUrl: string;
  discoveryNotes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchProviderJson(
  provider: AiProviderId,
  url: string,
  apiKey: string
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (provider === "gemini") headers["x-goog-api-key"] = apiKey;
    else headers.Authorization = "Bearer " + apiKey;
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403
        ? "The provider rejected its configured credential."
        : response.status === 429
          ? "The provider model-list rate limit was reached."
          : "The provider model list is currently unavailable.");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Provider model discovery timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverAdminAiProviderModels(provider: AiProviderId): Promise<{
  provider: AiProviderId;
  models: DiscoveredProviderModel[];
  warnings: string[];
}> {
  const credentialVariable = providerDetails[provider].credentialVariable;
  const apiKey = process.env[credentialVariable]?.trim();
  if (!apiKey) throw new Error("The " + credentialVariable + " server credential is missing.");

  const models: DiscoveredProviderModel[] = [];
  const warnings: string[] = [];

  if (provider === "gemini") {
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const query = new URLSearchParams({ pageSize: "100" });
      if (pageToken) query.set("pageToken", pageToken);
      const body = await fetchProviderJson(
        provider,
        "https://generativelanguage.googleapis.com/v1beta/models?" + query.toString(),
        apiKey
      );
      if (!isRecord(body) || !Array.isArray(body.models)) {
        throw new Error("Gemini returned an unexpected model-list response.");
      }
      for (const item of body.models) {
        if (!isRecord(item) || typeof item.name !== "string") continue;
        const supported = Array.isArray(item.supportedGenerationMethods)
          ? item.supportedGenerationMethods
          : [];
        if (!supported.includes("generateContent")) continue;
        const modelId = item.name.replace(/^models\//, "");
        if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(modelId)) continue;
        const inputLimit = typeof item.inputTokenLimit === "number" && Number.isSafeInteger(item.inputTokenLimit) && item.inputTokenLimit > 0
          ? item.inputTokenLimit : null;
        const outputLimit = typeof item.outputTokenLimit === "number" && Number.isSafeInteger(item.outputTokenLimit) && item.outputTokenLimit > 0
          ? item.outputTokenLimit : null;
        models.push({
          provider,
          modelId,
          displayName: typeof item.displayName === "string" && item.displayName.trim() ? item.displayName : modelId,
          evidenceUrl: "https://ai.google.dev/api/models",
          capabilities: {
            structuredOutput: "unknown",
            ...(inputLimit ? { contextWindowTokens: inputLimit } : {}),
            ...(outputLimit ? { maxOutputTokens: outputLimit } : {}),
            reasoning: {
              kind: "unknown",
              parameter: null,
              levels: [],
              ...(typeof item.thinking === "boolean" ? { supported: item.thinking } : {})
            },
            temperature: "unknown"
          },
          discoveryNotes: [
            "Gemini discovery reports token limits and supported generation methods when supplied.",
            "The model-list response does not prove project-level generation access or current lifecycle status; test the exact model."
          ]
        });
      }
      pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : undefined;
      if (!pageToken) break;
    }
    if (pageToken) warnings.push("Discovery stopped after five provider pages; more Gemini models may be available.");
  } else if (provider === "groq") {
    const body = await fetchProviderJson(
      provider,
      "https://api.groq.com/openai/v1/models",
      apiKey
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
      throw new Error("Groq returned an unexpected model-list response.");
    }
    for (const item of body.data) {
      if (!isRecord(item) || typeof item.id !== "string" || item.active === false) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(item.id)) continue;
      const context = typeof item.context_window === "number" && Number.isSafeInteger(item.context_window) && item.context_window > 0 ? item.context_window : null;
      const output = typeof item.max_completion_tokens === "number" && Number.isSafeInteger(item.max_completion_tokens) && item.max_completion_tokens > 0 ? item.max_completion_tokens : null;
      models.push({
        provider,
        modelId: item.id,
        displayName: item.id,
        evidenceUrl: "https://console.groq.com/docs/models",
        capabilities: {
          structuredOutput: "unknown",
          ...(context ? { contextWindowTokens: context } : {}),
          ...(output ? { maxOutputTokens: output } : {}),
          reasoning: { kind: "unknown", parameter: null, levels: [] },
          temperature: "unknown"
        },
        discoveryNotes: [
          "Groq model discovery reports model IDs and some context/output limits.",
          "The list does not assert that every returned model supports chat completions or the same reasoning controls; test the exact model and review its model-specific documentation."
        ]
      });
    }
  } else {
    const body = await fetchProviderJson(
      provider,
      "https://api.mistral.ai/v1/models",
      apiKey
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
      throw new Error("Mistral returned an unexpected model-list response.");
    }
    for (const item of body.data) {
      if (!isRecord(item) || typeof item.id !== "string" || item.archived === true) continue;
      const caps = isRecord(item.capabilities) ? item.capabilities : {};
      if (caps.completion_chat !== true) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(item.id)) continue;
      const context = typeof item.max_context_length === "number" && Number.isSafeInteger(item.max_context_length) && item.max_context_length > 0 ? item.max_context_length : null;
      models.push({
        provider,
        modelId: item.id,
        displayName: item.id,
        evidenceUrl: "https://docs.mistral.ai/api/endpoint/models",
        capabilities: {
          inputModalities: caps.vision === true ? ["text", "image"] : ["text"],
          outputModalities: ["text"],
          structuredOutput: "unknown",
          ...(context ? { contextWindowTokens: context } : {}),
          reasoning: { kind: "unknown", parameter: null, levels: [] },
          temperature: "unknown"
        },
        discoveryNotes: [
          "Mistral's model-list capability flag confirms chat completion availability; context length is included when supplied.",
          "Reasoning, structured-output and output-token limits require model-specific documentation review."
        ]
      });
    }
  }

  return {
    provider,
    models,
    warnings: [
      ...warnings,
      "Discovery is an inventory hint, not an enablement decision. All discovered models remain unregistered until an administrator selects, tests and reviews them."
    ]
  };
}

export async function getAdminAiModelByRoute(provider: AiProviderId, modelId: string) {
  const db = getStudentDatabase();
  const [model] = await db.select().from(aiModels)
    .where(and(eq(aiModels.provider, provider), eq(aiModels.modelId, modelId)))
    .limit(1);
  return model ?? null;
}
