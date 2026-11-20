# Cogniva — Admin Dashboard Foundation

**Status:** The existing Admin Foundation and AI Configuration are deployed. Phase 1.3a adds the administrator multi-model registry in the current implementation branch; its additive migration must be applied and the application deployed before the new registry UI is available. Existing learner task routes remain unchanged.

## 1. Purpose

The Admin Dashboard is a separate, server-protected platform control centre. It exposes real administrative operations and telemetry, not decorative controls or sample metrics. The initial route is `/admin`; student workspace navigation remains separate.

## 2. Authentication and roles

- Better Auth's Admin plugin provides the initial role field and administrative server APIs.
- New and existing accounts default to the `user` role.
- Only an explicitly provisioned account with a verified email and the `admin` role can access administration pages and APIs.
- Public registration never accepts a role field.
- Both page rendering and admin API routes verify the current server-side session and role. A hidden navigation item is not an authorization boundary.

## 3. First live capability

Implemented and deployed:

- `GET /api/v1/admin/overview` — administrator-only live counts for user accounts, learning plans, and tutor sessions, plus database query availability.
- `/admin` — protected, responsive dashboard overview.
- Database query failures are shown as unavailable; counts are never replaced with estimates or sample values.

## 4. AI Configuration slice

The AI Configuration module stores provider-routing preferences for two text tasks:

- `learning_plan_generation`
- `socratic_tutor_response`

Provider options are Gemini, Groq, and Mistral. The model identifier is stored as the exact string entered by an administrator; this avoids presenting a stale hardcoded catalogue as current provider inventory.

Implemented in this slice:

- `GET /api/v1/admin/ai-config` — administrator-only provider credential-presence status and saved task-routing preferences.
- `PUT /api/v1/admin/ai-config` — validates and persists one task's provider/model preference.
- Credential presence is derived on the server from `GEMINI_API_KEY`, `GROQ_API_KEY`, and `MISTRAL_API_KEY`. Only a boolean status and environment-variable name are returned. Secret values are never returned, logged, or written to the database.
- Each saved routing change writes an `admin_audit_events` record in the same database transaction, including actor, task, and before/after non-secret routing metadata.
- `ai_task_routes` stores provider/model preferences and the administrator who last updated them.
- The application exposes no update/delete operation for audit events.

**Capability boundary:** Gemini, Groq, and Mistral adapters are implemented. The learner tutor response route uses the saved `socratic_tutor_response` task route; the personal learning-plan generation API uses the saved `learning_plan_generation` task route. Each learner-facing task requires both a saved provider/model preference and its matching server credential. The runtime does not silently switch providers or return canned output. The admin connection test reports provider response, exact-token adherence, latency, and provider-reported token usage; it does not return or persist the generated test text.

Personal learning-plan generation is text-topic only and writes a proposed revision only after strict structural validation. Learner review/approval and approved-plan-unit Tutor launch are implemented; editing/reordering plan content and persisted Socratic stage controls remain outstanding. Home now shows real resumable Tutor sessions and learner-approved active plans. Comparative provider evaluation remains outstanding, and no provider has been selected as a universal winner. See [AI_PROVIDER_RUNTIME.md](AI_PROVIDER_RUNTIME.md) for adapter limits, structured-output requirements, and benchmark gates.

To provide credentials, add the appropriate variable in the Render web service's Environment settings. Never paste API keys into the admin page, GitHub, source code, screenshots, or chat. After changing an environment variable, restart/redeploy the service so the running process receives it.

## 5. Planned modules — not yet enabled

1. Versioned system-prompt management and controlled publishing.
2. Student account administration and support operations.
3. Learning-plan and tutoring policy configuration.
4. Academic catalogue governance and source verification.
5. Usage, cost, latency, error, and provider health analytics.
6. Role/permission management and security review.
7. Audit history browsing and filtering.

Each module needs a defined data model, server-side permission checks, audit events, validation, and tests before its controls are enabled.

## 6. Release order

1. Review application/schema changes and CI.
2. Merge the reviewed schema change to `main`.
3. Generate a migration using the separate generation workflow.
4. Inspect generated SQL for only intended additive enums, tables, indexes, and constraints.
5. Apply the reviewed committed migration to Neon through the explicit production migration workflow.
6. Deploy application code only after the migration succeeds.
7. Verify administrator access, student denial, API validation, persistence after refresh, credential redaction, and audit event creation.
8. Implement provider adapters and benchmark them before activating task routes.

Do not mark any AI task as active until it has a real configured provider adapter, validated model ID, bounded execution, truthful failure handling, and repeatable evaluation evidence.


## 4.1 Phase 1.3a — Multi-model registry

The AI Configuration page adds a separate **Model registry** beneath the existing provider credential and legacy task-route controls.

Administrators can:
- discover model IDs from the provider's own model-list endpoint;
- manually register an exact provider model ID when discovery is unavailable or incomplete;
- review and edit capability JSON and its HTTPS documentation reference;
- test the exact model with a model-aware, bounded diagnostic profile;
- explicitly mark capability claims as reviewed and enable/disable the model;
- assign an enabled model to one or more tasks and set task-specific priority.

Provider discovery is intentionally conservative. It uses only fields actually returned by the provider. Gemini entries are filtered by the `generateContent` method; Groq's active model list may include models whose chat compatibility still needs an exact connection test; Mistral entries are filtered to records with `completion_chat` capability. Missing fields remain unknown. A discovered model is never auto-registered or auto-enabled.

**Rollout boundary:** migration 0009 backfills existing `ai_task_routes` into the registry as pending models with all task assignments disabled. The original task-route UI remains active and continues to drive student traffic. The model registry is not yet an adaptive router. Phase 1.3b must implement the capability-aware router and centralized inference policy and pass its regression gates before any task is switched from pinned mode.
