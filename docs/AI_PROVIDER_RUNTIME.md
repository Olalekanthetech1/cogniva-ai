# Cogniva AI provider runtime foundation

**Status:** Provider-neutral connection-test adapters and the administrator-only persisted benchmark runner are implemented on PR #14. The runner is not yet deployed because its Neon schema migration must be generated, reviewed, and applied first. No provider benchmark has been run and learner-facing AI is not active.

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

## Benchmark protocol and case set

The benchmark shortlist, dated pricing snapshot, fixed system prompts, and six evaluation cases are versioned in:

- `docs/AI_PROVIDER_BENCHMARK.md`
- `apps/web/lib/ai-benchmark-suite.ts`

The initial candidates are Gemini `gemini-3.8-flash`, Groq `openai/gpt-oss-120b`, and Mistral `mistral-small-2603`. Mistral Large 4 was excluded because it is currently documented as Public Preview; Mistral Small 4 is documented as generally available. These are candidates only. No output has been benchmarked and no provider has been selected.

The evaluation set covers learning-plan generation and Socratic tutoring. It includes measurable review criteria and expected/failure signals. The protocol requires identical prompts, retained failures, token/latency evidence, timestamped pricing, and blinded human rubric review. Estimated cost must remain unavailable when usage data is incomplete.

## Explicitly not enabled

This foundation does **not**:
- route learner requests to any provider;
- generate or save learner learning plans;
- create or continue tutoring sessions;
- stream model responses to students;
- select a preferred provider automatically;
- serve benchmark-generated outputs to learners;
- activate any provider automatically or route learner requests.

The Admin page labels learner runtime as inactive. Saved task preferences remain configuration data only. The benchmark workspace is a separate administrator-only tool: it records versioned run evidence and blinded human reviews, and does not serve learner requests. Deployment is gated on the reviewed Neon migration and a separate Render deploy.

## Benchmark gate

Before selecting or activating a provider, Cogniva must execute the versioned suite against the listed candidates (or a documented replacement set if any candidate is no longer available).

Learning-plan generation is reviewed for output validity, required structure, topic coverage, objective measurability, ordering coherence, and absence of unsupported claims. Socratic tutoring is reviewed for one-step guidance, relevance to the learner's last input, context continuity, hint quality, and unsupported verification claims.

Record latency and provider-reported token usage for every attempt. Cost comparisons require the run's retained pricing snapshot. Pedagogical quality must include blinded human rubric review; a model judging its own output is not sufficient evidence.

A benchmark report must show failed, timed-out, rate-limited, and invalid outputs rather than dropping them from the results. No provider is activated automatically from a score.
