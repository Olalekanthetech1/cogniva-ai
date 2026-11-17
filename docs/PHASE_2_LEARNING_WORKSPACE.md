# Cogniva — Phase 2 Learning Workspace v1

**Status:** Product and engineering scope to approve before implementation. This document defines intended behaviour; it is not evidence that the workspace, plan generation, or tutor is live.

## 1. Goal

Deliver the first real learning journey after account setup:

**Choose what to learn → review a proposed plan → study with the Socratic tutor → save and resume.**

The workspace must work for institution-based students and independent learners. A selected institution is optional and must not control access to learning.

Phase 2 is one connected vertical slice, not a collection of disconnected dashboard cards. The Home composer, Learn library, learning-plan review, and Tutor session must use the same persisted student-owned records.

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

- Become the learner's personal learning library.
- Show saved plans with truthful states such as draft, approved, active, completed, or failed where those states are implemented.
- Allow the learner to start a new learning plan.
- Keep any public/catalogue subject discovery distinct from the learner's personal plans.
- Show a clear empty state when the learner has not created a plan.

### Plan review and overview

- Show the proposed outline and plan-level concept/skill structure.
- Clearly distinguish generated proposals from learner-approved content and authoritative external curricula.
- Support the edits listed in section 2.3.
- Provide an action to begin a tutoring session from a selected unit.

### Tutor

- Show real active and previous sessions.
- Resume from the persisted state, not from a reconstructed or fabricated conversation.
- Keep interaction controls explicit: explain why, hint, simplify, example, continue, repeat, and end.
- Do not expose answer-checking controls unless a subject verifier for the current task is actually available.

### Progress

Progress analytics and mastery estimates remain unavailable until the evidence model exists. Phase 2 may show factual session history or plan state where it is supported by persisted records, but must not display mastery scores, streaks, completion rates, or recommendations without defined evidence and calculations.

## 4. Provider and generation requirements

The repository currently contains provider environment-variable placeholders but no implemented AI provider adapter or SDK integration. Before enabling plan generation or tutoring:

1. Select and configure one initial provider/model for the first supported text workflow.
2. Implement a provider-neutral request boundary and structured output validation.
3. Version prompts and output schemas.
4. Bound input/output size, request duration, and usage; record the actual provider/model and prompt version.
5. Handle unavailable, rate-limited, invalid, and timed-out responses explicitly.
6. Do not silently switch to an unconfigured provider or return hardcoded content as a fallback.

If the required provider is not configured or unavailable, preserve the learner's input and display an actionable unavailable/failed state. Do not create a successful plan or session step.

Generated plan content must pass runtime schema validation before it is saved or shown as a completed proposal. Enforce limits on the number and length of units, concepts, objectives, and relationships.

## 5. Data and security requirements

The implementation must review the live schema and existing migrations before proposing new tables. Use additive, reviewed migrations and preserve all existing profile and academic catalogue data.

The data model is expected to represent, at minimum:

- student-owned learning plans and their status/version;
- ordered plan units;
- plan-scoped concepts/skills, learning objectives and proposed prerequisite edges;
- tutoring sessions linked optionally to a plan/unit;
- persisted tutor messages, current state/step, and concurrency version;
- provider/model and prompt/schema provenance for generated content.

Exact table names and normalisation are implementation decisions to be made after the schema audit; this list is the domain contract, not permission to add guessed or duplicate columns.

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

1. **Schema and provider audit** — inspect deployed schema/migration history; select the initial text provider; document provider configuration, output contracts, and failure behaviour.
2. **Persistence foundation** — add reviewed student-owned plan, unit, concept, session, and message persistence with ownership and concurrency tests.
3. **Plan generation** — create a topic-based proposed plan from real learner input; validate and persist structured output; preserve provider failures.
4. **Plan review UI** — edit, reorder, remove, and approve plan content; verify persistence after refresh.
5. **Tutoring engine** — create/resume text sessions from a plan unit or direct question/problem; enforce Socratic step and continuation invariants.
6. **Workspace integration** — connect Home, Learn, plan overview, and Tutor to real saved records; remove unavailable states only when their end-to-end path is live.
7. **Release verification** — run CI, ownership/integration and state-machine tests, mobile/desktop checks, provider failure tests, and production migration/deployment verification.

Each implementation change should be a focused pull request. Production migrations must be reviewed and explicitly applied before application code that depends on their columns or tables is deployed.

## 8. Phase 2 acceptance criteria

Phase 2 is complete only when all of the following are demonstrated:

- A signed-in learner can start from a topic, concept question, or text problem without an institution.
- Topic-plan generation uses a configured provider and returns schema-valid, clearly labelled proposed content.
- A learner can edit and approve a plan; changes survive refresh and sign-in.
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
