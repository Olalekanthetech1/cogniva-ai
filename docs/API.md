# Cogniva — API Contract Baseline

**Status:** Baseline contract. Better Auth is mounted at `/api/auth/*`; the Phase 1 student profile and read-only academic catalogue endpoints listed below are implemented.

## 1. Conventions

- Prefix application endpoints with `/api/v1`.
- Validate input and structured output at runtime.
- Require authentication and enforce record ownership for student data.
- Use idempotency keys for retriable state-changing requests.
- Use cursor pagination for growing collections.
- Return stable error codes and safe messages; never expose provider secrets or raw stack traces.
- Distinguish accepted/pending work from completed work.

## 2. Response shapes

Success:
```json
{ "data": {}, "meta": { "requestId": "server-generated-id" } }
```

Error:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request could not be processed.", "details": [] }, "meta": { "requestId": "server-generated-id" } }
```

These are illustrative contracts, not live responses or seeded records.

## 3. Identity and student profile

Better Auth owns registration, email verification, sign-in, sign-out, session retrieval, and password-reset operations under `/api/auth/*`. The student profile is a separate Cogniva-owned record.

Implemented:
- `GET /api/v1/student/profile` — returns the signed-in student's profile, or `data: null` when no profile has been saved.
- `PUT /api/v1/student/profile` — creates or replaces the signed-in student's academic profile; validates catalogue IDs and institution/faculty/department ancestry.

The profile endpoint derives the owner from the authenticated session. It does not accept a user ID from the client. Academic affiliation is optional; a student can save programme/year details or skip setup.

## 4. Academic discovery

Implemented authenticated, read-only catalogue routes:
- `GET /api/v1/academic/institutions` — optional bounded `q` name search.
- `GET /api/v1/academic/faculties?institutionId=<uuid>`.
- `GET /api/v1/academic/departments?facultyId=<uuid>`.
- `GET /api/v1/academic/subjects`.

Course, topic, curriculum-version, and knowledge-component discovery routes remain planned. Catalogue content is database-driven. The deployed catalogue currently has no institution/faculty/department/subject/course seed records; empty results are reported as empty, never replaced with sample data.

### Optional institution onboarding

Implemented in this change:
- `POST /api/v1/student/onboarding` accepts exactly one of three choices: `{ choice: "catalogue", institutionId }`, `{ choice: "not_listed", institutionName }`, or `{ choice: "skip" }`.
- The owner is derived from the authenticated Better Auth session. Catalogue IDs are checked against the current institution table. Self-reported names are stored only on that student's profile and are never added to the global catalogue.
- The profile response includes `selfReportedInstitution` and `onboardingCompletedAt`. An absent completion timestamp means the first-run choice has not been completed.
- Choosing Skip completes onboarding without requiring institution data. It clears institution selection while preserving programme/year fields; a changed catalogue institution clears faculty/department links that would no longer be valid.
- Institution search returns `countryCode` so the UI can disambiguate records. Cogniva does not infer country or recognition status when the source has not supplied it.

## 5. Sessions and tutoring

## 5.1 Implemented tutor session API

The following learner-authenticated routes are implemented in the current Phase 4 vertical slice:

- `GET /api/v1/tutor/sessions` — list sessions owned by the signed-in learner.
- `POST /api/v1/tutor/sessions` — create a session and persist its initial learner message atomically.
- `GET /api/v1/tutor/sessions/:sessionId` — retrieve an owned session, ordered messages, and explicitly submitted attempts.
- `POST /api/v1/tutor/sessions/:sessionId/respond` — generate the next Socratic response or retry an unanswered learner turn.
- `POST /api/v1/tutor/sessions/:sessionId/end` — cancel an active session; this does not mark it completed or mastered.

When a learner sends a new message to the `respond` route, the optional `messageType` field distinguishes a submitted attempt from a follow-up question:

```json
{
  "message": "I think the answer is 12 because ...",
  "messageType": "attempt"
}
```

Use `"question"` for a follow-up question. When omitted, `messageType` defaults to `"attempt"` for compatibility. An empty JSON object requests a retry for the most recent unanswered learner message and does not create a duplicate attempt.

An attempt record and its student message are committed in the same database transaction before a provider request begins. The session response exposes the attempt number, linked message, submission time, and evaluation status. New records are saved as `not_evaluated`; the Socratic tutor reply is not an independent answer verification and must not be presented as a correctness or mastery result.

- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `GET /api/v1/sessions/:sessionId/messages`
- `PATCH /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/:sessionId/close`
- `POST /api/v1/problems/interpret`
- `POST /api/v1/problems/:problemId/tutor`
- `POST /api/v1/sessions/:sessionId/interactions`
- `POST /api/v1/sessions/:sessionId/attempts`
- `POST /api/v1/problems/:problemId/verify`
- `GET /api/v1/problems/:problemId/summary`
- `GET /api/v1/problems/:problemId/alternatives`
- `GET /api/v1/problems/:problemId/applications`

Suggested interaction actions: `WHY_THIS_STEP`, `HINT`, `SIMPLIFY`, `EXAMPLE`, `SUBMIT_ATTEMPT`, `CHECK_ANSWER`, `CONTINUE`, `REPEAT`, `END_SESSION`. Validate these at runtime. WHY/HINT/SIMPLIFY/EXAMPLE must not advance the step; only valid explicit continuation may do so.

## 6. Documents and progress

Documents:
- `POST /api/v1/documents/upload-intent`
- `POST /api/v1/documents`
- `GET /api/v1/documents`
- `GET /api/v1/documents/:documentId`
- `POST /api/v1/documents/:documentId/process`
- `POST /api/v1/documents/:documentId/questions`
- `DELETE /api/v1/documents/:documentId`

Potential progress routes, after evidence models exist:
- `GET /api/v1/progress/overview`
- `GET /api/v1/progress/knowledge-components`
- `GET /api/v1/progress/recommendations`

Progress must disclose the evidence/window behind a mastery estimate.

## 7. Concurrency and failure semantics

Use expected state versions or equivalent concurrency tokens on state-changing requests. Return conflict for stale writes rather than overwriting newer state. Attempts and uploads need idempotency. Suggested errors: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `UNSUPPORTED_CAPABILITY`, `PROVIDER_UNAVAILABLE`, `VERIFICATION_UNAVAILABLE`, `PROCESSING_FAILED`.

Do not return completed success when work has only been queued. Return an explicit pending/accepted resource. A partially streamed tutor response must not be treated as a completed step.

## 8. Upload and SSRF safety

Prefer direct-to-private-storage signed uploads with strict expiry, file size, and content-type validation. Never accept an arbitrary URL and fetch it server-side without SSRF protection, redirect validation, DNS/IP checks, and response-size limits.

## 9. Implementation gate

Finalise authentication, validation library, database access, ownership strategy, and error semantics before implementing routes. This document does not claim that these endpoints exist.
