# Cogniva — Implementation Plan

**Status:** Sequenced roadmap; completion is based on tested behaviour, not document presence.

## Approved delivery dependency order (20 November 2026)

The sections below retain the existing technical workstream IDs. Execution follows this dependency order so the learner experience, academic data, and adaptive engine are built on verified foundations:

1. **Phase 1.3 — Adaptive AI intelligence:** complete the administrator model registry, then the capability-aware router and centralized runtime policy, then benchmark-backed model improvement.
2. **Phase 2 — Learning Workspace completion:** plan editing/version preservation, persisted Tutor stages/checkpoints, explicit step progression, and end-to-end learner journeys.
3. **Phase 2.5 — Academic course and skill organisation:** operationalise the existing global academic schema with governed source adapters, verified programme/course/syllabus data, canonical Knowledge Components, reviewed course-to-KC mappings, and learner-facing course/skill organisation.
4. **Evidence-based learning intelligence:** complete the remaining guided feedback and subject-verification workstreams (existing Phases 4 and 5), then use Phase 2.5 Knowledge Components plus learner attempts/assessments to build evidence-backed Progress, mastery estimates and explainable recommendations (existing Phase 6).
5. **Multimodal learning:** add image input and document/PDF processing after text learning, course organisation and evidence contracts are stable (existing Phases 3 and 7).
6. **Product readiness:** accessibility, security, privacy, reliability, evaluation and closed beta (existing Phase 8).

No phase is considered delivered because its documentation exists; each exit still requires tested behaviour and its own production verification.



## Phase 0 — Repository and engineering foundation

- [x] Establish monorepo layout, documentation, and ZeroMock policy.
- [x] Add the Next.js App Router web shell.
- [x] Add Node/pnpm toolchain, lint, TypeScript checks, and GitHub Actions CI.
- [x] Verify a successful production build in CI.
- [x] Commit the generated `pnpm-lock.yaml` so installs can use frozen-lockfile mode.

**Exit:** application shell, quality checks, and reproducible dependency lockfile are in place.

## Phase 1 — Identity, persistence, and academic foundation

- [x] Add PostgreSQL/Drizzle database workspace and explicit connection factory.
- [x] Define Better Auth identity tables and authentication integration.
- [x] Define optional student profile and dynamic academic catalogue schema.
- [x] Add migration generation/application commands.
- [x] Require email verification and fail closed when auth infrastructure is not configured.
- [x] Configure the Neon PostgreSQL database and transactional email sender used by the deployed environment.
- [x] Generate, review, and apply the initial migration against the production database.
- [x] Verify registration, email verification, sign-in, authenticated session retrieval, sign-out, and password-reset completion end-to-end against PostgreSQL with captured transactional email delivery in CI.
- [x] Implement authenticated student-profile and read-only academic catalogue APIs with account ownership and academic hierarchy checks.
- [x] Add PostgreSQL-backed integration tests for authentication boundaries, profile ownership, and invalid academic hierarchy submissions.

**Validation boundary:** CI applies the committed migrations to a disposable PostgreSQL service and captures verification/reset emails through a loopback-only test endpoint. The tests verify sign-out invalidation, password reset, existing-session revocation, old-password rejection, protected catalogue/profile routes, session-derived profile ownership, and invalid institution/faculty/department ancestry. This does not validate live Resend domain deliverability or deploy the change to production.

**Exit:** live identity and persistence flows work against a real database; academic metadata is dynamic and optional; CI tests cover access boundaries.

## Phase 1.1 — Global academic interoperability

This design step precedes further academic-catalogue implementation. See [GLOBAL_ACADEMIC_ARCHITECTURE.md](GLOBAL_ACADEMIC_ARCHITECTURE.md) and [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md).

- [x] Approve the global academic domain model and distinguish institution identity, recognition, programme, course, curriculum version, local academic stage, ISCED mapping, and Knowledge Components.
- [x] Run and review the read-only production schema/migration audit; reconcile actual Neon state before generating DDL.
- [x] Document the additive target migration map and rollback plan; no production DDL is included in this design step.
- [x] Define country/jurisdiction, qualification-framework, ISCED-P/ISCED-A, and ISCED-F mappings without treating local labels as universal.
- [x] Define institution identifiers, flexible institution-unit hierarchy, recognition evidence, and source provenance.
- [x] Define programmes, programme versions, academic periods, course requirements, and versioned course syllabi.
- [x] Define global source-adapter roles and terms/usage boundaries for ISO, UNESCO, ROR, OpenAlex, WHED/IAU, regulators, and official institution sources.
- [x] Define the Cogniva Knowledge Component graph and course-to-KC mapping contract independently of the university catalogue.
- [x] Approve the mobile-first and responsive desktop information architecture in [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md).
- [x] Approve optional institution-only onboarding with self-reported and independent-learner paths.
- [x] Add first-slice PostgreSQL integration coverage for country/jurisdiction relationships, version-scoped qualification/classification hierarchies, source-rights gates, typed source assertions, evidence-backed ISCED-P/ISCED-A mappings, and review history.
- [x] Add stacked Phase 1.1b PostgreSQL integration coverage for same-institution units/programmes, scoped recognition decisions, versioned programme and course content, explicit credit-system pairings, academic-period ownership, programme-course requirements, evidence-reviewed Knowledge Component versions/mappings, and prerequisite-cycle rejection.

**Current status (19 November 2026):** Phase 1.1a and 1.1b are merged to `main` (PRs #39 and #41); post-merge CI run [44598472862](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44598472862) passed all 19 steps, including migrations 0000–0008 on isolated PostgreSQL and academic integration/regression tests. Migrations 0007 and 0008 were applied to Neon production by [migration run #44615863935](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44615863935). A subsequent read-only [production schema audit, run #44610442501 attempt 2](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501), confirmed 9/9 migrations applied, no missing migration files or unexpected ledger entries, all 31 Phase 1.1 target tables present, and all nine legacy academic tables preserved. The audit did not inspect learner rows. No catalogue data is seeded; runtime catalogue APIs, source adapters, ingestion and learner-context backfill remain outstanding. See [PHASE_1_1_SCHEMA_AUDIT_AND_MIGRATION_PLAN.md](PHASE_1_1_SCHEMA_AUDIT_AND_MIGRATION_PLAN.md), [PHASE_1_1A_REFERENCE_FOUNDATION.md](PHASE_1_1A_REFERENCE_FOUNDATION.md), and [PHASE_1_1B_INSTITUTIONS_PROGRAMMES_AND_KCS.md](PHASE_1_1B_INSTITUTIONS_PROGRAMMES_AND_KCS.md).

**Exit:** Cogniva's data model supports different education systems without country-specific assumptions; every catalogue claim has traceable provenance and a clear verification state; students can learn without a listed institution; the KC model can connect concepts across different local curricula.

## Phase 1.2 — Optional onboarding and adaptive Home

This implementation step replaces the interim multi-field onboarding form and introduces the authenticated student workspace.

- [x] Reuse the additive onboarding fields from migration `0001_student_onboarding_state.sql` for completion and self-reported institution data; preserve existing profile values. No new migration is needed for Phase 1.2.
- [x] Add an authenticated onboarding endpoint supporting catalogue selection, self-reported institution-not-listed, and skip.
- [x] Replace first-run onboarding with one optional institution question; search the available catalogue and display its stored country metadata without fabricating missing results.
- [x] Route completed students to authenticated Home and incomplete students to onboarding.
- [x] Implement responsive Home with a primary learning entry area, genuine resumable Tutor sessions, and only learner-approved active learning plans. Omit unsupported courses, skills, mastery, and recommendations.
- [x] Add a catalogue-backed Learn view and a working Profile institution editor. Empty catalogue results remain empty.
- [x] Expose Tutor because persisted session APIs and routes exist; keep Progress unavailable until an evidence-backed progress model exists.
- [x] Add automated integration coverage for onboarding choices, account ownership, institution validation, completion routing, self-report isolation, and owner-scoped adaptive Home content.
- [x] Confirm onboarding migration `0001` is included in the verified 9/9 production migration ledger before relying on its columns.

**Current status (19 November 2026):** the first-run institution choice supports selecting a persisted catalogue institution, recording a private self-report, or skipping. Self-reported names are stored only on the learner's profile and never inserted into the shared catalogue. The authenticated Home now displays up to five owner-scoped Tutor sessions in resumable states and up to four active plans with learner-approved revisions. Completed/failed/cancelled sessions and unapproved/draft plans are omitted. When there is no resumable session, the Continue learning section is omitted. A failed Home activity query is shown as unavailable rather than as an empty state. Learn reads the available subject catalogue and the learner's plan library; Profile reuses the institution editor. Tutor is available; Progress remains disabled because no evidence-backed progress model exists. The onboarding columns originate in migration `0001`, which is included in the verified production ledger; this slice adds no DDL. See [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md) and [API.md](API.md).

**Exit:** every signed-in student can choose a catalogue institution, self-report one not listed, or skip and reach Home; self-reports never pollute the global catalogue; Home adapts to real owner-scoped activity without inventing courses, skills, progress or recommendations; Learn and Profile work on mobile and desktop; unfinished capabilities remain explicitly unavailable rather than simulated.

## Phase 2 — Learning Workspace and first Socratic tutoring vertical slice

See [PHASE_2_LEARNING_WORKSPACE.md](PHASE_2_LEARNING_WORKSPACE.md) for the accepted product, data, provider, security, and acceptance contracts.

- [ ] Audit the live database schema and migration history; choose and configure one initial text AI provider before enabling AI features.
- [x] Add and reuse the existing student-owned learning-plan, revision, ordered unit/objective, concept/relation, tutor-session, and message persistence (plan/tutor workspace tables originate in migration `0002`; this implementation introduces no schema change).
- [x] Implement topic-based, structured, versioned plan-generation API and owner-scoped retrieval; validate provider output before transactionally saving a proposed revision.
- [ ] Let learners edit, reorder, and remove plan titles, units, objectives, and concepts; preserve edits and previous revisions.
- [x] Let learners accept/reject proposed concept relationships and approve the latest proposal as an active personal plan.
- [x] Launch a Tutor session directly from an approved learning-plan unit and preserve its plan/unit linkage.
- [x] Apply CTL v1.2 adaptive response modes to linked-unit and standalone Tutor sessions, including explicit hint/simplify/example/recap actions, task switching, centralized policy budgets, and adaptive fallback.
- [ ] Add persisted lesson-stage transitions, explicit teaching controls, and evidence-backed checkpoint records.
- [x] Implement persisted text-first Tutor sessions, history, and resume for plan-unit and direct text starts.
- [ ] Enforce one-step tutoring, clarification-without-advancement, progressive hints, and explicit continuation.
- [x] Connect Home, Learn, plan review, and Tutor to real persisted student-owned records (Home continuation and adaptive activity cards delivered in PR #44; the full mobile journey test remains open).
- [ ] Test provider/database failures, schema validation, idempotency, concurrency, ownership, and responsive behaviour.

**Current boundary:** authenticated Tutor session creation, message persistence, history, resume, and provider-backed responses exist for direct text prompts. Learn now includes a persisted personal learning library, saved plan generation/review states, revision overview, learner decisions on proposed concept relationships, and plan approval. Editing/reordering/removal of plan titles, units, objectives, and concepts remains open. Approved unit cards launch Tutor with revision/unit linkage and server-side ownership plus active/approved checks. CTL v1.2 supplies validated structured openings and adaptive continuations for linked-unit sessions, plus standalone concept mini-lessons, problem-solving walkthroughs, attempt feedback, focused assistance for hints/simplifications/examples/recaps, explicit standalone task switching, and an adaptive fallback. Persisted lesson-stage transitions and server-enforced Tutor action controls remain open. Home continuation from real owner-scoped Tutor sessions and learner-approved active plans was delivered in PR #44; end-to-end mobile journey tests remain open. Plan-scoped generated relationships remain proposals and structural validation does not establish academic correctness.

**Exit:** a learner can start without an institution, generate, review, and approve a personal learning plan, begin a Tutor session from an approved unit, and resume genuine saved work; approved-unit Tutor sessions follow CTL v1 without fabricated stage progress; all AI outputs and failure states are truthful; no official curricula, canonical global KCs, mastery scores, or recommendations are fabricated.

## Phase 2.5 — Academic course and skill organisation

This phase operationalises the global academic foundation in [GLOBAL_ACADEMIC_ARCHITECTURE.md](GLOBAL_ACADEMIC_ARCHITECTURE.md). It is distinct from learner-generated personal plans: official catalogue content must have source provenance and a verification state, while plan-scoped learner concepts remain proposals.

- [ ] Approve and implement governed source adapters for official institution, regulator, programme, course and syllabus sources; record usage/licensing terms and source freshness.
- [ ] Populate institution, programme, academic-period, course and versioned syllabus records from verified source evidence; do not seed illustrative or inferred catalogue entries.
- [ ] Add source assertion and review workflows so catalogue claims retain source URL, observation time, effective dates, rights status, verification status and reviewer provenance.
- [ ] Expose verified course and programme discovery in Learn, including local course codes, credit-system identity, curriculum version and academic period without cross-system credit conversion assumptions.
- [ ] Operationalise the canonical Cogniva Knowledge Component graph with versioned concepts/skills, reviewed relations and acyclic prerequisite constraints.
- [ ] Map course/syllabus versions to Knowledge Components with mapping provenance, confidence, reviewer status and version validity.
- [ ] Add learner-facing course/skill organisation using only verified catalogue records and clearly labelled learner-owned records; keep personal generated learning plans distinct from official curricula.
- [ ] Add integration tests for source rights, provenance, review lifecycle, version validity, mapping confidence, institution/programme scope and course-to-KC consistency.
- [ ] Update mobile and desktop Learn/Home journeys to use real course and skill data with honest empty/unavailable states.

**Exit:** learners can organise and explore real courses and skills across different education systems; catalogue claims are traceable and reviewable; course-to-KC mappings are versioned and evidence-backed; no model-generated outline is presented as an official syllabus or canonical skill.

## Admin Foundation — AI Configuration

This area now includes persisted task/provider/model preferences, audit events, server-side credential-presence reporting, provider-neutral Gemini/Groq/Mistral text adapters, fixed-prompt administrator connection tests, and the persisted administrator benchmark workflow. The text runtime is integrated into the Socratic tutor and personal learning-plan generation routes when each task has a saved provider/model preference and matching server credential. No comparative provider benchmark has been completed, no model has been selected as a winner, and runtime availability is not the same as pedagogical validation. Production schema/deployment state must be verified separately rather than inferred from repository files.

- [x] Define and add persistence for task/provider/model preferences and administrative audit events (migration files 0004 and schema definitions are in the repository; production application must be verified separately).
- [x] Add an admin-only API that returns provider credential-presence booleans, never secret values.
- [x] Add validated admin mutations that write routing preferences and an audit event atomically.
- [x] Add responsive configuration UI for Gemini, Groq, and Mistral, with runtime/configuration state distinguished.
- [x] Implement provider-neutral text-generation adapters and fixed-prompt administrator connection tests.
- [x] Implement the persisted administrator benchmark workflow and blinded-review data model.
- [ ] Run the comparative provider benchmark and complete blinded human rubric review; preserve failed and incomplete evidence.
- [ ] Verify production migration state, configured task routes/credentials, and the deployed learner-facing runtime.

**Exit:** administrators can save per-task provider/model preferences and see actual server-side credential presence; raw keys are never returned or stored in the application database. Learner requests use only the saved route for their task and require the matching server credential, with no silent fallback. No provider is declared best or comparatively validated until a real benchmark and blinded review are complete.

## Phase 1.3 — Adaptive multi-provider, multi-model intelligence

See [PHASE_1_3_ADAPTIVE_AI_RUNTIME.md](PHASE_1_3_ADAPTIVE_AI_RUNTIME.md) for the accepted architecture, provider discovery contracts, model approval lifecycle, and adaptive-routing gates.

### Phase 1.3a — Administrator-managed model registry

- [x] Add an additive model registry for multiple exact model IDs under each supported provider.
- [x] Preserve legacy `ai_task_routes`; backfill its provider/model identities as pending registry records and disabled task candidates.
- [x] Record capability declarations separately from exact-model connection-test outcomes and teaching-quality benchmark evidence.
- [x] Add provider-native model discovery for Gemini, Groq, and Mistral; import only provider-returned identifiers and metadata, leaving unavailable capabilities unknown.
- [x] Add administrator APIs/UI to register, inspect, test, review, enable/disable models, and set task eligibility/priority.
- [x] Require HTTPS capability evidence and a successful exact-model instruction check before a model can be enabled.
- [x] Reuse one bounded, model-aware diagnostic probe policy in both the saved-task-route test and exact-model test.
- [x] Add pure regression tests for capability validation and diagnostic policy selection.
- [ ] Add end-to-end PostgreSQL/API tests for administrator authorization, duplicate registration, evidence invalidation, enablement guards, candidate ownership, and audit events.
- [x] Review migration 0009 SQL/snapshot/journal and apply it to Neon after explicit approval; production migration run #44694889998 succeeded and audit #44695548906 confirmed its ledger entry.
- [x] Run the strict read-only production audit for both registry tables, required columns, enum labels, constraints, and indexes; production run [#44707763879](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44707763879) passed.
- [ ] Verify the deployed Admin model registry and exact-model tests against credentials configured in Render.

**Current status (20 November 2026):** Phase 1.3a introduces `ai_models` and `ai_task_model_candidates`; migration 0009 is applied to Neon. The strict read-only production audit [#44707763879](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44707763879) passed on merge commit `7701f8b`: 10/10 repository migrations, both registry tables, all 26 expected columns, exact enum labels, required named constraints, and indexes match. The audit used a PostgreSQL read-only transaction and did not inspect model rows, credentials, or learner records. Existing `ai_task_routes` remain intact. Phase 1.3b adds a shared adaptive runtime for Tutor and learning-plan generation; each task's rollout mode defaults to pinned until an operator explicitly enables adaptive mode after model readiness checks.

### Phase 1.3b — Adaptive router and centralized runtime policy

- [x] Build a provider-neutral request analyser and deterministic task-complexity classification with conservative prompt/context estimates.
- [x] Select only models that are enabled, credential-ready, connection-tested, capability-reviewed, and assigned to the requested task.
- [x] Add independent per-task pinned/adaptive mode settings, defaulting to pinned.
- [ ] Add administrator UI controls for task routing mode and explicit quality/cost objectives; task mode currently uses server-side environment settings.
- [x] Centralize output budgets, reasoning settings, JSON-object mode, temperature capability gating, context fit, and bounded deadlines.
- [x] Integrate adaptive model selection into Tutor and learning-plan generation.
- [x] Return and retain safe selection explanations without writing routing prompts, completions, credentials, or private reasoning traces to routing metadata.
- [x] Keep provider switching disabled; no silent fallback occurs after a selected provider fails.
- [x] Add routing policy regression tests to CI.
- [ ] Use cost and teaching-quality evidence in selection only after current provider pricing and blinded benchmark evidence exist.
- [ ] Explicitly opt in a production task only after its candidate pool is fully reviewed, tested, enabled, assigned, and validated in the deployed runtime.

**Boundary:** The adaptive path is implemented but remains off by default (`pinned`). Administrator candidate priority is used before exact-model test latency; no unverified cost or quality score is invented.
### Phase 1.3c — Evidence-informed model improvement

- [ ] Run the comparative provider benchmark across eligible models and tasks.
- [ ] Complete blinded human review for teaching quality, structured-plan validity, correctness, and pedagogical fit.
- [ ] Use retained benchmark and production evidence to refine task-specific model priorities.
- [ ] Preserve uncertainty when cost/usage/latency/quality evidence is missing; never auto-promote a model from an unreviewed score.

**Exit:** administrators can manage multiple exact models per provider and task; Cogniva can select an eligible model from verified capability and evidence; generation policies adapt to task/model characteristics within administrator and platform ceilings; decisions are explainable and auditable; the previous pinned route remains available as an explicit rollback mode.

## Phase 3 — Multimodal problem input

- [ ] Add private image upload and structured extraction.
- [ ] Add ambiguity detection and student confirmation.
- [ ] Preserve source input, confirmed transcription, and provenance.
- [ ] Add PDF support after image/text reliability is demonstrated.

**Exit:** uncertain symbols are shown for confirmation; the tutor uses confirmed transcription.

## Phase 4 — Guided learning and feedback

- [x] Persist explicitly submitted learner attempts atomically with their student messages; distinguish attempts from follow-up questions.
- [x] Expose recorded attempt history and evaluation status without implying correctness or mastery.
- [x] Add explicit production regressions for chained-equality arithmetic false positives, answer-only submissions, and malformed piecewise mathematical notation.
- [x] Add a concise AI-limitations notice and describe `not_evaluated` as `Not independently verified` in the learner-facing Tutor UI.
- [x] Normalize common provider math delimiters through one shared, safe Markdown/KaTeX renderer, preserving code and stored source text.
- [x] Persist student attempts before evaluation.
- [x] Add evidence-bounded arithmetic mismatch classification and correction guidance; do not infer the learner's cognitive cause.
- [x] Add supported numeric answer/pair checks with explicit verification provenance and documented notation limits.
- [ ] Add session summaries, alternative explanations, worked examples, and complete recovery/continuation tests. Saved session history/resume exists, but these richer learning aids are not yet implemented.

**Exit:** full mathematics vertical slice passes, including incorrect attempt, correction, and resume.

## Phase 5 — Subject reasoning and verification

- [ ] Define subject adapter and capability registry.
- [ ] Implement supported mathematical verification.
- [ ] Add other subjects incrementally and benchmark each capability.
- [ ] Sandbox code execution with explicit time, memory, and network limits.

**Exit:** every enabled capability has tests, documented limitations, and evidence-based support claims.

## Phase 6 — Learning intelligence and adaptive practice

This is Cogniva's native adaptive learning capability. The canonical Knowledge Component graph and verified course mappings are prerequisites delivered in Phase 2.5.

- [ ] Map reviewed learner-plan concepts to canonical Knowledge Components with provenance, mapping confidence, and review status, reusing the course/syllabus mappings delivered in Phase 2.5.
- [ ] Record diagnostic assessment, practice attempts, and evaluation evidence.
- [ ] Select targeted practice based on the student's demonstrated gaps and prerequisite readiness.
- [ ] Implement mastery estimates with uncertainty, evidence windows, and model/version provenance.
- [ ] Recommend advancement, reinforcement, or prerequisite review with an explanation.
- [ ] Evaluate adaptive sequencing and learning outcomes against reviewed tasks and real student attempts.

**Exit:** every adaptive recommendation is traceable to a Knowledge Component mapping and learning evidence; mastery displays its uncertainty and supporting evidence; the engine works with institution-based and independent learning contexts.

## Phase 7 — Academic resources

- [ ] Add secure document processing, extraction, chunking, embeddings, and retrieval.
- [ ] Cite uploaded document page/section/chunk locations.
- [ ] Add durable processing jobs and deletion of original/derived data.

**Exit:** answers distinguish document-grounded claims from general subject knowledge.

## Phase 8 — Product readiness

- [ ] Complete accessibility, mobile, security, privacy, and reliability review.
- [ ] Run end-to-end and AI evaluation suites.
- [ ] Add rate limits, usage controls, backups, and operational dashboards.
- [ ] Conduct closed beta and resolve evidence-backed defects.

**Exit:** release thresholds and support procedures are met.

## Definition of Done

A feature is complete only with an accepted capability boundary, runtime validation, ownership/security checks, persistence/failure semantics, appropriate tests, safe observability, accessible UI states, documentation, and compliance with [ZERO_MOCK.md](ZERO_MOCK.md).
