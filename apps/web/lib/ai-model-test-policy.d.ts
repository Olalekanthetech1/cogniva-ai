import type { AiModelCapabilities } from "@cogniva/database";
import type { AiProviderId } from "@/lib/admin-ai-config";

export type AiModelProbeInput = {
  provider: AiProviderId;
  capabilities: AiModelCapabilities;
  lastTestLatencyMs: number | null;
};

export type AiModelProbePolicy = {
  maxOutputTokens: number;
  timeoutMs: number;
  temperature?: number;
  reasoningControl?: {
    parameter: "thinking_level" | "reasoning_effort";
    level: string;
  };
};

export function resolveAiModelProbePolicy(model: AiModelProbeInput): AiModelProbePolicy;
