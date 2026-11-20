import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCapabilityEvidenceUrl,
  validateModelCapabilities
} from "./ai-model-capabilities.js";

test("preserves unknown model capabilities instead of inventing support", () => {
  assert.deepEqual(validateModelCapabilities({}), {});
  assert.deepEqual(validateModelCapabilities({
    structuredOutput: "unknown",
    reasoning: { kind: "unknown", parameter: null, levels: [] },
    temperature: "unknown"
  }), {
    structuredOutput: "unknown",
    reasoning: { kind: "unknown", parameter: null, levels: [] },
    temperature: "unknown"
  });
});

test("accepts documented limits and provider-specific reasoning controls", () => {
  const result = validateModelCapabilities({
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    structuredOutput: "json_schema",
    contextWindowTokens: 131072,
    maxOutputTokens: 65536,
    reasoning: { kind: "configurable", parameter: "reasoning_effort", levels: ["low", "medium", "high"] },
    temperature: "unsupported"
  });
  assert.equal(result.contextWindowTokens, 131072);
  assert.deepEqual(result.reasoning.levels, ["low", "medium", "high"]);
});

test("rejects unknown capability fields and malformed modality declarations", () => {
  assert.throws(() => validateModelCapabilities({ supportsEverything: true }));
  assert.throws(() => validateModelCapabilities({ inputModalities: ["text", "audio"] }));
  assert.throws(() => validateModelCapabilities({ outputModalities: ["image"] }));
});

test("rejects invalid token limits and incomplete reasoning contracts", () => {
  assert.throws(() => validateModelCapabilities({ contextWindowTokens: 0 }));
  assert.throws(() => validateModelCapabilities({ maxOutputTokens: -1 }));
  assert.throws(() => validateModelCapabilities({
    reasoning: { kind: "configurable", parameter: "reasoning_effort", levels: [] }
  }));
  assert.throws(() => validateModelCapabilities({
    reasoning: { kind: "configurable", parameter: "temperature", levels: ["low"] }
  }));
});

test("requires HTTPS capability evidence URLs", () => {
  assert.equal(
    validateCapabilityEvidenceUrl("https://docs.example.com/models/example"),
    "https://docs.example.com/models/example"
  );
  assert.throws(() => validateCapabilityEvidenceUrl("http://docs.example.com/model"));
  assert.throws(() => validateCapabilityEvidenceUrl("not-a-url"));
});
