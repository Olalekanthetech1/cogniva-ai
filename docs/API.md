# Cogniva — API Contract Baseline

**Status:** Baseline contract. Better Auth is mounted at `/api/auth/*`; the Phase 1 student profile and read-only academic catalogue endpoints listed below are implemented.

## 1. Conventions

- Prefix application endpoints with `/api/v1`.
- Validate input and structured output at runtime.
- Require authentication and enforce record ownership for student data.
- Use idempotency keys or an equivalent persisted state claim for retriable state-changing requests. Initial learning-plan creation is not yet idempotency-key deduplicated; see the learning-plan API limitation above.
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

## 5. Learning plans

### 5.1 Implemented personal learning-plan API

The topic-based personal plan API reuses the existing learning-plan tables introduced in migration `0002`; it does not create catalogue courses or canonical Knowledge Components.

- `GET /api/v1/learning-plans` — lists up to 50 plans owned by the signed-in learner, with the latest revision summary.
- `POST /api/v1/learning-plans` — accepts exactly `{ "topic": "..." }`, saves the learner's topic, and synchronously requests a proposed plan using the saved `learning_plan_generation` provider/model route.
- `GET /api/v1/learning-plans/:planId` — returns an owned plan, revision history, and the selected revision content. An optional `revisionId` query parameter selects another revision belonging to that plan.
- `POST /api/v1/learning-plans/:planId/generate` — retries a plan in `pending`, `failed`, or `unavailable` state, or reclaims a `running` generation after its two-minute lease expires. It does not overwrite a successfully generated revision.

Generation is available only when an administrator has saved a provider/model route for `learning_plan_generation` and the matching server credential is present. No default model or automatic provider fallback is used. A provider response must be strict JSON matching the versioned output contract; malformed, truncated, or inconsistent plans are rejected before a revision is saved. The learner input remains on the plan when generation fails. Units, objectives, concepts, and relationships are persisted transactionally, and generated relationships remain `proposed`.

The output validator enforces bounded collection sizes, exact object fields, unique names, valid unit-to-concept references, and acyclic prerequisite suggestions. This is structural validation; it does not establish the factual correctness or completeness of the generated teaching sequence. Learners can review each proposed concept relationship and approve the latest revision using the review endpoints below. Editing plan content remains unavailable. Approved units now expose a Tutor launch form, which passes revision/unit references to session creation.

Additional learner review endpoints:
- `PATCH /api/v1/learning-plans/:planId/relationships/:relationshipId` — accepts exactly `{ "expectedVersion": 1, "decision": "accepted" | "rejected" }`. The relationship must belong to the latest proposed revision of a plan owned by the signed-in learner and still be in `proposed` review state. The server saves the decision and increments the parent plan version in one transaction.
- `POST /api/v1/learning-plans/:planId/approve` — accepts exactly `{ "expectedVersion": 1 }`. It approves the latest proposed revision and changes the parent plan from `draft` to `active` in one transaction. Approval is rejected while any relationship in that revision remains `proposed`. This records the learner's decision to use the generated outline; it is not academic validation, official syllabus approval, or a mastery claim.

Both endpoints enforce session-derived ownership and optimistic version checks. They do not yet expose text editing, unit reordering/removal, or plan-unit Tutor launch.

Initial `POST /api/v1/learning-plans` creation is not currently deduplicated by an idempotency key. Clients must not automatically replay a timed-out create request; they can recover by listing the learner's plans. The separate generation retry endpoint uses a server-side state claim.

## 6. Sessions and tutoring

## 6.1 Implemented tutor session API

The following learner-authenticated routes are implemented in the current Phase 4 vertical slice:

- `GET /api/v1/tutor/sessions` — list sessions owned by the signed-in learner.
- `POST /api/v1/tutor/sessions` — create a session and persist its initial learner message atomically. Optional `learningPlanRevisionId` and `learningPlanUnitId` associate a session with a plan unit. When a unit is supplied, the API validates that the unit and revision belong to the learner and requires the parent plan to be `active` and the revision to be `approved`; mismatched revision/unit references are rejected.
- `GET /api/v1/tutor/sessions/:sessionId` — retrieve an owned session, ordered messages, and explicitly submitted attempts.
- `POST /api/v1/tutor/sessions/:sessionId/respond` — generate the next Socratic response or retry an unanswered learner turn.

For a session created with a validated approved learning-plan unit link, the first response uses CTL v1.2 structured teaching, followed by context-aware continuation. Standalone concept/topic sessions receive a concept mini-lesson; problem sessions receive a structured problem-solving opening followed by step-aware continuations. Follow-up turns classify attempts, clarifications, correction challenges, hint requests, simplification requests, example requests, and recap requests. A clear new-task request can switch a standalone session from its original intent. Unclear intent retains context or falls back to adaptive Socratic dialogue. The Tutor message metadata records framework version, response mode, learner action, and any requested task-mode switch. No new request fields are required. Lesson stages, hint stages, and mastery are not persisted. See [TUTOR_LEARNING_FRAMEWORK.md](TUTOR_LEARNING_FRAMEWORK.md).
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

The following are proposed future interaction/problem endpoints, not implemented routes:
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

## 7. Documents and progress

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

## 8. Concurrency and failure semantics

Use expected state versions or equivalent concurrency tokens on state-changing requests. Return conflict for stale writes rather than overwriting newer state. Attempts and uploads need idempotency. Suggested errors: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `UNSUPPORTED_CAPABILITY`, `PROVIDER_UNAVAILABLE`, `VERIFICATION_UNAVAILABLE`, `PROCESSING_FAILED`.

Do not return completed success when work has only been queued. Return an explicit pending/accepted resource. A partially streamed tutor response must not be treated as a completed step.

## 9. Upload and SSRF safety

Prefer direct-to-private-storage signed uploads with strict expiry, file size, and content-type validation. Never accept an arbitrary URL and fetch it server-side without SSRF protection, redirect validation, DNS/IP checks, and response-size limits.

## 10. Implementation gate

This document distinguishes implemented endpoints from proposed future routes; proposed routes are not evidence of implementation.
