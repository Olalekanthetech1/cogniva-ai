# Cogniva — Phase 1.3 Adaptive Multi-Provider, Multi-Model Intelligence

**Status:** Approved architecture. Phase 1.3a registry and administrative foundations are implemented in the current branch; migration 0009 is not yet applied to Neon. Adaptive selection for learner requests is not enabled. Existing per-task routes remain authoritative.

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

For each learner request, the router will evaluate:
1. task and required output contract;
2. prompt size, conversation context, and deterministic complexity features;
3. model status, credential presence, and connection evidence;
4. explicit task-candidate eligibility and administrator priority;
5. verified context/output limits, modality, reasoning and structured-output compatibility;
6. task-specific quality evidence and current pricing/latency evidence where available.

The router returns the selected provider/model, policy version, complexity band, eligible-candidate count, and a human-readable selection reason. If no candidate satisfies the requirements, return an explicit unavailable state. Do not fabricate output or silently substitute another provider.

## 7. Centralized learner runtime policy (Phase 1.3b)

One central resolver—not individual task routes—will derive reasoning controls, output-token budgets, structured-output settings and deadlines from task requirements, request complexity, verified model limits, administrator ceilings, and retained performance evidence.

All provider-specific parameters are emitted only when the exact selected model's verified capability record supports them. Unknown capability values are not treated as supported. Hard ceilings are platform/cost guardrails, not the default settings for every request.

## 8. Cost, quality, reliability and security

- Cost-aware selection requires current retained prices and reliable token usage; otherwise estimated cost remains unavailable.
- Quality-aware selection requires task-specific benchmark outputs and blinded human review; a successful connection test is not teaching-quality evidence.
- Latency-aware selection requires measured results, not assumptions based on model name or size.
- Failover/provider switching is disabled by default and requires an explicit, separately audited policy.
- Do not persist learner prompts, full completions, credentials, or private reasoning traces in routing telemetry.
- Provider credentials remain in Render environment variables and are never stored in PostgreSQL.
- The model registry and routing mutations are administrator-only and same-origin protected.

## 9. Delivery order

### Phase 1.3a — Model registry and task candidate inventory
- [x] Add registry and disabled-by-default task assignments.
- [x] Backfill current routes as pending model identities without changing live traffic.
- [x] Add provider-native model inventory discovery for Gemini, Groq, and Mistral.
- [x] Add exact-model connection tests, capability evidence review, model enablement, task eligibility and priority.
- [x] Add regression tests for capability validation and diagnostic probe policy.
- [ ] Add end-to-end authorization, PostgreSQL mutation, enablement-gate, and audit event tests.
- [ ] Apply migration 0009 to Neon after review and verify with a post-migration read-only audit.
- [ ] Verify deployed Admin UI and provider discovery against configured Render credentials.

### Phase 1.3b — Adaptive router and runtime policy
- [ ] Add deterministic task complexity assessment.
- [ ] Select only enabled, credential-ready, tested, evidence-reviewed models assigned to that task.
- [ ] Add task-specific pinned/adaptive mode, cost/latency/quality objectives and hard administrator ceilings.
- [ ] Move all output-token, reasoning and timeout decisions to one central resolver and remove route-local constants.
- [ ] Integrate capability-aware model selection into Tutor and learning-plan generation.
- [ ] Add safe routing decision telemetry and clear selection explanations.
- [ ] Keep silent provider switching disabled; add explicit failover only if separately approved and tested.
- [ ] Complete provider adapter, multi-model, budget, security and regression tests before activating learner routing.

### Phase 1.3c — Evidence-informed model improvement
- [ ] Run the comparative model benchmark and complete blinded human evaluation.
- [ ] Use verified task-specific quality, cost, latency and reliability evidence to tune model priorities.
- [ ] Never auto-promote a model from unreviewed or incomplete evidence.
