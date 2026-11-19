# Cogniva — Phase 2 Learning Workspace v1

**Status:** Accepted product/engineering contract; implementation is partial. Persistence and the text-first Tutor vertical slice exist. Learn includes a personal plan library, read-only plan overview, learner review of suggested relationships, approval, and CTL v1.1 adaptive instructional modes for approved-unit and standalone tutoring. Editing, Home continuation, persisted lesson-stage controls, and the full integrated learner workspace are not yet delivered.

## 1. Goal

Deliver the first real learning journey after account setup:

**Choose what to learn → review a proposed plan → study with the Socratic tutor → save and resume.**

The workspace must work for institution-based students and independent learners. A selected institution is optional and must not control access to learning.

Phase 2 is one connected vertical slice, not a collection of disconnected dashboard cards. The Home composer, Learn library, learning-plan review, and Tutor session must use the same persisted student-owned records.

### Current implementation status

- **Already implemented:** student-owned plan/revision/unit/objective/concept persistence; saved tutor sessions/messages and direct text tutor UI; authenticated tutor session APIs; provider-backed Socratic responses when the task route and credential are configured; explicit attempt persistence and bounded numeric evaluation.
- **Added by the API implementation:** authenticated personal plan creation from a learner topic, strict provider-output validation, transactional proposed-revision persistence, owner-scoped plan listing/detail, and retry for failed/unavailable/stale-running generation.
- **Added by the Learn UI implementation:** a personal learning library that creates topics through the real API, lists owner-scoped saved plans, displays generation/review states, opens a read-only revision overview, and retries failed or unavailable generation without automatic create-request replay.
- **Added by the review/approval slice:** a learner can accept or reject each proposed concept relationship and approve the latest proposed revision. Approval transactionally changes the revision to `approved` and the parent plan to `active`, guarded by ownership and an optimistic plan version. A plan cannot be approved while suggested relationships remain undecided.
- **Implemented in this slice:** launching Tutor from an approved plan unit; the launch form seeds a learner-editable prompt with unit details/objectives/concepts and sends revision/unit references. Session creation validates ownership and requires the linked revision and plan to be approved/active. CTL v1.1 keeps the linked-unit structured opening and adaptive continuation, and extends mode routing to standalone concept mini-lessons, problem-solving walkthroughs, attempt feedback, and quick clarifications. Output limits and mode-specific contracts are validated, and framework version/mode are recorded in tutor-message metadata.

- **Still outstanding:** editing/reordering/removal of titles, units, objectives, and concepts; Home dashboard continuation from saved plans; persisted lesson-stage transitions; explicit Socratic action controls and server-enforced step progression; diagnostic assessment records; and end-to-end mobile journey tests.

The API foundation is not a substitute for these remaining UI and tutoring-state requirements.

## 2. Product decisions

### 2.1 Three starting intents

The learner can begin with one of these text-first intents:

1. **Learn a topic** — for example, a topic or subject area the learner wants to understand.
2. **Understand a concept** — for a focused concept or a question about an idea.
3. **Solve a problem** — for a specific problem the learner wants to work through.

The learner's own text is the source input. Do not require institution, course code, programme, year of study, or a catalogue match. Optional context such as desired depth or learning goal may be requested after the learner starts, but must not become a blocking questionnaire.

Image, PDF, and document input are not part of this first release; they require the separate secure multimodal/document pipeline.

### 2.2 A generated plan is a personal learning plan

When the learner chooses a topic, Cogniva may generate a **proposed personal learning plan** containing:

- a clear plan title and short purpose;
- ordered learning units or sections;
- concepts and skills covered by each unit;
- measurable learning objectives;
- suggested prerequisite relationships, where the model has a defensible basis;
- a suggested order for studying the units.

This is a Cogniva-generated study structure, not an official course, approved university syllabus, accreditation statement, or guaranteed complete curriculum. The UI must label it as a proposal until the learner reviews and approves it.

A direct concept question or problem may open a tutoring session without forcing the learner to create a multi-unit plan.

### 2.3 Review and learner control

Before a generated plan is treated as the learner's active study structure, the learner can:

- edit the title and descriptions;
- rename, reorder, or remove proposed units;
- edit objectives and concept labels;
- accept or reject suggested prerequisite links;
- approve the plan or leave it as a draft.

Persist edits. Do not silently replace a learner-edited outline when regenerating content. A regeneration must create a reviewable revision and preserve the previous approved version.

### 2.4 Plan-level concepts are not yet global Knowledge Components

Phase 2 may display a useful **concept-and-skill map** inside an individual learning plan. These nodes and their relationships are plan-scoped proposals derived from the learner's input and the generated outline.

They must not be presented as canonical Cogniva Knowledge Components, verified prerequisites, or globally standardised skills. The canonical cross-course Knowledge Component graph, provenance-backed curriculum mappings, and adaptive mastery model remain later learning-intelligence work.

This distinction allows students to see and edit the structure of what they are studying now without prematurely turning model-generated text into global academic knowledge.

### 2.5 Socratic tutoring and continuity

A learner can start a session from a plan unit or directly from a question/problem. The text-first tutor must:

- guide the learner through one meaningful step at a time;
- explain the current step when asked;
- provide progressive hints;
- simplify an explanation or give a relevant example when supported;
- preserve the current step during clarification;
- advance only after an explicit valid continuation;
- save the session and allow the learner to resume it after navigation or sign-in.

Persist the actual learner input, tutor messages, current step/state, session version, provider/model and prompt version where applicable. Do not invent a session history or use a canned answer when a provider fails.

Basic text tutoring is not the same as independent answer verification. Until a supported verifier exists, Cogniva must not label an answer as mathematically or factually verified.

## 3. Main screens and responsibilities

### Home

- Retain the agreed mobile-first Home visual structure and responsive desktop adaptation.
- Enable the primary learning composer only when the end-to-end creation path is available.
- Offer the three starting intents without duplicating subject discovery.
- Show Continue Learning only from genuine resumable plans or sessions owned by the signed-in learner.
- Never show fixed sample subjects, empty placeholder progress percentages, invented recommendations, or fake recent activity.

### Learn

- Show the learner's owner-scoped personal learning library on the Learn route.
- List saved plans with their actual generation state and latest revision state; never infer completion or mastery.
- Allow the learner to start a topic-based plan through the authenticated generation API and retry failed/unavailable generation.
- Open the saved revision overview showing units, objectives, plan-scoped concepts, and proposed relationships.
- Let the learner accept or reject each proposed relationship and approve the latest revision after all suggestions have a recorded decision.
- Keep catalogue subject discovery distinct from the learner's personal plans and show a truthful empty state when no catalogue records exist.
- Editing, reordering, and removing plan content remain unavailable until their mutation APIs and controls are implemented.

### Plan review and overview

- Show the latest proposed outline and plan-level concept/skill structure in the revision overview.
- Let learners explicitly accept or reject suggested concept relationships and approve the plan when every suggestion has been reviewed.
- Clearly distinguish generated proposals from learner-approved content and authoritative external curricula.
- Editing, reordering, and removing units/objectives/concepts remain outstanding.
- Plan approval is implemented. Starting a tutoring session from a selected approved unit is now implemented; unit launch is unavailable for draft or unapproved plans.

### Tutor

Linked-unit and standalone Tutor sessions follow [Cogniva Tutor Learning Framework v1.1](TUTOR_LEARNING_FRAMEWORK.md). Linked units use a structured lesson opening followed by adaptive continuation. Standalone concept/topic sessions use a concept mini-lesson; problem sessions use a structured problem-solving walkthrough; explicit attempts receive feedback that preserves valid reasoning; later clarifications and correction challenges receive concise direct responses. The current implementation does not persist lesson-stage completion or mastery.

- Show real active and previous sessions.
- Resume from the persisted state, not from a reconstructed or fabricated conversation.
- Approved plan-unit sessions use CTL v1.1 structured lesson openings and adaptive continuations.
- Standalone concept/topic sessions use a direct explanation, example, and understanding checkpoint; problem sessions use a governing principle, strategy, worked reasoning, verification, and transfer check.
- Attempts and clarifications route to their respective feedback modes; uncertain intent falls back to adaptive Socratic dialogue.
- Explicit explain-why, hint, simplify, example, continue, and repeat controls with server-enforced stage transitions remain future work.
- Do not expose answer-checking controls unless a subject verifier for the current task is actually available.

### Progress

Progress analytics and mastery estimates remain unavailable until the evidence model exists. Phase 2 may show factual session history or plan state where it is supported by persisted records, but must not display mastery scores, streaks, completion rates, or recommendations without defined evidence and calculations.

## 4. Provider and generation requirements

The repository contains a provider-neutral server-side text-generation adapter in `apps/web/lib/ai-provider-runtime.ts`, plus administrator-managed task/provider/model preferences. The tutor response route already uses the `socratic_tutor_response` route. This implementation uses `learning_plan_generation` for topic-based plan generation. Before a task can run, an administrator must save an exact provider/model route and configure the matching server-side credential.

1. Use the administrator-configured provider/model for the task; do not hardcode a universal default or winner.
2. Validate generated structured output before saving it.
3. Version prompts and output schemas.
4. Bound input/output size, request duration, and usage; record the actual provider/model and prompt version.
5. Handle unavailable, rate-limited, invalid, truncated, and timed-out responses explicitly.
6. Do not silently switch to an unconfigured provider or return hardcoded content as a fallback.

No comparative provider benchmark has been completed. A successful provider connection test is not evidence of pedagogical quality.

If the required provider is not configured or unavailable, preserve the learner's input and display an actionable unavailable/failed state. Do not create a successful plan or session step.

Generated plan content must pass runtime schema validation before it is saved or shown as a completed proposal. Enforce limits on the number and length of units, concepts, objectives, and relationships.

## 5. Data and security requirements

The implementation must review the live schema and existing migrations before proposing new tables. Use additive, reviewed migrations and preserve all existing profile and academic catalogue data.

The existing Drizzle schema and migration `0002_futuristic_alex_power.sql` already define `learning_plans`, `learning_plan_revisions`, `learning_plan_units`, `learning_plan_objectives`, `learning_plan_concepts`, `learning_plan_unit_concepts`, `learning_plan_concept_relations`, `tutor_sessions`, and `tutor_messages`.

The plan generation API in this implementation reuses those structures without a new migration. Generated relationships are stored with review status `proposed`; plan-scoped nodes are not global Knowledge Components. Tutor attempts are represented separately by `tutor_attempts` in migration `0006_cultured_lila_cheney.sql`; attempt status records that a supported evaluation ran, not mastery.

Do not add duplicate plan tables or guessed columns. Any future schema change must be additive, generated, reviewed, and explicitly applied before dependent application code is deployed.

Security and reliability requirements:

- Derive student ownership from the authenticated session on the server.
- Enforce ownership on every read and mutation; never trust a client-supplied student/user ID.
- Use transactions for related database state changes and optimistic concurrency/version checks for session transitions.
- Make retriable writes idempotent.
- Do not hold a database transaction open while waiting for an external AI provider.
- Preserve student input when generation or tutoring fails.
- Redact secrets and unnecessary personal content from logs.
- Keep generated plans distinct from official catalogue course/curriculum records.

## 6. Explicit non-goals for v1

Do not include these in the first Learning Workspace release:

- image, PDF, or lecture-note uploads;
- document extraction, embeddings, vector search, or source-page citations;
- automatic import of institution syllabi or global university catalogue expansion;
- canonical global Knowledge Component ingestion or unreviewed global prerequisite edges;
- mastery percentages, streaks, rankings, or adaptive recommendations;
- claims of independent answer verification without a supported verifier;
- public/shared learning plans or social/community features;
- a dependency on Sizzle AI, CampusLearn, or another external learning platform.

These capabilities may be planned separately after their data, privacy, evidence, and operational requirements are defined.

## 7. Delivery sequence

Implement and verify one vertical slice at a time:

1. **Schema and provider audit** — review the existing Drizzle schema/migrations and verify production migration history; confirm task-specific provider routing and credential requirements. No provider is preselected by code.
2. **Persistence foundation** — existing plan, revision, unit, concept, tutor-session, and message tables are reused; no duplicate tables are introduced by this implementation.
3. **Plan generation API** — create a topic-based proposed plan from real learner input; validate strict structured output; preserve failures and generation provenance. This implementation covers this API slice.
4. **Plan review UI** — relationship decisions and revision approval are implemented with owner checks and optimistic concurrency. Still required: edit, reorder, and remove plan content while preserving historical/approved revisions.
5. **Tutoring integration** — existing direct text sessions can be resumed; still required: start/resume sessions from plan units and enforce explicit Socratic actions and step progression.
6. **Workspace integration** — the Learn personal library and read-only plan overview now use owned plan APIs; still required: Home continuation, plan-unit-to-Tutor navigation, and completion of the end-to-end learner journey.
7. **Release verification** — run CI, ownership/integration and state-machine tests, mobile/desktop checks, provider failure tests, and production migration/deployment verification.

Each implementation change should be a focused pull request. Production migrations must be reviewed and explicitly applied before application code that depends on their columns or tables is deployed.

## 8. Phase 2 acceptance criteria

Phase 2 is complete only when all of the following are demonstrated:

- A signed-in learner can start from a topic, concept question, or text problem without an institution.
- Topic-plan generation uses a configured provider and returns schema-valid, clearly labelled proposed content.
- A learner can accept/reject proposed relationships and approve a plan; decisions and active/approved state survive refresh and sign-in.
- A learner can edit, reorder, and remove plan content while preserving prior revisions (not yet implemented).
- Generated plans remain personal learning records and never masquerade as official institution curricula.
- Plan-level concepts and prerequisites are visibly proposals, not canonical global KCs or verified facts.
- A learner can start a text tutoring session from a plan unit or directly from a question/problem.
- Sessions and messages are persisted and can be resumed.
- Clarification, hints, simplification, and examples do not silently advance the current step; only explicit valid continuation advances.
- Provider, database, validation, and concurrency failures preserve learner input and produce truthful failure/unavailable states.
- Every plan and session query/mutation enforces account ownership.
- Home, Learn, and Tutor show only persisted records; no synthetic courses, progress, or recommendations appear.
- CI, integration tests, and mobile/desktop production checks pass.

## 9. Relationship to later phases

- Phase 3 expands problem input to images and ambiguity confirmation.
- Phase 4 adds durable attempts, richer error analysis, supported answer checking, correction guidance, summaries, and recovery.
- Phase 5 expands subject-specific reasoning and deterministic verification.
- Phase 6 introduces canonical Cogniva Knowledge Components, curriculum mappings, evidence-based mastery estimates, adaptive practice, and explainable recommendations.
- Phase 7 introduces secure document processing and source-grounded retrieval.

The workspace built in Phase 2 must leave these capabilities possible without claiming that they already exist.
