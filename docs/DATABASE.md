# Cogniva — Database Design Baseline

**Status (reviewed 19 November 2026):** Migrations 0000–0008 are applied to Neon `neondb` (PostgreSQL 18.7). The post-migration read-only audit generated at 21:19:06 UTC ([run #44610442501, attempt 2](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501)) confirmed 9/9 expected migrations applied, zero missing migrations or repository files, zero unexpected applied migrations, all 31 Phase 1.1 target tables present, and all nine legacy academic tables preserved. The audit used a PostgreSQL `READ_ONLY_TRANSACTION` and inspected migration/schema metadata only, not learner rows. Application deployment state is tracked separately.

## 1. Decisions

- PostgreSQL is the transactional source of truth.
- Drizzle ORM provides typed schema and query access.
- The `@cogniva/database` workspace package owns schema, migrations, and connection construction.
- The connection factory accepts a URL explicitly and does not open a connection merely by importing the package.
- A separate migration URL may be used for a direct PostgreSQL connection when the application uses a pooled URL.
- Better Auth owns user identity, credentials, verification records, and authentication sessions; Cogniva academic/profile, learning, and administrative configuration records remain in separate application tables.

Drizzle uses the `postgres.js` driver in this repository. The connection factory supports managed PostgreSQL providers such as Neon.

## 2. Existing schema groups

### Better Auth identity

- `user`: display name, unique email, verification state, profile image, role/ban metadata, timestamps.
- `session`: authentication session token, expiry, user association, optional device metadata and administrator impersonation reference.
- `account`: authentication provider/account link and credential/token fields.
- `verification`: email and other verification challenges with expiry.

### Academic catalogue and student profile

The academic schema contains institutions, faculties, departments, subjects, courses, topics, curriculum versions, and course-topic mappings. Student profiles store optional catalogue or self-reported institution context and optional academic details. Academic affiliation is optional; a student can use Cogniva without selecting a university or course. This is a first-release hierarchy, not yet a global academic reference model: it has no country/jurisdiction reference, external institution identifier namespace, flexible institution-unit tree, recognition evidence, programme/version model, academic-period model, explicit credit-system semantics, or claim-level catalogue provenance.

There are no seeded or fabricated university, course, or subject catalogue records. Catalogue entries must be sourced or explicitly created as real data.

The merged Phase 1.1 slices add the separate global academic schema in two migrations. Migration 0007 contains `countries`, `country_aliases`, `education_jurisdictions`, `education_systems`, `qualification_frameworks`, `qualification_framework_versions`, `qualification_levels`, `classification_schemes`, `classification_scheme_versions`, `classification_codes`, `qualification_level_classification_mappings`, `catalogue_sources`, `catalogue_source_records`, `entity_source_assertions`, and `catalogue_review_events`. Migration 0008 adds `institution_identifiers`, `institution_aliases`, `institution_units`, `recognition_authorities`, `academic_programmes`, `programme_versions`, `programme_qualifications`, `recognition_decisions`, `credit_systems`, `academic_periods`, `course_content_versions`, `programme_course_requirements`, `knowledge_components`, `knowledge_component_versions`, `knowledge_component_relations`, and `course_knowledge_component_mappings`. These tables hold definitions and evidence metadata only; no ISO, UNESCO, institution, regulator, or catalogue data is inserted by the migration. Source permissions remain explicitly unknown until reviewed, and a source cannot enter `approved` status until its rights-review timestamp and all four permission flags are recorded. Country and alias rows can retain source-record provenance; assertions are tied to a source record and exactly one typed subject (country, institution, jurisdiction, framework, or qualification level). Education-system links on frameworks are constrained to the same jurisdiction. Accepted ISCED-P/ISCED-A mappings require a source record and review timestamp; a database trigger prevents mapping an ISCED-P relation to an attainment scheme or vice versa. Catalogue review-event rows are immutable after insertion: database triggers reject updates and deletes.

Migration 0008 keeps the legacy `institutions`, `faculties`, `departments`, `courses`, `curriculum_versions`, and student-profile fields intact. External institution identifiers are namespaced and source-backed; a name alias does not create a second canonical institution. Flexible units (campus, school, college, faculty, department, institute, centre, division, research centre, or other) use a same-institution parent relationship; the existing fixed faculty/department tables remain compatible during transition. Institution identifiers, aliases, units, programmes, and programme-to-qualification links default to `unreviewed`; acceptance requires a review timestamp and source evidence.

Recognition decisions are typed by scope (institution, unit, programme version, qualification level, or delivery mode), tied to an authority and source record, and carry explicit status and effective dates. The record's scope/target combination is constrained; absence of a recognition record does not imply non-recognition. Programme versions are institution-bound and versioned. Programme course requirements reference a course, optional course-content version from that same course, and optional academic period from the programme's institution. A database trigger rejects attaching a course with a non-null legacy institution assignment to a programme at a different institution; institution-independent legacy courses remain eligible. Local programme stage labels/indices are kept separate from ISCED levels. A credit value must be paired with an explicit credit-system ID; no conversion or equivalence between systems is inferred.

Course content versions may point to the corresponding legacy curriculum version only when both belong to the same course. Knowledge Components are stable Cogniva entities with versioned definitions and objectives. Relations are typed and review-aware; accepted prerequisite edges require evidence and a database trigger rejects cycles in the accepted prerequisite graph. Because this slice adds no KC write API, any future write service must serialize accepted prerequisite-graph mutations to prevent concurrent updates from racing the cycle check. Course-content-to-KC mappings remain proposed until accepted with source evidence and review time. These are schema capabilities only: no institution, programme, recognition, course-content, or KC catalogue rows are seeded, and no ingestion or runtime adapter is activated.

### Learning Workspace

The repository includes student-owned plans and revision history, ordered units/objectives, plan-scoped concepts and relationships, resumable tutor sessions, and ordered tutor messages with provider/model/prompt provenance fields. The plan structures were introduced by migration `0002_futuristic_alex_power.sql`; the project owner previously confirmed production migration history through `0003_lean_gateway.sql`.

The repository also contains migration `0006_cultured_lila_cheney.sql`, which adds `tutor_attempts` linked to the owning learner, session, and student message. The code records explicit attempts and their evaluation lifecycle. The repository's migration files alone do not prove that every later migration has been applied to Neon; verify the production migration workflow before relying on later additions.

The tutor response route uses the provider runtime when its task route and credential are configured. The personal learning-plan generation API in this implementation uses the same provider-neutral runtime and the existing plan tables; it does not require a new schema migration.

## 3. Existing constraints and data integrity

- UUIDs are used for Cogniva-owned catalogue/profile, learning, and administrative event records; Better Auth IDs remain text.
- Ownership is enforced by foreign keys and must also be checked in every server-side query.
- Administrative actor references are retained as nullable historical attribution where configured with `ON DELETE SET NULL`.
- Unique indexes protect institution slugs, academic hierarchy scopes, curriculum versions, and ordered child records.
- Timestamps use timezone-aware PostgreSQL columns and UTC application dates.
- JSONB is limited to bounded profile preferences and typed, non-authoritative metadata where appropriate.

## 4. Production migration history and workflow

The initial read-only production audit confirmed the baseline migration history in Neon at 2026-11-19 15:34:20 UTC. The post-migration audit later verified the complete 0000–0008 ledger as recorded below:

- `0000_dapper_vulture.sql` — initial identity and academic/profile baseline.
- `0001_student_onboarding_state.sql` — onboarding completion and self-reported institution fields.
- `0002_futuristic_alex_power.sql` — Learning Workspace persistence tables and enums.
- `0003_lean_gateway.sql` — Better Auth Admin plugin role, ban metadata, and impersonation reference.
- `0004_classy_freak.sql` — AI task routes and administrative audit events.
- `0005_faithful_zodiak.sql` — AI benchmark runs, results, and reviews.
- `0006_cultured_lila_cheney.sql` — Tutor attempt records and ownership/message constraints.
- `0007_global_academic_reference_foundation.sql` — global country/jurisdiction, qualification/classification, source-provenance, and review foundations.
- `0008_institutions_programmes_and_kcs.sql` — institution identity/units, scoped recognition, programmes, credit systems, academic periods, versioned course content, and Knowledge Component structures.

Migrations `0007_global_academic_reference_foundation.sql` and `0008_institutions_programmes_and_kcs.sql` were applied to Neon by [production migration run #44615863935](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44615863935). The subsequent [read-only audit, run #44610442501 attempt 2](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501), reports 9 expected and 9 applied migrations, zero missing migrations, zero missing repository files, and zero unexpected applied migrations. Its table inventory confirms all 31 Phase 1.1 target tables and all nine existing academic tables are present.

The database package exposes `createDatabase(databaseUrl)`. Importing it does not access process environment variables or create a live connection. The application resolves its pooled `DATABASE_URL` only when a data request needs the database.

With `DATABASE_URL` and optionally `DATABASE_MIGRATION_URL` configured:

1. Update and type-check the Drizzle schema on a feature branch.
2. Merge the reviewed schema change to `main`.
3. Run **Generate Neon database migrations** with `GENERATE`; it generates and commits SQL plus Drizzle migration history to `main`, without connecting to Neon.
4. Inspect every generated SQL statement and the associated journal/snapshot changes. Confirm that the migration is additive and contains no unintended destructive changes.
5. Only after that review, run **Apply Neon database migrations** with `APPLY`; it applies committed pending migrations and does not generate or modify schema files.
6. Verify the workflow result and production readiness.
7. Deploy application code that depends on the new schema only after the migration succeeds.

## 5. AI administration schema

Migration `0004_classy_freak.sql` and the current `admin.ts` schema define:

- `ai_task_routes`: one persisted provider/model preference per supported task, with the administrator who last changed it and timestamps. Current task keys are `learning_plan_generation` and `socratic_tutor_response`; provider values are `gemini`, `groq`, and `mistral`.
- `admin_audit_events`: administrative change records with actor, action, resource, non-secret metadata, and timestamp. The application exposes inserts only; it does not provide update/delete operations.

Provider credentials are not stored in either table. The admin API checks only whether the corresponding server environment variable is non-empty and returns a boolean plus the variable name. The raw value is never selected, returned, or stored. Task routes are consumed by the provider runtime for learner-facing tutoring and topic-based plan generation only when the matching server credential is present. Comparative model benchmarking remains an evaluation step; no provider is selected automatically.

## 6. Authentication configuration

Better Auth is mounted at `/api/auth/*`. Email/password registration requires email verification. The verification and password-reset mail callbacks use Resend via `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

The Better Auth secret must be at least 32 characters of high-entropy random data. Keep all connection strings, auth secrets, and email keys in local environment files or deployment secret settings, never Git.

## 7. Deferred persistence and retention

Canonical Knowledge Components and mastery estimates require their own versioned provenance and evaluation contracts. Document entities, extracted text, embeddings, and vector columns come only after selecting and validating the actual document/embedding pipeline; do not reserve guessed vector dimensions.

Before public launch, define retention and deletion across relational rows, uploaded source objects, extracted text, embeddings, search indexes, caches, analytics identifiers, and queued jobs.


## 8. Phase 1.1 production schema audit

The initial read-only production audit at 15:34 UTC on 19 November 2026 established the pre-Phase-1.1 baseline (migrations 0000–0006 and nine legacy academic tables). After migration run [#44615863935](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44615863935) completed successfully, the same audit workflow was rerun as attempt 2 of [run #44610442501](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501). The resulting report, generated at 21:19:06 UTC, confirms migrations 0000–0008 are applied, all 31 Phase 1.1 target tables are present, and all nine legacy academic tables remain present. It used `DATABASE_MIGRATION_URL` in a PostgreSQL `READ_ONLY_TRANSACTION`; it did not query learner rows or mutate production data. The report artifact is [phase-1.1-production-schema-audit, artifact 14575831526](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501/artifacts/14575831526).

The report's `assertion` field is `NOT ASSERTED` because the production workflow invokes the audit in observational mode without the optional `--assert-all-repository-migrations` flag. The returned ledger and table-inventory values were reviewed directly against the production acceptance checks.

See [PHASE_1_1_SCHEMA_AUDIT_AND_MIGRATION_PLAN.md](PHASE_1_1_SCHEMA_AUDIT_AND_MIGRATION_PLAN.md) for the detailed schema-gap analysis and [PHASE_1_1A_REFERENCE_FOUNDATION.md](PHASE_1_1A_REFERENCE_FOUNDATION.md) for migration 0007, its constraints, and rollback boundaries.
