# Cogniva — Implementation Plan

**Status:** Sequenced roadmap; completion is based on tested behaviour, not document presence.

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
- [x] Verify registration, email verification, sign-in, and authenticated session retrieval end-to-end.
- [ ] Verify sign-out and password reset end-to-end.
- [x] Implement authenticated student-profile and read-only academic catalogue APIs with account ownership and academic hierarchy checks.
- [ ] Add automated integration tests for authentication boundaries, profile ownership, and invalid academic hierarchy submissions.

**Exit:** live identity and persistence flows work against a real database; academic metadata is dynamic and optional; CI tests cover access boundaries.

## Phase 1.1 — Global academic interoperability

This design step precedes further academic-catalogue implementation. See [GLOBAL_ACADEMIC_ARCHITECTURE.md](GLOBAL_ACADEMIC_ARCHITECTURE.md) and [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md).

- [x] Approve the global academic domain model and distinguish institution identity, recognition, programme, course, curriculum version, local academic stage, ISCED mapping, and Knowledge Components.
- [ ] Audit the live schema and applied migration; produce an additive migration and rollback plan before changing production tables.
- [ ] Define country/jurisdiction, qualification-framework, ISCED-P/ISCED-A, and ISCED-F mappings without treating local labels as universal.
- [ ] Define institution identifiers, flexible institution-unit hierarchy, recognition evidence, and source provenance.
- [ ] Define programmes, programme versions, academic periods, course requirements, and versioned course syllabi.
- [ ] Define global source adapters and terms/usage checks for ISO, UNESCO, ROR, OpenAlex, WHED/IAU, regulators, and official institution sources.
- [ ] Define the Cogniva Knowledge Component graph and course-to-KC mapping contract independently of the university catalogue.
- [x] Approve the mobile-first and responsive desktop information architecture in [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md).
- [x] Approve optional institution-only onboarding with self-reported and independent-learner paths.
- [ ] Add integration tests for source provenance, verification-state boundaries, and cross-jurisdiction academic relationships.

**Exit:** Cogniva's data model supports different education systems without country-specific assumptions; every catalogue claim has traceable provenance and a clear verification state; students can learn without a listed institution; the KC model can connect concepts across different local curricula.

## Phase 1.2 — Optional onboarding and adaptive Home

This implementation step replaces the interim multi-field onboarding form and introduces the authenticated student workspace.

- [ ] Add an additive migration for onboarding completion and self-reported institution data; preserve all existing profile values.
- [ ] Add an authenticated onboarding endpoint supporting catalogue selection, self-reported institution-not-listed, and skip.
- [ ] Replace first-run onboarding with one optional institution question and global search results that show source-provided country metadata.
- [ ] Route completed students to an authenticated Home dashboard and incomplete students to onboarding.
- [ ] Implement responsive Home with a primary learning entry area and truthful capability availability.
- [ ] Add a real catalogue-backed Learn view and a working Profile institution editor.
- [ ] Display Tutor and Progress as unavailable until the respective session and evidence models exist; do not simulate functionality.
- [ ] Add automated tests for onboarding choices, account ownership, institution validation, and completion routing.
- [ ] Apply the reviewed migration to production before deploying application code that uses its new columns.

**Exit:** every signed-in student can choose an institution, self-report one not listed, or skip and reach Home; institution self-reports never pollute the global catalogue; the Home shell and Learn/Profile routes work on mobile and desktop; unfinished capabilities are explicitly unavailable rather than simulated.

## Phase 2 — Learning Workspace and first Socratic tutoring vertical slice

See [PHASE_2_LEARNING_WORKSPACE.md](PHASE_2_LEARNING_WORKSPACE.md) for the accepted product, data, provider, security, and acceptance contracts.

- [ ] Audit the live database schema and migration history; choose and configure one initial text AI provider before enabling AI features.
- [x] Add and reuse the existing student-owned learning-plan, revision, ordered unit/objective, concept/relation, tutor-session, and message persistence (plan/tutor workspace tables originate in migration `0002`; this implementation introduces no schema change).
- [x] Implement topic-based, structured, versioned plan-generation API and owner-scoped retrieval; validate provider output before transactionally saving a proposed revision.
- [ ] Let learners edit, reorder, and remove plan titles, units, objectives, and concepts; preserve edits and previous revisions.
- [x] Let learners accept/reject proposed concept relationships and approve the latest proposal as an active personal plan.
- [x] Launch a Tutor session directly from an approved learning-plan unit and preserve its plan/unit linkage.
- [x] Apply CTL v1 structured lesson openings and adaptive continuation to approved-unit Tutor sessions; retain concise Socratic mode for direct questions and problems.
- [ ] Add persisted lesson-stage transitions, explicit teaching controls, and evidence-backed checkpoint records.
- [ ] Implement resumable text-first Socratic sessions from a plan unit or direct question/problem.
- [ ] Enforce one-step tutoring, clarification-without-advancement, progressive hints, and explicit continuation.
- [ ] Connect Home, Learn, plan review, and Tutor to real persisted student-owned records.
- [ ] Test provider/database failures, schema validation, idempotency, concurrency, ownership, and responsive behaviour.

**Current boundary:** tutor session creation, history, resume, and provider-backed responses already exist for direct text prompts. The Learn route now includes a persisted personal learning library: learners can create topic plans, see their saved generation/review states, inspect generated proposals in a read-only overview, and retry failed or unavailable generation. This is not full plan review or approval. Plan title/unit/objective/concept editing and reordering/removal, plan-unit-to-Tutor navigation, explicit Socratic controls/step advancement, Home continuation, and end-to-end mobile journey tests remain open. Learners can now accept/reject each proposed relationship and approve the latest generated revision; approval sets the plan active but does not validate its academic correctness. Approved unit cards expose a Tutor start form seeded with unit objectives/concepts and send the approved revision/unit IDs; the session-creation API enforces ownership and active-approved status. CTL v1 supplies a validated structured lesson opening (objectives, detailed explanation, worked example, practical application, guided practice) and adaptive continuation instructions for linked-unit sessions. Lesson-stage transitions and explicit stage controls remain unimplemented. The generated relationship graph is a revision-scoped proposal; structural validation does not prove its academic correctness.

**Exit:** a learner can start without an institution, generate and edit a personal learning plan, begin a text tutoring session from a plan unit, and resume genuine saved work; approved-unit Tutor sessions follow CTL v1 without fabricated stage progress; all AI outputs and failure states are truthful; no official curricula, canonical global KCs, mastery scores, or recommendations are fabricated.

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

## Phase 3 — Multimodal problem input

- [ ] Add private image upload and structured extraction.
- [ ] Add ambiguity detection and student confirmation.
- [ ] Preserve source input, confirmed transcription, and provenance.
- [ ] Add PDF support after image/text reliability is demonstrated.

**Exit:** uncertain symbols are shown for confirmation; the tutor uses confirmed transcription.

## Phase 4 — Guided learning and feedback

- [x] Persist explicitly submitted learner attempts atomically with their student messages; distinguish attempts from follow-up questions.
- [x] Expose recorded attempt history and evaluation status without implying correctness or mastery.
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

This is Cogniva's native CampusLearn/Sizzle-inspired learning capability; it is not an integration dependency on CampusLearn.

- [ ] Implement the canonical Cogniva Knowledge Component graph and prerequisite relationships.
- [ ] Map course/syllabus versions and reviewed learning-plan concepts to Knowledge Components with provenance, mapping confidence, and review status.
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
