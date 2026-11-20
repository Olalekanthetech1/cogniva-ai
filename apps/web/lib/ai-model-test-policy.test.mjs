import assert from "node:assert/strict";
import test from "node:test";
import { resolveAiModelProbePolicy } from "./ai-model-test-policy.js";

const base = {
  provider: "gemini",
  capabilities: {},
  lastTestLatencyMs: null
};

test("uses a small bounded probe for models with unknown reasoning capability", () => {
  assert.deepEqual(resolveAiModelProbePolicy(base), {
    maxOutputTokens: 128,
    timeoutMs: 30000
  });
});

test("respects a documented model output ceiling", () => {
  const policy = resolveAiModelProbePolicy({
    ...base,
    capabilities: { maxOutputTokens: 48 }
  });
  assert.equal(policy.maxOutputTokens, 48);
});

test("uses a bounded larger budget for models with fixed reasoning", () => {
  const policy = resolveAiModelProbePolicy({
    ...base,
    capabilities: { reasoning: { kind: "fixed", parameter: null, levels: [] } }
  });
  assert.equal(policy.maxOutputTokens, 1024);
});

test("selects the least expensive declared Gemini thinking level", () => {
  const policy = resolveAiModelProbePolicy({
    ...base,
    capabilities: {
      reasoning: { kind: "configurable", parameter: "thinking_level", levels: ["HIGH", "LOW", "MEDIUM"] },
      temperature: "unsupported"
    }
  });
  assert.equal(policy.maxOutputTokens, 256);
  assert.deepEqual(policy.reasoningControl, { parameter: "thinking_level", level: "LOW" });
  assert.equal(policy.temperature, undefined);
});

test("selects the least reasoning effort declared for Groq and Mistral", () => {
  for (const provider of ["groq", "mistral"]) {
    const policy = resolveAiModelProbePolicy({
      provider,
      capabilities: {
        reasoning: { kind: "configurable", parameter: "reasoning_effort", levels: ["high", "medium", "low"] },
        temperature: "supported"
      },
      lastTestLatencyMs: 18000
    });
    assert.deepEqual(policy.reasoningControl, { parameter: "reasoning_effort", level: "low" });
    assert.equal(policy.temperature, 0);
    assert.equal(policy.timeoutMs, 30000);
  }
});

test("does not send a reasoning parameter that does not match the provider adapter", () => {
  const policy = resolveAiModelProbePolicy({
    provider: "groq",
    capabilities: {
      reasoning: { kind: "configurable", parameter: "thinking_level", levels: ["LOW"] }
    },
    lastTestLatencyMs: 1000
  });
  assert.equal(policy.reasoningControl, undefined);
  assert.equal(policy.maxOutputTokens, 1024);
  assert.equal(policy.timeoutMs, 12000);
});

test("adapts the timeout from the last observed probe latency within the ceiling", () => {
  assert.equal(resolveAiModelProbePolicy({ ...base, lastTestLatencyMs: 8000 }).timeoutMs, 21000);
  assert.equal(resolveAiModelProbePolicy({ ...base, lastTestLatencyMs: 50000 }).timeoutMs, 30000);
});
