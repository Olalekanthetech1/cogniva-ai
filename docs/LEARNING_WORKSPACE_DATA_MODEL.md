# Cogniva — Learning Workspace Data Model

**Status:** Implemented Drizzle schema. The seven personal-plan tables and tutor session/message tables are included in migration `0002_futuristic_alex_power.sql`; the project owner previously confirmed migration history through `0003_lean_gateway.sql` on Neon. The current repository also contains later migrations; do not infer their production application from file presence alone. The plan-generation API in this implementation uses the existing `0002` plan structures and adds no migration.

## 1. Design boundaries

The Learning Workspace uses three distinct layers:

1. **Learning plan container** — a private, student-owned record representing what the learner wants to study.
2. **Plan revision** — a versioned outline that can be proposed, edited, approved, rejected, and preserved when a later revision is generated.
3. **Tutor session** — a resumable, student-owned guided learning conversation, optionally linked to a specific plan revision and unit.

A personal learning plan is not an institution's official course or curriculum. Plan concepts and prerequisite edges are scoped to a revision; they are not canonical Cogniva Knowledge Components and must not be presented as verified global skills.

## 2. Tables

| Table | Responsibility |
|---|---|
| `learning_plans` | Owner, starting intent/input, plan lifecycle, generation state, optimistic version |
| `learning_plan_revisions` | Revision number, title/summary, source input, review status, provider/model and prompt/schema provenance |
| `learning_plan_units` | Ordered study units within a revision |
| `learning_plan_objectives` | Ordered learning objectives belonging to a unit |
| `learning_plan_concepts` | Revision-scoped concepts and skills |
| `learning_plan_unit_concepts` | Many-to-many mapping between units and revision-scoped concepts |
| `learning_plan_concept_relations` | Proposed or learner-reviewed prerequisite, related-to, and part-of edges |
| `tutor_sessions` | Owner, initial prompt, optional plan/unit links, state, current step index and version |
| `tutor_messages` | Ordered student/tutor messages and tutor-generation provenance |

Better Auth continues to own account identity and authentication sessions. Cogniva tutor sessions are a separate learning-domain concept.

## 3. Key invariants

- Every plan and tutor session has a Better Auth student owner.
- Every plan revision belongs to one plan; revision numbers are unique within that plan.
- Every unit, objective, concept, relation, and unit-concept association belongs to a specific revision.
- Composite foreign keys on unit-concept and concept-relation records prevent cross-revision edges.
- Unit, objective, concept, and message ordering is unique within its parent.
- Empty prompts, titles, objectives, and message bodies are rejected by database checks where applicable.
- Plan revisions preserve proposed/approved/rejected states and generation provenance. Regeneration creates a new revision rather than overwriting a learner-edited or approved revision.
- Proposed relation edges remain marked `proposed` until reviewed. They are not asserted as verified prerequisites.
- Tutor session `version` supports optimistic concurrency; an API mutation must compare the expected version and increment it atomically.
- A tutor message written by Cogniva must record provider, model, and prompt version. Student messages must not claim AI provenance.
- Server queries must enforce ownership from the authenticated session. Foreign keys alone do not authorise access.
- When starting a session from a plan, the server must verify that the plan revision and unit belong to the signed-in student and to one another.
- Explicit learner attempts are persisted separately in `tutor_attempts` (introduced by migration `0006_cultured_lila_cheney.sql`) and linked to the owning student, session, and source message. A bounded deterministic evaluation may mark an attempt `evaluated`; that status does not imply whole-solution correctness or mastery.

## 4. Generation and failure semantics

The plan container records the actual generation state: `pending`, `running`, `succeeded`, `failed`, or `unavailable`. The generation API in this implementation claims the plan with a conditional state update, uses a two-minute lease to recover an abandoned `running` state, and does not hold a database transaction open while waiting for a provider. Provider or validation failures must not create a valid plan revision. The original learner input remains stored on the plan so the learner can retry without re-entering it.

Each generated revision records the actual provider/model, prompt version, output schema version, and generation time. The generation route must runtime-validate structured output and enforce limits before writing revision and child records in a transaction. Do not infer a provider or report success from an unvalidated response.

## 5. Tutor state and messages

The initial state enum covers the intended tutoring lifecycle, including interpretation, confirmation, guiding, awaiting a student attempt, explaining, correction, completion, failure, and cancellation. Text-only v1 may not use every state, but the enum does not activate image/document capabilities.

Each message has a monotonically increasing sequence number unique within its session. Session state, step index, version, and message writes must be changed transactionally. Do not hold a database transaction open while waiting for an AI provider. Generation retries use an owner-scoped conditional state claim and lease. Initial plan creation is not yet deduplicated by an idempotency key; clients must not automatically replay that create request after a network timeout. Add durable create-request deduplication before enabling automated client retries.

Clarification, hints, simplification, and examples must preserve the current step. Only a valid explicit continuation advances it.

## 6. Deliberately deferred tables and features

This schema does not introduce canonical global `knowledge_components`, curriculum-to-KC mappings, student mastery estimates, or document/vector tables. The existing tutor-attempt record is evidence of a submitted response and its bounded evaluation lifecycle; it is not a diagnostic assessment model or mastery estimate. Add global knowledge, progress, and document structures only after their provenance, verification, privacy, and evaluation contracts are implemented.

## 7. Migration and release order

1. Review the Drizzle schema and run CI.
2. Run **Generate Neon database migrations** with `GENERATE`; this generates and commits SQL plus journal/snapshot changes without connecting to Neon.
3. Inspect the exact generated SQL and confirm it contains only intended additive enum/table/index/constraint additions, with no destructive operations or changes to existing profile/catalogue records.
4. Only after review, run **Apply Neon database migrations** with `APPLY`; this workflow applies already-committed SQL and does not generate migrations.
5. Verify the apply workflow result and database readiness.
6. Deploy application routes/pages that use the new tables only after the migration has succeeded.
7. Verify ownership boundaries, plan revision persistence, message ordering, and session concurrency.

Never deploy application code that queries these tables before their migration has been applied.
