# Cogniva — Database Design Baseline

**Status:** Better Auth, academic/profile schema, and the initial production migrations are in place. The deployed readiness endpoint has returned `status: ready` with `checks.database: available`. Learning Workspace persistence is being added separately and is not yet part of the deployed database.

## 1. Decisions

- PostgreSQL is the transactional source of truth.
- Drizzle ORM provides typed schema and query access.
- The `@cogniva/database` workspace package owns schema, migrations, and connection construction.
- The connection factory accepts a URL explicitly and does not open a connection merely by importing the package.
- A separate migration URL may be used for a direct PostgreSQL connection when the application uses a pooled URL.
- Better Auth owns user identity, credentials, verification records, and authentication sessions; Cogniva academic/profile and learning-domain records remain in separate application tables.

Drizzle uses the `postgres.js` driver in this repository. The connection factory supports managed PostgreSQL providers such as Neon.

## 2. Existing schema groups

### Better Auth identity

- `user`: display name, unique email, verification state, profile image, timestamps.
- `session`: authentication session token, expiry, user association, optional device metadata.
- `account`: authentication provider/account link and credential/token fields.
- `verification`: email and other verification challenges with expiry.

The physical columns use snake_case while the Drizzle property names preserve Better Auth's expected schema contract. Authentication IDs remain text because Better Auth generates them.

### Academic catalogue

- `institutions`
- `faculties`
- `departments`
- `subjects`
- `courses`
- `topics`
- `curriculum_versions`
- `course_topics`

There are no seeded or fabricated university, course, or subject catalogue records. Catalogue entries must be sourced or explicitly created as real data.

### Student profile

- `student_profiles`: one-to-one user profile with optional catalogue institution or self-reported institution, onboarding completion timestamp, optional faculty/department context, programme, year of study, locale, time zone, and learning preferences.

Academic affiliation is optional. A student can use Cogniva without selecting a university or course.

## 3. Existing constraints and data integrity

- UUIDs are used for Cogniva-owned catalogue/profile records; Better Auth IDs remain text.
- Ownership is enforced by foreign keys and must also be checked in every server-side query.
- Deleting a user cascades through the user's authentication and profile records.
- Deleting a taxonomy parent is restricted or cascaded according to the relationship's meaning.
- Unique indexes protect institution slugs, faculty/department scopes, curriculum versions, and course-topic ordering.
- Level/year and topic-position constraints are represented in the schema.
- Timestamps use timezone-aware PostgreSQL columns and UTC application dates.
- JSONB is limited to bounded profile preferences and typed, non-authoritative metadata where appropriate.

## 4. Production migration history and workflow

The repository contains the initial migration `0000_dapper_vulture.sql` and the additive onboarding migration `0001_student_onboarding_state.sql`. The onboarding migration adds `self_reported_institution` and `onboarding_completed_at`, plus a check preventing a catalogue institution and a self-reported institution from being stored simultaneously. It does not remove existing profile values.

The Neon migration was confirmed by the project owner, and the deployed Render readiness endpoint has returned `status: ready` with `checks.database: available`. Readiness verifies application-to-database connectivity; it does not independently prove every expected table or constraint exists.

The database package exposes `createDatabase(databaseUrl)`. Importing it does not access process environment variables or create a live connection. The application resolves its pooled `DATABASE_URL` only when a data request needs the database.

With `DATABASE_URL` and optionally `DATABASE_MIGRATION_URL` configured:

1. Update and type-check the Drizzle schema on a feature branch.
2. Merge the reviewed schema change to `main).
3. Run the explicit Neon migration workflow with `APPLY` only after reviewing the generated SQL and confirming the target database.
4. Verify the workflow result and production readiness.
5. Deploy application code that depends on the new schema only after the migration succeeds.

The production migration workflow generates migration SQL from the committed schema, commits the generated SQL and Drizzle migration history to `main`, and then applies pending migrations. Do not run it as a generic CI test: it changes the production database.

## 5. Proposed Learning Workspace schema

The branch `feat/learning-workspace-persistence` proposes an additive schema in `packages/database/schema/learning.ts`. It is not yet merged, migration-generated, or applied to Neon.

The proposed tables cover:

- `learning_plans`: student ownership, initial intent/input, lifecycle, generation status, and optimistic version.
- `learning_plan_revisions`: numbered, reviewable proposed/approved/rejected outlines with provider/model/prompt/schema provenance.
- `learning_plan_units` and `learning_plan_objectives`: ordered study units and measurable objectives.
- `learning_plan_concepts`, `learning_plan_unit_concepts`, and `learning_plan_concept_relations`: revision-scoped concepts/skills, unit mappings, and proposed/reviewed relationships.
- `tutor_sessions`: student-owned resumable session state, optional plan/unit links, current step index, and concurrency version.
- `tutor_messages`: ordered student/tutor messages, with provider/model/prompt provenance for tutor messages.

These are personal learning-plan concepts, not canonical global Knowledge Components, official institution courses, or verified prerequisites. The detailed invariants and migration review sequence are in [LEARNING_WORKSPACE_DATA_MODEL.md](LEARNING_WORKSPACE_DATA_MODEL.md).

The proposal intentionally does not add canonical KC graph tables, mastery estimates, first-class attempts/evaluation evidence, document/vector tables, or uploaded-file storage.

## 6. Authentication configuration

Better Auth is mounted at `/api/auth/*`. Email/password registration requires email verification. The verification and password-reset mail callbacks use Resend via `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

The auth route reports a 503 configuration error when database, auth URL/secret, or email sender settings are absent. It does not silently create a local database or pretend verification emails were sent.

The Better Auth secret must be at least 32 characters of high-entropy random data. Keep all connection strings, auth secrets, and email keys in local environment files or deployment secret settings, never Git.

## 7. Deferred persistence

First-class student attempts and assessment evidence will be introduced with guided feedback and the learning-intelligence phases. Canonical Knowledge Components and mastery estimates require their own versioned provenance and evaluation contracts. Document entities, extracted text, embeddings, and vector columns come only after selecting and validating the actual document/embedding pipeline; do not reserve guessed vector dimensions.

## 8. Retention and deletion

Before public launch, define retention and deletion across relational rows, uploaded source objects, extracted text, embeddings, search indexes, caches, analytics identifiers, and queued jobs.
