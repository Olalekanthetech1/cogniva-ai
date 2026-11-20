# Cogniva — Phase 1.3 Adaptive Multi-Provider, Multi-Model Intelligence

**Status (20 November 2026):** Phase 1.3a is merged to `main`; migration 0009 and the physical registry schema are verified in Neon by strict read-only audit [#44707763879](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44707763879) (10/10 migrations, both registry tables, all required columns, enums, constraints and indexes). Phase 1.3b adds a shared adaptive runtime for Tutor and learning-plan generation. Both tasks remain `pinned` by default. Adaptive mode requires an explicit per-task server setting and a non-empty pool of administrator-enabled, exact-tested, evidence-reviewed candidates; this change does not switch live learner traffic by default.

## 1. Goal

Let Cogniva select an appropriate administrator-approved model for each student request, while keeping credentials server-side, task eligibility explicit, and selection decisions explainable.

The administrator manages the candidate pool. Cogniva selects only from that pool. Discovery, connection testing, capability verification, pedagogical benchmarking, and production activation are distinct states.

## 2. Provider and model registry

The registry stores multiple exact model IDs under each configured provider. A model record includes provider identity, exact model ID, administrator-facing display name, capability declaration, HTTPS evidence URL, review actor/time, connection-test status/latency/safe error code, and lifecycle state (`pending`, `enabled`, `disabled`).

Supported capability fields cover input/output modalities, context and output token limits, structured-output mode, reasoning support/parameter/levels, and temperature support. Unknown values remain unknown; Cogniva does not infer capability from model names, provider branding, or model family.

Task eligibility is stored separately with an explicit enable flag and administrator priority. A model may be enabled for one task but remain disabled for another.

## 3. Provider discovery

Discovery calls provider-native inventory endpoints using the server-side API credential:
- Gemini: [Models API](https://ai.google.dev/api/models); retain models listing `generateContent` and metadata actually returned, such as token limits and thinking support. A returned thinking flag does not reveal which reasoning controls or levels the exact model accepts.
- Groq: [Models API](https://console.groq.com/docs/api-reference) and [supported model catalogue](https://console.groq.com/docs/models); retain provider-returned identifiers and any context/output fields actually present. A model-list entry is not automatically assumed to support the Chat Completions API or a particular request parameter.
- Mistral: [List Models API](https://docs.mistral.ai/api/endpoint/models); include models with `completion_chat` capability and retain context length and vision support where returned.

Discovery never registers or enables a model automatically. The administrator selects a discovered model to populate the registration form, reviews its model-specific documentation, tests the exact model, and explicitly approves capabilities. The list endpoint may omit lifecycle, input modality, reasoning or output details; Cogniva leaves those fields unknown.

## 4. Backwards-compatible migration and rollout

Migration 0009 adds `ai_models` and `ai_task_model_candidates`. Existing `ai_task_routes` entries are copied into the registry as pending model records with unknown capabilities and disabled task assignments. The existing `ai_task_routes` table is neither changed nor removed and continues to drive learner traffic.

A capability or evidence edit invalidates prior capability review and connection-test metadata and returns the model to pending. A failed exact-model test also returns it to pending and disables all task assignments. A model can become enabled only when its exact-token connection test succeeds and an administrator explicitly marks its capability evidence as reviewed. Model enablement is separate from task candidate enablement.

## 5. Model-aware diagnostic policy

The two administrator test actions use one shared diagnostic policy. It:
- respects an exact model's declared output ceiling;
- selects the lowest declared reasoning level only when the exact provider adapter supports the corresponding parameter;
- omits temperature when capability is unknown or unsupported;
- uses a bounded first-test deadline and adjusts subsequent deadlines using observed latency;
- treats a non-empty response that does not return the exact test token as a failed instruction check.

This is a diagnostic policy only; it does not yet replace learner-facing generation settings.

## 6. Adaptive routing contract (Phase 1.3b)

For each learner request, the shared router evaluates the task, prompt size, deterministic complexity signals, candidate state, provider credential, successful exact-model test, administrator-reviewed capability evidence, task eligibility, priority, and verified context/output constraints.

The character-based input estimate is `ceil(promptCharacters / 3.5)`. It is a conservative heuristic, not a provider tokenizer. Selection requires explicit text input/output support, sufficient verified context and output limits, and compatible structured-output capability for learning-plan generation. A learning-plan candidate must declare JSON-object or JSON-schema output support. A Tutor candidate must satisfy the current CTL mode's requested output budget.

Only models that are globally `enabled`, have an enabled task-candidate row, have a successful exact-model test and a reviewed HTTPS capability reference, have a configured provider credential, and satisfy request capability limits are eligible. The lowest numeric administrator priority is selected first; successful connection-test latency breaks ties. No cost or teaching-quality score is inferred. If no candidate satisfies the contract, the request returns an explicit unavailable error.

Task modes are configured independently:
- `AI_ROUTING_MODE_LEARNING_PLAN_GENERATION=pinned|adaptive`
- `AI_ROUTING_MODE_SOCRATIC_TUTOR_RESPONSE=pinned|adaptive`

An unset variable defaults to `pinned`. Invalid values fail closed with a configuration error. `pinned` continues to use the existing `ai_task_routes` record. `adaptive` uses only eligible registry candidates and does not fall back to the pinned route if no candidate is eligible or the selected provider fails.

The router returns the selected provider/model, policy version, complexity band, estimated input size, eligible and total candidate counts, administrator priority, and a human-readable reason. Routing metadata contains no prompt, completion, credential, or private reasoning trace.

## 7. Centralized learner runtime policy (Phase 1.3b)

One resolver sets budgets and provider parameters for both learner tasks; route handlers no longer choose provider-specific generation settings.

- Tutor output budgets are 256, 640, or 1,024 tokens for low, medium, or high complexity, capped by the CTL mode's requested maximum. Learning-plan generation retains its 2,048-token platform budget because its strict output contract requires a complete structured plan.
- The estimated prompt size plus a 15% margin (minimum 512 tokens) and the output budget must fit inside the model's reviewed context-window limit.
- The request deadline starts at 12 seconds for low-complexity Tutor, 18 seconds for medium, 25 seconds for high, and 25 seconds for learning-plan generation. A successful exact-model connection-test latency can raise the deadline using a bounded `3 × test latency + 2 seconds` rule; every request remains capped at 30 seconds.
- Temperature is sent only when the exact model's reviewed capability declares it supported (0.25 for Tutor, 0.2 for learning plans). Unknown or unsupported temperature capability means the parameter is omitted.
- Reasoning controls are sent only for `configurable` reasoning with a provider-matching parameter (`thinking_level` for Gemini, `reasoning_effort` for Groq/Mistral) and non-empty reviewed levels. The stored level order is treated as provider-documented low-to-high order.
- Adaptive learning-plan requests use JSON-object mode only when the model's reviewed structured-output capability is `json_object`; otherwise the candidate is ineligible. The existing strict parser remains the final schema validator.

All budgets remain within the provider adapter's 2,048-token output ceiling and 30-second deadline ceiling. The resolver does not claim exact token counts; estimates are routing guards, not usage metering.

## 8. Cost, quality, reliability and security

- Cost-aware selection is not implemented because current model pricing and a reliable cost ledger are not retained in the registry.
- Teaching-quality scoring is not implemented because comparative benchmark outputs and blinded human review are not yet available. A connection test is not quality evidence.
- Latency selection currently uses the most recent successful exact-model connection-test measurement only; it is a tie-breaker after administrator priority, not a live latency forecast.
- Silent failover/provider switching is disabled. After one model is selected, any upstream error is returned through the task's existing safe failure path; no second model or pinned route is tried.
- Tutor turn metadata stores safe routing fields with existing provider/model provenance. Learning-plan generation returns safe selection metadata with the generation result; the persisted revision retains its existing provider/model provenance fields.
- Provider credentials remain in server environment variables. Routing metadata excludes learner prompts, full completions, credentials, and private reasoning traces.

## 9. Delivery order

### Phase 1.3a — Model registry and task candidate inventory
- [x] Add registry and disabled-by-default task assignments.
- [x] Backfill current routes as pending model identities without changing live traffic.
- [x] Add provider-native model inventory discovery for Gemini, Groq, and Mistral.
- [x] Add exact-model connection tests, capability evidence review, model enablement, task eligibility and priority.
- [x] Add regression tests for capability validation and diagnostic probe policy.
- [ ] Add end-to-end authorization, PostgreSQL mutation, enablement-gate, and audit event tests.
- [x] Apply migration 0009 to Neon and confirm its entry in the production migration ledger.
- [x] Run the strict read-only production audit for both registry tables, required columns, enum labels, constraints, and indexes; production run [#44707763879](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44707763879) passed.
- [ ] Verify deployed Admin UI and provider discovery against configured Render credentials.

### Phase 1.3b — Adaptive router and runtime policy
- [x] Add deterministic task complexity assessment and conservative prompt-size/context estimates.
- [x] Select only enabled, credential-ready, exact-tested, evidence-reviewed models assigned to the requested task.
- [x] Add independent per-task pinned/adaptive rollout settings; both default to pinned.
- [x] Centralize output budgets, context fit, reasoning controls, structured JSON mode, temperature gating, and bounded deadlines.
- [x] Integrate the shared policy into Tutor and learning-plan generation.
- [x] Persist safe Tutor routing metadata and return safe learning-plan selection metadata; do not store routing prompts or private reasoning traces.
- [x] Keep silent provider switching disabled; provider failure is surfaced without trying a second candidate.
- [x] Add unit regression coverage for request assessment, eligibility exclusions, priorities, latency tie-breaks, reasoning parameters, temperature gating, and JSON-mode requirements.
- [ ] Add administrator UI controls for task routing mode and explicit quality/cost objectives; rollout mode is currently a server-side task setting, while candidate assignments and priorities remain administrator-managed.
- [ ] Add price-aware/quality-aware selection only after current pricing evidence and blinded task-quality benchmarks exist.
- [ ] Run production candidate readiness checks and explicitly activate one task only after its models have been reviewed, tested, enabled, and assigned.

### Phase 1.3c — Evidence-informed model improvement
- [ ] Run the comparative model benchmark and complete blinded human evaluation.
- [ ] Use verified task-specific quality, cost, latency and reliability evidence to tune model priorities.
- [ ] Never auto-promote a model from unreviewed or incomplete evidence.
