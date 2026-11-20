import type { AiProviderId } from "@/lib/admin-ai-config";

export type AiProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type AiTextGenerationInput = {
  provider: AiProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs?: number;
  reasoningControl?: {
    parameter: "thinking_level" | "reasoning_effort";
    level: string;
  };
};

export type AiTextGenerationResult = {
  provider: AiProviderId;
  requestedModel: string;
  resolvedModel: string;
  text: string;
  usage: AiProviderUsage;
  finishReason: string | null;
  latencyMs: number;
};

export type AiProviderErrorCode =
  | "CREDENTIAL_MISSING"
  | "CREDENTIAL_REJECTED"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_REJECTED"
  | "INVALID_UPSTREAM_RESPONSE";

export class AiProviderRuntimeError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    readonly statusCode: 409 | 422 | 429 | 502 | 504,
    message: string,
    readonly upstreamStatusCode: number | null = null,
    readonly providerErrorCode: string | null = null
  ) {
    super(message);
    this.name = "AiProviderRuntimeError";
  }
}

const credentialVariables: Record<AiProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY"
};

const endpoints: Record<Exclude<AiProviderId, "gemini">, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions"
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readSafeProviderErrorCode(value: unknown): string | null {
  const candidate =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isSafeInteger(value)
        ? String(value)
        : "";

  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(candidate)
    ? candidate
    : null;
}

function extractOpenAiText(value: unknown): string | null {
  if (typeof value === "string") return readText(value);
  if (!Array.isArray(value)) return null;

  const parts = value.flatMap((part) => {
    if (!isObject(part) || part.type !== "text") return [];
    return typeof part.text === "string" ? [part.text] : [];
  });

  return readText(parts.join(""));
}

function extractOpenAiResponse(
  body: JsonObject,
  provider: AiProviderId,
  requestedModel: string,
  latencyMs: number
): AiTextGenerationResult {
  const choices = body.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const message =
    isObject(firstChoice) && isObject(firstChoice.message)
      ? firstChoice.message
      : null;
  const text = message ? extractOpenAiText(message.content) : null;

  if (!text) {
    throw new AiProviderRuntimeError(
      "INVALID_UPSTREAM_RESPONSE",
      502,
      "The provider responded without a usable text completion."
    );
  }

  const usage = isObject(body.usage) ? body.usage : {};

  return {
    provider,
    requestedModel,
    resolvedModel: readText(body.model) ?? requestedModel,
    text,
    usage: {
      inputTokens: readCount(usage.prompt_tokens),
      outputTokens: readCount(usage.completion_tokens),
      totalTokens: readCount(usage.total_tokens)
    },
    finishReason: isObject(firstChoice)
      ? readText(firstChoice.finish_reason)
      : null,
    latencyMs
  };
}

function extractGeminiResponse(
  body: JsonObject,
  requestedModel: string,
  latencyMs: number
): AiTextGenerationResult {
  const candidates = body.candidates;
  const firstCandidate = Array.isArray(candidates) ? candidates[0] : null;
  const candidateContent =
    isObject(firstCandidate) && isObject(firstCandidate.content)
      ? firstCandidate.content
      : null;
  const parts = candidateContent?.parts;
  const text = Array.isArray(parts)
    ? readText(
        parts
          .flatMap((part) =>
            isObject(part) && typeof part.text === "string" ? [part.text] : []
          )
          .join("")
      )
    : null;

  if (!text) {
    const feedback = isObject(body.promptFeedback) ? body.promptFeedback : {};
    const blockReason = readText(feedback.blockReason);
    throw new AiProviderRuntimeError(
      "INVALID_UPSTREAM_RESPONSE",
      502,
      blockReason
        ? "The provider blocked the connection-test prompt."
        : "The provider responded without a usable text completion."
    );
  }

  const usage = isObject(body.usageMetadata) ? body.usageMetadata : {};
  const inputTokens = readCount(usage.promptTokenCount);
  const totalTokens = readCount(usage.totalTokenCount);
  // Gemini total usage includes generated thinking tokens, which are billed as output.
  const billedOutputTokens =
    inputTokens !== null && totalTokens !== null && totalTokens >= inputTokens
      ? totalTokens - inputTokens
      : null;

  return {
    provider: "gemini",
    requestedModel,
    resolvedModel: readText(body.modelVersion) ?? requestedModel,
    text,
    usage: {
      inputTokens,
      outputTokens: billedOutputTokens,
      totalTokens
    },
    finishReason: isObject(firstCandidate)
      ? readText(firstCandidate.finishReason)
      : null,
    latencyMs
  };
}

async function readProviderError(response: Response): Promise<never> {
  const code = response.status;
  let providerErrorCode: string | null = null;

  try {
    const body: unknown = await response.clone().json();
    if (isObject(body) && isObject(body.error)) {
      providerErrorCode =
        readSafeProviderErrorCode(body.error.status) ??
        readSafeProviderErrorCode(body.error.code) ??
        readSafeProviderErrorCode(body.error.type);
    }
  } catch {
    // Keep the HTTP status even when the provider sends a non-JSON error body.
  }

  if (code === 401 || code === 403) {
    throw new AiProviderRuntimeError(
      "CREDENTIAL_REJECTED",
      502,
      "The provider rejected the configured credential. Check the key in the server environment.",
      code,
      providerErrorCode
    );
  }

  if (code === 404) {
    throw new AiProviderRuntimeError(
      "MODEL_NOT_FOUND",
      422,
      "The provider could not find this model ID. Check the exact model ID for the selected provider.",
      code,
      providerErrorCode
    );
  }

  if (code === 429) {
    throw new AiProviderRuntimeError(
      "RATE_LIMITED",
      429,
      "The provider rate limit was reached. Check provider quota and try again later.",
      code,
      providerErrorCode
    );
  }

  if (code >= 500) {
    throw new AiProviderRuntimeError(
      "UPSTREAM_UNAVAILABLE",
      502,
      "The AI provider is temporarily unavailable.",
      code,
      providerErrorCode
    );
  }

  throw new AiProviderRuntimeError(
    "UPSTREAM_REJECTED",
    502,
    "The AI provider rejected the connection-test request. Check the model and provider account configuration.",
    code,
    providerErrorCode
  );
}

function validateInput(input: AiTextGenerationInput): void {
  if (
    input.reasoningControl !== undefined &&
    (!["thinking_level", "reasoning_effort"].includes(input.reasoningControl.parameter) ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(input.reasoningControl.level) ||
      (input.provider === "gemini" && input.reasoningControl.parameter !== "thinking_level") ||
      (input.provider !== "gemini" && input.reasoningControl.parameter !== "reasoning_effort"))
  ) {
    throw new AiProviderRuntimeError(
      "UPSTREAM_REJECTED",
      422,
      "The selected model reasoning control is not valid for this provider adapter."
    );
  }

  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(input.model) ||
    input.systemPrompt.length > 8000 ||
    input.userPrompt.length < 1 ||
    input.userPrompt.length > 16000 ||
    input.systemPrompt.length < 1 ||
    !Number.isInteger(input.maxOutputTokens) ||
    input.maxOutputTokens < 1 ||
    input.maxOutputTokens > 2048 ||
    (input.temperature !== undefined &&
      (!Number.isFinite(input.temperature) ||
        input.temperature < 0 ||
        input.temperature > 1))
  ) {
    throw new AiProviderRuntimeError(
      "UPSTREAM_REJECTED",
      422,
      "The generation request contains invalid or oversized input."
    );
  }
}

export async function generateTextWithProvider(
  input: AiTextGenerationInput
): Promise<AiTextGenerationResult> {
  validateInput(input);

  const apiKey = process.env[credentialVariables[input.provider]]?.trim();
  if (!apiKey) {
    throw new AiProviderRuntimeError(
      "CREDENTIAL_MISSING",
      409,
      `The ${credentialVariables[input.provider]} environment variable is not configured.`
    );
  }

  const controller = new AbortController();
  const timeout = Math.min(Math.max(input.timeoutMs ?? 20000, 1000), 30000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startedAt = Date.now();

  let responseBody: unknown;

  try {
    const url =
      input.provider === "gemini"
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`
        : endpoints[input.provider];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (input.provider === "gemini") {
      headers["x-goog-api-key"] = apiKey;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const body =
      input.provider === "gemini"
        ? {
            systemInstruction: { parts: [{ text: input.systemPrompt }] },
            contents: [
              { role: "user", parts: [{ text: input.userPrompt }] }
            ],
            generationConfig: {
              maxOutputTokens: input.maxOutputTokens,
              ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
              ...(input.reasoningControl?.parameter === "thinking_level"
                ? { thinkingConfig: { thinkingLevel: input.reasoningControl.level } }
                : {})
            }
          }
        : {
            model: input.model,
            messages: [
              { role: "system", content: input.systemPrompt },
              { role: "user", content: input.userPrompt }
            ],
            ...(input.provider === "groq"
              ? { max_completion_tokens: input.maxOutputTokens }
              : { max_tokens: input.maxOutputTokens }),
            ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
            ...(input.reasoningControl?.parameter === "reasoning_effort"
              ? { reasoning_effort: input.reasoningControl.level }
              : {}),
            stream: false
          };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) await readProviderError(response);

    responseBody = await response.json();
  } catch (error) {
    if (error instanceof AiProviderRuntimeError) throw error;

    if (controller.signal.aborted) {
      throw new AiProviderRuntimeError(
        "UPSTREAM_TIMEOUT",
        504,
        "The AI provider did not respond before the request timeout."
      );
    }

    throw new AiProviderRuntimeError(
      "UPSTREAM_UNAVAILABLE",
      502,
      "Cogniva could not reach the AI provider or read its response."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!isObject(responseBody)) {
    throw new AiProviderRuntimeError(
      "INVALID_UPSTREAM_RESPONSE",
      502,
      "The AI provider returned an invalid response."
    );
  }

  const latencyMs = Date.now() - startedAt;
  return input.provider === "gemini"
    ? extractGeminiResponse(responseBody, input.model, latencyMs)
    : extractOpenAiResponse(
        responseBody,
        input.provider,
        input.model,
        latencyMs
      );
}
