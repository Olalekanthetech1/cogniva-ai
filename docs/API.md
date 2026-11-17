# Cogniva — API Contract Baseline

**Status:** Proposed contract; endpoints are not yet implemented.

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

## 3. Identity

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/password-reset`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

Select the authentication provider/session strategy before implementation.

## 4. Academic discovery

- `GET /api/v1/institutions`
- `GET /api/v1/faculties`
- `GET /api/v1/departments`
- `GET /api/v1/subjects`
- `GET /api/v1/courses`
- `GET /api/v1/topics`
- `GET /api/v1/knowledge-components`

All curriculum metadata must be database-driven and configurable. Do not fabricate institution or course data.

## 5. Sessions and tutoring

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
