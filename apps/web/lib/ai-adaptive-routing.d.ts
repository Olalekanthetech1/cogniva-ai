import type { AiProviderId, AiTaskKey } from "@/lib/admin-ai-config";
import type { AiModelCapabilities } from "@cogniva/database";

export const ADAPTIVE_ROUTING_POLICY_VERSION: "adaptive-routing-1.0.0";

export type AdaptiveComplexityBand = "low" | "medium" | "high";

export type AdaptiveRequestAssessment = {
  task: AiTaskKey;
  complexityBand: AdaptiveComplexityBand;
  promptCharacters: number;
  estimatedInputTokens: number;
  contextSafetyMargin: number;
  requiredContextTokens: number;
  outputTokenBudget: number;
  structuredOutputRequired: boolean;
};

export type AdaptiveModelCandidate = {
  modelRecordId: string;
  provider: AiProviderId;
  modelId: string;
  modelStatus: string;
  candidateEnabled: boolean;
  priority: number;
  capabilities: AiModelCapabilities;
  capabilityEvidenceUrl: string | null;
  capabilitiesVerifiedAt: Date | string | null;
  lastTestStatus: string | null;
  lastTestedAt: Date | string | null;
  lastTestLatencyMs: number | null;
  credentialConfigured: boolean;
};

export type AdaptiveCandidateSelection = {
  selected: AdaptiveModelCandidate | null;
  eligibleCandidateCount: number;
  totalCandidateCount: number;
  exclusionCounts: Record<string, number>;
  selectionReason: string | null;
};

export function assessAdaptiveRequest(input: {
  task: AiTaskKey;
  systemPrompt: string;
  userPrompt: string;
  requestedMaxOutputTokens?: number;
}): AdaptiveRequestAssessment;

export function selectAdaptiveCandidate(
  candidates: AdaptiveModelCandidate[],
  assessment: AdaptiveRequestAssessment
): AdaptiveCandidateSelection;

export function buildAdaptiveGenerationSettings(input: {
  task: AiTaskKey;
  candidate: AdaptiveModelCandidate;
  assessment: AdaptiveRequestAssessment;
}): {
  maxOutputTokens: number;
  timeoutMs: number;
  temperature?: number;
  reasoningControl?: {
    parameter: "thinking_level" | "reasoning_effort";
    level: string;
  };
  structuredOutput?: "json_object";
};

export function assessAdaptiveTaskReadiness(
  task: AiTaskKey
): AdaptiveRequestAssessment;
