# Cogniva AI provider runtime foundation

**Status:** Provider-neutral text-generation adapters and administrator connection tests are implemented. Phase 1.3a adds the administrator-managed multi-model registry, provider-native inventory discovery, model-specific connection tests, and task-candidate eligibility. The provider runtime is integrated into the learner-facing Socratic tutor response path; this implementation also integrates topic-based learning-plan generation. Task execution still requires a saved administrator provider/model route and the matching server credential. No comparative provider benchmark has been completed and no provider has been selected as a universal winner.

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

Learning-plan generation is limited to text topics. It validates exact JSON structure, bounded counts/lengths, unique concept names, unit mappings, and proposed relation consistency before a single transaction saves the complete revision tree. It does not establish that the suggested content is factually correct or complete. Learners can review/approve proposals and start Tutor sessions from approved plan units. Editing/reordering plan content and persisted Socratic stage transitions remain outstanding.

The Admin UI reports the task runtime as integrated, separately from whether a route is saved and its server credential is present. A successful connection test means only that the selected provider/model responded; it does not establish pedagogical quality. The benchmark workspace remains administrator-only, and no benchmark result exists until a real comparative run and blinded review are completed.

## Benchmark gate

Before selecting or activating a provider, Cogniva must execute the versioned suite against the listed candidates (or a documented replacement set if any candidate is no longer available).

Learning-plan generation is reviewed for output validity, required structure, topic coverage, objective measurability, ordering coherence, and absence of unsupported claims. Socratic tutoring is reviewed for one-step guidance, relevance to the learner's last input, context continuity, hint quality, and unsupported verification claims.

Record latency and provider-reported token usage for every attempt. Cost comparisons require the run's retained pricing snapshot. Pedagogical quality must include blinded human rubric review; a model judging its own output is not sufficient evidence.

A benchmark report must show failed, timed-out, rate-limited, and invalid outputs rather than dropping them from the results. No provider is activated automatically from a score.


## Phase 1.3a model registry and provider discovery

The administrator registry stores multiple exact model IDs per provider and keeps three independent gates distinct:

1. **Discovery:** a provider's list endpoint returns a model identifier and only the metadata that endpoint exposes.
2. **Connection test:** Cogniva sends a minimal exact-model generation request and records latency, test outcome, and a safe error code.
3. **Capability review:** an administrator reviews the exact model's documentation, records capability claims and an HTTPS evidence URL, and explicitly marks those claims as reviewed.

Only a model with a successful exact-token test and reviewed capability evidence can move to the enabled state. An administrator must then enable its assignment for the specific task. A model may be enabled globally but remain unavailable for every learner task.

Discovery is provider-specific:
- Gemini's model list includes generation-method support and token limits where available; Cogniva filters to `generateContent` models. See [Gemini Models API](https://ai.google.dev/api/models). A returned thinking flag is retained as a support signal, not an invented list of controllable levels.
- Groq's [models endpoint](https://console.groq.com/docs/api-reference) returns hosted model identifiers. The supported-model catalogue documents chat compatibility and limits, but the inventory response is not treated as proof that every returned model supports chat completions.
- Mistral's [List Models endpoint](https://docs.mistral.ai/api/endpoint/models) returns capability flags and context length; Cogniva filters to records with `completion_chat` and uses the vision flag where present.

The Admin diagnostic probe is resolved by one shared policy function. It respects the registered model's reported maximum output tokens, chooses the lowest explicitly declared reasoning level only when its provider adapter supports that parameter, omits temperature when capability is unknown or unsupported, and derives a bounded follow-up deadline from the previous measured test latency. The first diagnostic uses a conservative bounded deadline. This connection-test policy is not the learner inference policy.

Legacy `ai_task_routes` remain the sole source of learner-facing provider/model routing until Phase 1.3b is implemented, tested, and explicitly activated. Migration 0009 copies their identities into the registry as pending/unknown and creates disabled task assignments; it does not change live traffic.

## Phase 1.3b centralized learner runtime (not yet implemented)

Tutor and learning-plan generation still contain task-specific output-token and timeout values. Phase 1.3b will replace these with one provider-neutral policy resolver using task requirements, prompt/context size, deterministic complexity features, registered model limits, verified reasoning/structured-output capabilities, administrator ceilings, and retained latency/cost evidence. The resolver will emit provider-specific parameters only when supported by the selected exact model. No silent provider switching is permitted.
