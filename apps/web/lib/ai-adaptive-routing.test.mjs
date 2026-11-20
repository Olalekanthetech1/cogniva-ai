import assert from "node:assert/strict";
import test from "node:test";
import {
  assessAdaptiveRequest,
  assessAdaptiveTaskReadiness,
  buildAdaptiveGenerationSettings,
  selectAdaptiveCandidate
} from "./ai-adaptive-routing.js";

function candidate(overrides = {}) {
  return {
    modelRecordId: "model-record-1",
    provider: "gemini",
    modelId: "gemini-reviewed-model",
    modelStatus: "enabled",
    candidateEnabled: true,
    priority: 100,
    capabilities: {
      inputModalities: ["text"],
      outputModalities: ["text"],
      structuredOutput: "json_object",
      contextWindowTokens: 32000,
      maxOutputTokens: 2048,
      reasoning: {
        kind: "configurable",
        parameter: "thinking_level",
        levels: ["LOW", "MEDIUM", "HIGH"],
        supported: true
      },
      temperature: "supported"
    },
    capabilityEvidenceUrl: "https://provider.example/model",
    capabilitiesVerifiedAt: new Date("2026-11-20T00:00:00Z"),
    lastTestStatus: "connected",
    lastTestedAt: new Date("2026-11-20T00:00:00Z"),
    lastTestLatencyMs: 500,
    credentialConfigured: true,
    ...overrides
  };
}

test("request assessment is deterministic and applies platform output ceilings", () => {
  const first = assessAdaptiveRequest({
    task: "socratic_tutor_response",
    systemPrompt: "You are a tutor.",
    userPrompt: "Explain a simple definition.",
    requestedMaxOutputTokens: 1100
  });
  const second = assessAdaptiveRequest({
    task: "socratic_tutor_response",
    systemPrompt: "You are a tutor.",
    userPrompt: "Explain a simple definition.",
    requestedMaxOutputTokens: 1100
  });

  assert.deepEqual(first, second);
  assert.equal(first.complexityBand, "low");
  assert.equal(first.outputTokenBudget, 256);
  assert.ok(first.requiredContextTokens > first.estimatedInputTokens);
});

test("structured learning-plan requests require exact JSON-object capability, not schema-only capability", () => {
  const assessment = assessAdaptiveRequest({
    task: "learning_plan_generation",
    systemPrompt: "Return a structured learning plan.",
    userPrompt: "Topic: fluid mechanics."
  });

  assert.equal(assessment.outputTokenBudget, 2048);
  assert.equal(assessment.structuredOutputRequired, true);

  const unsupported = candidate({
    capabilities: {
      inputModalities: ["text"],
      outputModalities: ["text"],
      structuredOutput: "json_schema",
      contextWindowTokens: 32000,
      maxOutputTokens: 4096
    }
  });
  const selection = selectAdaptiveCandidate([unsupported], assessment);

  assert.equal(selection.selected, null);
  assert.equal(selection.exclusionCounts.json_output_not_verified, 1);
});

test("selection excludes disabled, untested, unreviewed, credentialless, and undersized models", () => {
  const assessment = assessAdaptiveRequest({
    task: "socratic_tutor_response",
    systemPrompt: "Tutor rules.",
    userPrompt: "Explain Newton's second law.",
    requestedMaxOutputTokens: 700
  });
  const rows = [
    candidate({ modelRecordId: "disabled", candidateEnabled: false }),
    candidate({ modelRecordId: "not-enabled", modelStatus: "pending" }),
    candidate({ modelRecordId: "credentialless", credentialConfigured: false }),
    candidate({ modelRecordId: "untested", lastTestStatus: "failed" }),
    candidate({ modelRecordId: "unreviewed", capabilitiesVerifiedAt: null }),
    candidate({
      modelRecordId: "small-context",
      capabilities: { ...candidate().capabilities, contextWindowTokens: 10 }
    }),
    candidate({
      modelRecordId: "small-output",
      capabilities: { ...candidate().capabilities, maxOutputTokens: 100 }
    })
  ];
  const selection = selectAdaptiveCandidate(rows, assessment);

  assert.equal(selection.selected, null);
  assert.equal(selection.totalCandidateCount, 7);
  assert.equal(selection.eligibleCandidateCount, 0);
  assert.equal(selection.exclusionCounts.task_candidate_disabled, 1);
  assert.equal(selection.exclusionCounts.model_not_enabled, 1);
  assert.equal(selection.exclusionCounts.provider_credential_missing, 1);
  assert.equal(selection.exclusionCounts.exact_model_test_missing, 1);
  assert.equal(selection.exclusionCounts.capability_evidence_not_reviewed, 1);
  assert.equal(selection.exclusionCounts.context_window_too_small, 1);
  assert.equal(selection.exclusionCounts.output_limit_too_small, 1);
});

test("lowest numeric administrator priority wins; measured test latency breaks ties", () => {
  const assessment = assessAdaptiveRequest({
    task: "socratic_tutor_response",
    systemPrompt: "Tutor rules.",
    userPrompt: "Explain momentum.",
    requestedMaxOutputTokens: 240
  });
  const rows = [
    candidate({ modelRecordId: "priority-20", modelId: "model-c", priority: 20, lastTestLatencyMs: 100 }),
    candidate({ modelRecordId: "priority-10-slow", modelId: "model-b", priority: 10, lastTestLatencyMs: 900 }),
    candidate({ modelRecordId: "priority-10-fast", modelId: "model-a", priority: 10, lastTestLatencyMs: 300 })
  ];
  const selection = selectAdaptiveCandidate(rows, assessment);

  assert.equal(selection.selected.modelId, "model-a");
  assert.equal(selection.eligibleCandidateCount, 3);
  assert.match(selection.selectionReason, /administrator priority \(10\)/);
  assert.match(selection.selectionReason, /latency broke the priority tie/);
  assert.match(selection.selectionReason, /No cost or teaching-quality score was inferred/);
});

test("provider reasoning controls are emitted only for explicitly compatible capabilities", () => {
  const assessment = assessAdaptiveRequest({
    task: "socratic_tutor_response",
    systemPrompt: "Tutor rules.",
    userPrompt: "Derive and compare multiple prerequisites, solve 2=2, and justify the result.",
    requestedMaxOutputTokens: 1100
  });
  const gemini = candidate();
  const settings = buildAdaptiveGenerationSettings({
    task: "socratic_tutor_response",
    candidate: gemini,
    assessment
  });

  assert.equal(settings.reasoningControl.parameter, "thinking_level");
  assert.equal(settings.reasoningControl.level, "HIGH");
  assert.equal(settings.temperature, 0.25);
  assert.ok(settings.timeoutMs >= 12000 && settings.timeoutMs <= 30000);

  const groq = candidate({
    provider: "groq",
    capabilities: {
      ...candidate().capabilities,
      reasoning: {
        kind: "configurable",
        parameter: "reasoning_effort",
        levels: ["low", "medium", "high"],
        supported: true
      },
      temperature: "unknown"
    }
  });
  const groqSettings = buildAdaptiveGenerationSettings({
    task: "socratic_tutor_response",
    candidate: groq,
    assessment
  });

  assert.equal(groqSettings.reasoningControl.parameter, "reasoning_effort");
  assert.equal("temperature" in groqSettings, false);
});

test("learning-plan settings request JSON mode without exceeding the reviewed model limit", () => {
  const assessment = assessAdaptiveRequest({
    task: "learning_plan_generation",
    systemPrompt: "Return only valid JSON.",
    userPrompt: "Build a course plan for thermodynamics."
  });
  const settings = buildAdaptiveGenerationSettings({
    task: "learning_plan_generation",
    candidate: candidate(),
    assessment
  });

  assert.equal(settings.maxOutputTokens, 2048);
  assert.equal(settings.structuredOutput, "json_object");
  assert.equal(settings.temperature, 0.2);
});


test("activation readiness assessment requires high-complexity Tutor capacity and full JSON learning-plan output", () => {
  const tutor = assessAdaptiveTaskReadiness("socratic_tutor_response");
  const plan = assessAdaptiveTaskReadiness("learning_plan_generation");

  assert.equal(tutor.complexityBand, "high");
  assert.equal(tutor.outputTokenBudget, 1024);
  assert.equal(tutor.structuredOutputRequired, false);
  assert.equal(plan.outputTokenBudget, 2048);
  assert.equal(plan.structuredOutputRequired, true);
});
