# Cogniva — Admin Dashboard Foundation

**Status:** First implementation slice. This document describes the foundation and its current capability boundary; it is not evidence that later administration modules are implemented.

## 1. Purpose

The Admin Dashboard is a separate, server-protected platform control centre. It must expose real administrative operations and telemetry, not decorative controls or sample metrics.

The initial route is `/admin`. Student workspace navigation remains separate.

## 2. Authentication and roles

- Better Auth's Admin plugin provides the initial role field and administrative server APIs.
- New and existing accounts default to the `user` role.
- Only an explicitly provisioned account with a verified email and the `admin` role can access the dashboard overview.
- Public registration never accepts a role field.
- The first release uses the single `admin` role. More granular roles and per-module permissions require a separately reviewed change.
- Both page rendering and admin API routes verify the current server-side session and role. A hidden navigation item is not an authorization boundary.

The Admin plugin's schema additions are additive: user role/ban metadata and the session impersonation reference. Existing accounts remain ordinary users after migration.

## 3. First live capability

Implemented in this slice:

- `GET /api/v1/admin/overview` — administrator-only live counts for user accounts, learning plans, and tutor sessions, plus database query availability.
- `/admin` — protected, responsive dashboard overview.
- Database query failures are shown as unavailable; counts are never replaced with estimates or sample values.

## 4. Planned modules — not yet enabled

1. AI provider and task/model configuration for Gemini, Groq, and Mistral.
2. Versioned system-prompt management and controlled publishing.
3. Student account administration and support operations.
4. Learning-plan and tutoring policy configuration.
5. Academic catalogue governance and source verification.
6. Usage, cost, latency, error, and provider health analytics.
7. Role/permission management and security review.
8. Append-only administrative audit history.

Each module needs a defined data model, server-side permission checks, validation, audit events, and tests before its controls are enabled.

## 5. Secret management

Provider API keys and other credentials must remain in server-side environment variables or a dedicated secret manager. The dashboard may later report whether a credential is configured, but must never return or display the secret itself. Do not store raw provider keys in browser-readable configuration or ordinary settings records.

## 6. Release order

1. Review the application/schema changes and CI.
2. Generate a new migration from the committed Drizzle schema.
3. Inspect the SQL for additive role and session fields only.
4. Apply the migration to Neon through the explicit production migration workflow.
5. Provision the first administrator through a controlled operational procedure; never expose public admin registration.
6. Manually deploy the application after the migration and administrator provisioning are complete.
7. Verify that a normal student receives 403 from the admin overview API and cannot view dashboard data, while a provisioned administrator can access real counts.

Do not mark the admin dashboard as production-ready until these deployment and access-boundary checks have passed.
