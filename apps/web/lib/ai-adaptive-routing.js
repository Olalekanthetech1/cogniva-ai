export const ADAPTIVE_ROUTING_POLICY_VERSION = "adaptive-routing-1.0.0";

const TUTOR_OUTPUT_BUDGETS = Object.freeze({
  low: 256,
  medium: 640,
  high: 1024
});

const MAX_PLATFORM_OUTPUT_TOKENS = 2048;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function assessAdaptiveRequest(input) {
  if (
    !isRecord(input) ||
    !["learning_plan_generation", "socratic_tutor_response"].includes(input.task) ||
    typeof input.systemPrompt !== "string" ||
    typeof input.userPrompt !== "string"
  ) {
    throw new Error("Adaptive request assessment input is invalid.");
  }

  const requestedOutputTokens = input.task === "learning_plan_generation"
    ? MAX_PLATFORM_OUTPUT_TOKENS
    : input.requestedMaxOutputTokens;

  if (
    !positiveInteger(requestedOutputTokens) ||
    requestedOutputTokens > MAX_PLATFORM_OUTPUT_TOKENS
  ) {
    throw new Error("The requested output-token budget is outside Cogniva's platform ceiling.");
  }

  const promptCharacters = input.systemPrompt.length + input.userPrompt.length;
  // Conservative character-based estimate; this is not a provider tokenizer.
  const estimatedInputTokens = Math.ceil(promptCharacters / 3.5);
  const complexitySignals = [
    /\b(derive|prove|evaluate|calculate|solve|analyse|analyze|compare|contrast)\b/i.test(input.userPrompt),
    /\b(multiple|several|step-by-step|relationship|constraints|prerequisites)\b/i.test(input.userPrompt),
    /(?:\d+\s*[=+*/^−-]\s*\d+|\\(?:sum|int|frac|sqrt)\b)/i.test(input.userPrompt),
    /\b(why|justify|interpret|assumptions|limitations|trade-offs)\b/i.test(input.userPrompt)
  ].filter(Boolean).length;

  let complexityBand = "low";
  if (estimatedInputTokens >= 6000 || complexitySignals >= 4) {
    complexityBand = "high";
  } else if (estimatedInputTokens >= 1600 || complexitySignals >= 2) {
    complexityBand = "medium";
  }

  const outputTokenBudget = input.task === "learning_plan_generation"
    ? MAX_PLATFORM_OUTPUT_TOKENS
    : Math.min(requestedOutputTokens, TUTOR_OUTPUT_BUDGETS[complexityBand]);

  // Reserve 15% for token-estimation error, with a minimum 512-token margin.
  const contextSafetyMargin = Math.max(512, Math.ceil(estimatedInputTokens * 0.15));
  const requiredContextTokens = estimatedInputTokens + contextSafetyMargin + outputTokenBudget;

  return {
    task: input.task,
    complexityBand,
    promptCharacters,
    estimatedInputTokens,
    contextSafetyMargin,
    requiredContextTokens,
    outputTokenBudget,
    structuredOutputRequired: input.task === "learning_plan_generation"
  };
}

function candidateExclusionReason(candidate, assessment) {
  if (candidate.candidateEnabled !== true) return "task_candidate_disabled";
  if (candidate.modelStatus !== "enabled") return "model_not_enabled";
  if (candidate.credentialConfigured !== true) return "provider_credential_missing";
  if (candidate.lastTestStatus !== "connected" || !candidate.lastTestedAt) {
    return "exact_model_test_missing";
  }
  if (
    typeof candidate.capabilityEvidenceUrl !== "string" ||
    !candidate.capabilityEvidenceUrl.startsWith("https://") ||
    !candidate.capabilitiesVerifiedAt
  ) {
    return "capability_evidence_not_reviewed";
  }

  const capabilities = candidate.capabilities;
  if (!isRecord(capabilities)) return "capabilities_unknown";
  if (!Array.isArray(capabilities.inputModalities) || !capabilities.inputModalities.includes("text")) {
    return "text_input_not_verified";
  }
  if (!Array.isArray(capabilities.outputModalities) || !capabilities.outputModalities.includes("text")) {
    return "text_output_not_verified";
  }
  if (!positiveInteger(capabilities.contextWindowTokens)) return "context_window_unknown";
  if (capabilities.contextWindowTokens < assessment.requiredContextTokens) {
    return "context_window_too_small";
  }
  if (!positiveInteger(capabilities.maxOutputTokens)) return "output_limit_unknown";
  if (capabilities.maxOutputTokens < assessment.outputTokenBudget) {
    return "output_limit_too_small";
  }
  if (
    assessment.structuredOutputRequired &&
    !capabilities.structuredOutput === "json_object"
  ) {
    return "json_output_not_verified";
  }

  const reasoning = capabilities.reasoning;
  if (reasoning?.kind === "configurable") {
    const expectedParameter = candidate.provider === "gemini" ? "thinking_level" : "reasoning_effort";
    if (
      reasoning.supported === false ||
      reasoning.parameter !== expectedParameter ||
      !Array.isArray(reasoning.levels) ||
      reasoning.levels.length === 0
    ) {
      return "reasoning_parameter_not_compatible";
    }
  }

  if (!Number.isSafeInteger(candidate.priority) || candidate.priority < 0 || candidate.priority > 10000) {
    return "candidate_priority_invalid";
  }

  return null;
}

export function selectAdaptiveCandidate(candidates, assessment) {
  if (!Array.isArray(candidates) || !isRecord(assessment)) {
    throw new Error("Adaptive candidate selection input is invalid.");
  }

  const eligible = [];
  const exclusionCounts = {};

  for (const candidate of candidates) {
    const reason = candidateExclusionReason(candidate, assessment);
    if (reason) {
      exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    } else {
      eligible.push(candidate);
    }
  }

  eligible.sort((left, right) => {
    const priorityDifference = left.priority - right.priority;
    if (priorityDifference !== 0) return priorityDifference;

    const leftLatency = positiveInteger(left.lastTestLatencyMs) ? left.lastTestLatencyMs : Number.MAX_SAFE_INTEGER;
    const rightLatency = positiveInteger(right.lastTestLatencyMs) ? right.lastTestLatencyMs : Number.MAX_SAFE_INTEGER;
    if (leftLatency !== rightLatency) return leftLatency - rightLatency;

    return left.modelId.localeCompare(right.modelId);
  });

  const selected = eligible[0] ?? null;
  if (!selected) {
    return {
      selected: null,
      eligibleCandidateCount: 0,
      totalCandidateCount: candidates.length,
      exclusionCounts,
      selectionReason: null
    };
  }

  const samePriorityCount = eligible.filter((candidate) => candidate.priority === selected.priority).length;
  const latencyDetail = samePriorityCount > 1
    ? " The latest successful exact-model test latency broke the priority tie."
    : "";

  return {
    selected,
    eligibleCandidateCount: eligible.length,
    totalCandidateCount: candidates.length,
    exclusionCounts,
    selectionReason:
      "Selected the eligible task candidate with the highest administrator priority (" +
      selected.priority +
      ")." +
      latencyDetail +
      " No cost or teaching-quality score was inferred; those signals require reviewed benchmark and pricing evidence."
  };
}

export function buildAdaptiveGenerationSettings(input) {
  if (!isRecord(input) || !isRecord(input.candidate) || !isRecord(input.assessment)) {
    throw new Error("Adaptive generation settings input is invalid.");
  }

  const candidate = input.candidate;
  const assessment = input.assessment;
  const capabilities = candidate.capabilities;
  const baseTimeoutMs = input.task === "learning_plan_generation"
    ? 25000
    : assessment.complexityBand === "high"
      ? 25000
      : assessment.complexityBand === "medium"
        ? 18000
        : 12000;

  const measuredLatencyMs = positiveInteger(candidate.lastTestLatencyMs)
    ? candidate.lastTestLatencyMs
    : 0;
  const latencyAdjustedTimeoutMs = measuredLatencyMs > 0
    ? Math.ceil(measuredLatencyMs * 3 + 2000)
    : baseTimeoutMs;
  const timeoutMs = Math.min(30000, Math.max(baseTimeoutMs, latencyAdjustedTimeoutMs));

  const settings = {
    maxOutputTokens: Math.min(
      assessment.outputTokenBudget,
      capabilities.maxOutputTokens,
      MAX_PLATFORM_OUTPUT_TOKENS
    ),
    timeoutMs
  };

  if (capabilities.temperature === "supported") {
    settings.temperature = input.task === "learning_plan_generation" ? 0.2 : 0.25;
  }

  const reasoning = capabilities.reasoning;
  if (reasoning?.kind === "configurable" && reasoning.supported !== false) {
    const levels = reasoning.levels;
    const index = assessment.complexityBand === "high"
      ? levels.length - 1
      : assessment.complexityBand === "medium"
        ? Math.floor((levels.length - 1) / 2)
        : 0;
    settings.reasoningControl = {
      parameter: reasoning.parameter,
      level: levels[index]
    };
  }

  if (assessment.structuredOutputRequired) {
    settings.structuredOutput = "json_object";
  }

  return settings;
}
