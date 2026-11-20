function reasoningRank(level) {
  switch (level.toLowerCase()) {
    case "none": return 0;
    case "minimal": return 1;
    case "low": return 2;
    case "medium": return 3;
    case "high": return 4;
    case "xhigh": return 5;
    default: return 6;
  }
}

export function resolveAiModelProbePolicy(model) {
  const reasoning = model.capabilities.reasoning;
  const supportsParameter =
    (model.provider === "gemini" && reasoning?.parameter === "thinking_level") ||
    (model.provider !== "gemini" && reasoning?.parameter === "reasoning_effort");

  const orderedLevels = [...(reasoning?.levels ?? [])].sort(
    (left, right) => reasoningRank(left) - reasoningRank(right)
  );
  const reasoningControl =
    reasoning?.kind === "configurable" && supportsParameter && orderedLevels[0]
      ? { parameter: reasoning.parameter, level: orderedLevels[0] }
      : undefined;

  const usesReasoning =
    reasoning?.kind === "fixed" ||
    reasoning?.kind === "configurable" ||
    reasoning?.supported === true;
  const targetOutput = reasoningControl ? 256 : usesReasoning ? 1024 : 128;
  const knownMaximum = model.capabilities.maxOutputTokens;
  const maxOutputTokens = Math.max(
    1,
    Math.min(targetOutput, knownMaximum ?? targetOutput, 2048)
  );

  const timeoutMs = model.lastTestLatencyMs === null
    ? 30000
    : Math.min(30000, Math.max(12000, model.lastTestLatencyMs * 2 + 5000));

  return {
    maxOutputTokens,
    timeoutMs,
    ...(model.capabilities.temperature === "supported" ? { temperature: 0 } : {}),
    ...(reasoningControl ? { reasoningControl } : {})
  };
}
