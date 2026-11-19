# Cogniva AI provider runtime foundation

**Status:** Provider-neutral text-generation adapters, administrator connection tests, and the persisted benchmark workspace are implemented. The provider runtime is integrated into the learner-facing Socratic tutor response path; this implementation also integrates topic-based learning-plan generation. Task execution still requires a saved administrator provider/model route and the matching server credential. No comparative provider benchmark has been completed and no provider has been selected as a universal winner.

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

## Learner-facing integrations and limits

The configured text runtime is used by:
- `socratic_tutor_response` for the persisted, text-first tutor response route;
- `learning_plan_generation` for topic-based personal plan generation and strict proposed-revision persistence in this implementation.

Each request reads the exact saved task route from `ai_task_routes` and uses its matching server-side credential. A missing route, missing/rejected credential, unsupported model, rate limit, timeout, or invalid output is surfaced as a failure/unavailable state. No hidden provider switch or canned fallback is used.

All currently supported Tutor providers (Gemini, Groq, and Mistral) persist their response text into the same Tutor message contract and render through the shared `TutorMessageMarkdown` component. That renderer supports Markdown math and KaTeX, and normalizes common provider conventions (`\\(...\\)`, `\\[...\\]`, clearly mathematical legacy `[...TeX...]` wrappers, and short unwrapped equations after numbered/bulleted rule labels) to the renderer's supported delimiters. Code spans and fenced code blocks are preserved. Normalization is display-only: the original provider response remains the saved record, raw HTML is not trusted, and no provider-specific rendering branch is used.

Learning-plan generation is limited to text topics. It validates exact JSON structure, bounded counts/lengths, unique concept names, unit mappings, and proposed relation consistency before a single transaction saves the complete revision tree. It does not establish that the suggested content is factually correct or complete. Learners cannot yet edit/approve plans or start a tutor session from a plan unit through the UI.

The Admin UI reports the task runtime as integrated, separately from whether a route is saved and its server credential is present. A successful connection test means only that the selected provider/model responded; it does not establish pedagogical quality. The benchmark workspace remains administrator-only, and no benchmark result exists until a real comparative run and blinded review are completed.

## Benchmark gate

Before selecting or activating a provider, Cogniva must execute the versioned suite against the listed candidates (or a documented replacement set if any candidate is no longer available).

Learning-plan generation is reviewed for output validity, required structure, topic coverage, objective measurability, ordering coherence, and absence of unsupported claims. Socratic tutoring is reviewed for one-step guidance, relevance to the learner's last input, context continuity, hint quality, and unsupported verification claims.

Record latency and provider-reported token usage for every attempt. Cost comparisons require the run's retained pricing snapshot. Pedagogical quality must include blinded human rubric review; a model judging its own output is not sufficient evidence.

A benchmark report must show failed, timed-out, rate-limited, and invalid outputs rather than dropping them from the results. No provider is activated automatically from a score.
