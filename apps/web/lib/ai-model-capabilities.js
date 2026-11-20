function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateModelCapabilities(value) {
  if (!isRecord(value)) {
    throw new Error("Model capabilities must be a JSON object.");
  }
  const allowed = new Set([
    "inputModalities", "outputModalities", "structuredOutput",
    "contextWindowTokens", "maxOutputTokens", "reasoning", "temperature"
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error("Model capabilities contain an unsupported field.");
  }

  const modalities = (candidate, permitted, label) => {
    if (candidate === undefined) return undefined;
    if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== "string" || !permitted.includes(item))) {
      throw new Error(label + " must contain only supported capability values.");
    }
    return [...new Set(candidate)];
  };
  const inputModalities = modalities(value.inputModalities, ["text", "image"], "inputModalities");
  const outputModalities = modalities(value.outputModalities, ["text"], "outputModalities");

  const boundedInteger = (candidate, label) => {
    if (candidate === undefined || candidate === null) return candidate;
    if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 1 || candidate > 10_000_000) {
      throw new Error(label + " must be a positive safe integer.");
    }
    return candidate;
  };
  const contextWindowTokens = boundedInteger(value.contextWindowTokens, "contextWindowTokens");
  const maxOutputTokens = boundedInteger(value.maxOutputTokens, "maxOutputTokens");

  const structuredValues = ["unknown", "unsupported", "json_object", "json_schema"];
  if (value.structuredOutput !== undefined && !structuredValues.includes(String(value.structuredOutput))) {
    throw new Error("structuredOutput is not a supported capability value.");
  }

  const temperatureValues = ["unknown", "supported", "unsupported"];
  if (value.temperature !== undefined && !temperatureValues.includes(String(value.temperature))) {
    throw new Error("temperature is not a supported capability value.");
  }

  let reasoning;
  if (value.reasoning !== undefined) {
    if (!isRecord(value.reasoning)) {
      throw new Error("reasoning must be an object.");
    }
    const item = value.reasoning;
    if (Object.keys(item).some((key) => !["kind", "parameter", "levels", "supported"].includes(key))) {
      throw new Error("reasoning contains an unsupported field.");
    }
    const kinds = ["unknown", "none", "fixed", "configurable"];
    const parameters = [null, "thinking_level", "reasoning_effort"];
    if (!kinds.includes(String(item.kind)) || !parameters.includes(item.parameter ?? null)) {
      throw new Error("reasoning kind or parameter is invalid.");
    }
    if (!Array.isArray(item.levels) || item.levels.length > 12 || item.levels.some((level) => typeof level !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(level))) {
      throw new Error("reasoning.levels must be an array of safe provider-defined level names.");
    }
    if (item.kind === "configurable" && (!item.parameter || item.levels.length === 0)) {
      throw new Error("Configurable reasoning requires a provider parameter and at least one supported level.");
    }
    if (item.supported !== undefined && item.supported !== null && typeof item.supported !== "boolean") {
      throw new Error("reasoning.supported must be a boolean or null.");
    }
    reasoning = {
      kind: item.kind,
      parameter: item.parameter ?? null,
      levels: [...new Set(item.levels)],
      ...(item.supported !== undefined ? { supported: item.supported } : {})
    };
  }

  return {
    ...(inputModalities ? { inputModalities } : {}),
    ...(outputModalities ? { outputModalities } : {}),
    ...(value.structuredOutput !== undefined ? { structuredOutput: value.structuredOutput } : {}),
    ...(contextWindowTokens !== undefined ? { contextWindowTokens } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(reasoning ? { reasoning } : {}),
    ...(value.temperature !== undefined ? { temperature: value.temperature } : {})
  };
}

export function validateCapabilityEvidenceUrl(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("Capability evidence URL must be an HTTPS URL.");
  }
  let url;
  try { url = new URL(value); } catch { throw new Error("Capability evidence URL must be a valid HTTPS URL."); }
  if (url.protocol !== "https:" || !url.hostname) {
    throw new Error("Capability evidence URL must use HTTPS.");
  }
  return url.toString();
}
