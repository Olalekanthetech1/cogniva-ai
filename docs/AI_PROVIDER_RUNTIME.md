# Cogniva AI provider runtime foundation

**Status:** Implemented connection-test adapters only. This document does not claim that learner-facing AI generation or comparative benchmarking is active.

## Supported providers

Cogniva exposes one server-side text-generation contract across the currently approved provider set:

- Gemini
- Groq
- Mistral

The adapters use the providers' documented HTTPS APIs and normalize generated text, resolved model ID, finish reason, latency, and token usage into one result shape.

Provider API references:
- [Gemini generateContent](https://ai.google.dev/api/generate-content)
- [Groq chat completions](https://console.groq.com/docs/api-reference)
- [Mistral chat completions](https://docs.mistral.ai/api/endpoint/chat)

## Runtime boundary

The server-only function `generateTextWithProvider` accepts a provider ID, exact model ID, system prompt, user prompt, output-token limit, temperature, and optional timeout.

The adapter:
- reads the matching API key from the server environment only;
- validates model IDs and bounds prompt size, output tokens, temperature, and request timeout;
- makes a non-streaming request;
- normalizes provider responses and usage fields;
- maps missing credentials, rejected credentials, unknown models, rate limits, timeouts, and malformed responses to explicit safe errors;
- does not retry, silently switch providers, log prompts, return credentials, or use canned fallback output.

Credential variables are `GEMINI_API_KEY`, `GROQ_API_KEY`, and `MISTRAL_API_KEY`. They belong in the Render service environment, not in source control, browser state, the application database, or chat.

## Administrator connection test

`POST /api/v1/admin/ai-config/test` is administrator-only and same-origin protected. It accepts only a supported task key, reads the already-saved provider/model preference for that task, and sends a fixed low-token connection-check prompt.

The response includes:
- provider and resolved model ID;
- whether the provider returned a response;
- whether it returned the exact expected test token;
- response latency and token usage when the provider reports them.

The generated text itself is not returned or persisted. A successful connection test means only that the selected provider/model responded; it does not establish pedagogical quality, structured plan correctness, safe tutoring behaviour, or production readiness.

## Explicitly not enabled

This foundation does **not**:
- route learner requests to any provider;
- generate or save learner learning plans;
- create or continue tutoring sessions;
- stream model responses to students;
- select a preferred provider automatically;
- provide a provider model catalogue;
- compare provider quality, pricing, or latency across a benchmark suite.

The Admin page labels learner runtime as inactive. Saved task preferences remain configuration data only.

## Benchmark gate

Before selecting or activating a provider, Cogniva must run a versioned, identical evaluation set against comparable model candidates for both supported tasks:

1. Learning-plan generation: output validity, required structure, coverage of the learner's stated topic, objective measurability, ordering coherence, and absence of unsupported claims.
2. Socratic tutoring: adherence to one-step guidance, relevance to the learner's last input, preservation of the current step during clarification, quality of hints, and no unsupported verification claims.

Record latency and provider-reported token usage for every completed case. Cost comparisons require a timestamped pricing snapshot for the exact model and account tier used. Pedagogical quality must include blinded human rubric review; a model judging its own output is not sufficient evidence.

A benchmark report must show failed, timed-out, rate-limited, and invalid outputs rather than dropping them from the results. No provider is activated automatically from a score.
