# Cogniva — Database Design Baseline

**Status:** Drizzle schema and connection layer implemented; initial migrations applied to Neon and the deployed application has verified database connectivity.

## 1. Decisions

- PostgreSQL is the transactional source of truth.
- Drizzle ORM provides typed schema and query access.
- The `@cogniva/database` workspace package owns schema, connection construction, and migrations.
- The connection factory accepts a URL explicitly and does not open a connection merely by importing the package.
- A separate migration URL may be used for a direct PostgreSQL connection when the application uses a pooled URL.
- Better Auth owns user identity, credentials, verification records, and sessions; Cogniva academic/profile data remains in separate application tables.

Drizzle supports PostgreSQL through its `postgres.js` and `node-postgres` drivers. The selected `postgres.js` driver is compatible with managed PostgreSQL providers; a provider-specific driver can be introduced later if a deployment target requires it.

## 2. Implemented schema groups

### Better Auth identity
- `user`: display name, unique email, verification state, profile image, timestamps.
- `session`: session token, expiry, user association, optional device metadata.
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
- `student_profiles`: one-to-one user profile with optional institution/faculty/department context, programme, year of study, locale, time zone, and learning preferences.

Academic affiliation is optional. A student can use Cogniva without selecting a university or course.

## 3. Constraints and data integrity

- UUIDs are used for Cogniva-owned catalogue/profile records; Better Auth IDs remain text.
- Ownership is enforced by foreign keys and must also be checked in every server-side query.
- Deleting a user cascades through their session, account, and profile data.
- Deleting a taxonomy parent is restricted or cascaded according to the relationship's meaning.
- Unique indexes protect institution slugs, faculty/department scopes, curriculum versions, and course-topic ordering.
- Level/year and topic-position constraints are represented in the schema.
- Timestamps use timezone-aware PostgreSQL columns and UTC application dates.
- JSONB is limited to bounded student preference data; messages and attempts will remain first-class relational entities when implemented.

## 4. Connection and migration workflow

The initial production migration was applied successfully. The Render readiness endpoint has also returned `status: ready` with `checks.database: available`. Student profile and read-only catalogue routes now use the pooled application database connection.

The database package exposes `createDatabase(databaseUrl)`. Importing it does not access process environment variables or create a live connection. The web auth module only creates its database connection when the auth API is invoked and the required environment is present.

With `DATABASE_URL` and optionally `DATABASE_MIGRATION_URL` configured:

1. Run `pnpm db:generate`.
2. Review the generated SQL in `packages/database/migrations`.
3. Run `pnpm db:migrate` against the intended database.

Migrations have not been generated or applied in this repository because no live database connection has been supplied. The schema is type-checked in CI; it is not yet evidence of a deployed database.

## 5. Authentication configuration

Better Auth is mounted at `/api/auth/*`. Email/password registration requires email verification. The verification and password-reset mail callbacks use Resend via `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

The auth route reports a 503 configuration error when database, auth URL/secret, or email sender settings are absent. It does not silently create a local database or pretend verification emails were sent.

The Better Auth secret must be at least 32 characters of high-entropy random data. Keep all connection strings, auth secrets, and email keys in local environment files or deployment secret settings, never Git.

## 6. Next data entities

After the tutoring workflow is implemented, add session/problem/message/step/attempt/verification entities. Document entities and vector columns come later, after selecting an embedding model and its actual vector dimension. Do not reserve guessed vector sizes.

## 7. Retention and deletion

Before public launch, define retention and deletion across relational rows, uploaded source objects, extracted text, embeddings, search indexes, caches, analytics identifiers, and queued jobs.
