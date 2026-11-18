# Cogniva — Database Design Baseline

**Status:** Better Auth, academic/profile, Learning Workspace persistence, and migration history through `0003_lean_gateway.sql` have been applied to Neon. The deployed readiness endpoint has returned `status: ready` with `checks.database: available`. The AI administration schema in the current feature branch is proposed and must be generated, reviewed, and applied before its application code is deployed.

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

The academic schema contains institutions, faculties, departments, subjects, courses, topics, curriculum versions, and course-topic mappings. Student profiles store optional catalogue or self-reported institution context and optional academic details. Academic affiliation is optional; a student can use Cogniva without selecting a university or course.

There are no seeded or fabricated university, course, or subject catalogue records. Catalogue entries must be sourced or explicitly created as real data.

### Learning Workspace

The next tutor-evidence increment adds a proposed `tutor_attempts` table. It links an explicitly submitted learner attempt to its student message, session, and owning learner, with a sequential attempt number and an evaluation lifecycle status. The message remains the source text; a newly recorded attempt starts as `not_evaluated`. This schema is not available in Neon until its migration is generated, reviewed, and explicitly applied.

The applied Learning Workspace schema includes student-owned plans and revision history, ordered units/objectives, plan-scoped concepts and relationships, resumable tutor sessions, and ordered tutor messages with provider/model/prompt provenance fields. These are persisted structures; provider generation and tutoring execution are not yet enabled.

## 3. Existing constraints and data integrity

- UUIDs are used for Cogniva-owned catalogue/profile, learning, and administrative event records; Better Auth IDs remain text.
- Ownership is enforced by foreign keys and must also be checked in every server-side query.
- Administrative actor references are retained as nullable historical attribution where configured with `ON DELETE SET NULL`.
- Unique indexes protect institution slugs, academic hierarchy scopes, curriculum versions, and ordered child records.
- Timestamps use timezone-aware PostgreSQL columns and UTC application dates.
- JSONB is limited to bounded profile preferences and typed, non-authoritative metadata where appropriate.

## 4. Production migration history and workflow

The production migration history confirmed by the project owner is:

- `0000_dapper_vulture.sql` — initial identity and academic/profile baseline.
- `0001_student_onboarding_state.sql` — onboarding completion and self-reported institution fields.
- `0002_futuristic_alex_power.sql` — Learning Workspace persistence tables and enums.
- `0003_lean_gateway.sql` — Better Auth Admin plugin role, ban metadata, and impersonation reference.

The project owner confirmed successful application of migrations through `0003` to Neon. The deployed Render readiness endpoint returned `status: ready` with `checks.database: available`; readiness verifies application-to-database connectivity, not every individual constraint.

The database package exposes `createDatabase(databaseUrl)`. Importing it does not access process environment variables or create a live connection. The application resolves its pooled `DATABASE_URL` only when a data request needs the database.

With `DATABASE_URL` and optionally `DATABASE_MIGRATION_URL` configured:

1. Update and type-check the Drizzle schema on a feature branch.
2. Merge the reviewed schema change to `main`.
3. Run **Generate Neon database migrations** with `GENERATE`; it generates and commits SQL plus Drizzle migration history to `main`, without connecting to Neon.
4. Inspect every generated SQL statement and the associated journal/snapshot changes. Confirm that the migration is additive and contains no unintended destructive changes.
5. Only after that review, run **Apply Neon database migrations** with `APPLY`; it applies committed pending migrations and does not generate or modify schema files.
6. Verify the workflow result and production readiness.
7. Deploy application code that depends on the new schema only after the migration succeeds.

## 5. Proposed AI administration schema

The `admin.ts` schema in the AI Configuration feature branch proposes:

- `ai_task_routes`: one persisted provider/model preference per supported task, with the administrator who last changed it and timestamps. Current task keys are `learning_plan_generation` and `socratic_tutor_response`; provider values are `gemini`, `groq`, and `mistral`.
- `admin_audit_events`: administrative change records with actor, action, resource, non-secret metadata, and timestamp. The application exposes inserts only; it does not provide update/delete operations.

Provider credentials are not stored in either table. The admin API checks only whether the corresponding server environment variable is non-empty and returns a boolean plus the variable name. The raw value is never selected, returned, or stored. Saved route preferences remain inactive until provider adapters are implemented and evaluated.

## 6. Authentication configuration

Better Auth is mounted at `/api/auth/*`. Email/password registration requires email verification. The verification and password-reset mail callbacks use Resend via `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

The Better Auth secret must be at least 32 characters of high-entropy random data. Keep all connection strings, auth secrets, and email keys in local environment files or deployment secret settings, never Git.

## 7. Deferred persistence and retention

Canonical Knowledge Components and mastery estimates require their own versioned provenance and evaluation contracts. Document entities, extracted text, embeddings, and vector columns come only after selecting and validating the actual document/embedding pipeline; do not reserve guessed vector dimensions.

Before public launch, define retention and deletion across relational rows, uploaded source objects, extracted text, embeddings, search indexes, caches, analytics identifiers, and queued jobs.
