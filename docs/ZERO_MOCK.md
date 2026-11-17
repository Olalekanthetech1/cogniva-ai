# Cogniva — ZeroMock and Evidence-First Policy

**Status: Mandatory engineering constraint**

## 1. Purpose

Fabricated explanations, citations, verification badges, or processing states can mislead students. Production behaviour must be grounded in actual inputs, system state, and traceable evidence.

## 2. Prohibited in production

- Fake users, courses, institutions, lecture notes, attempts, progress, or analytics presented as real.
- Hardcoded AI answers or canned fallback responses presented as live model output.
- Fabricated citations, source titles, page numbers, or quotations.
- A loading/processing state when no real request or job exists.
- Success when a provider, parser, database write, or verifier failed.
- Verification badges based only on a language model agreeing with itself.
- Silent substitution of a canned answer after provider failure.
- Synthetic mastery progress or inflated completion metrics.
- Claiming a document is processed before extraction/indexing actually completes.
- Advertising a capability the selected adapter cannot perform.

## 3. Allowed fixtures

Test fixtures and seeds are allowed in isolated automated tests and local development. They must not leak into production or be represented as live student activity. Any public demo mode must be explicit, clearly labelled, and disabled by default in production.

## 4. Evidence and provenance

For consequential output, retain as applicable:
- original student input and confirmed interpretation;
- provider/model and prompt version;
- subject adapter/version;
- source IDs and retrieval timestamps;
- verification method/version, inputs, assumptions, result, status, and limitations;
- session version and action responsible for a transition.

Collect and log only what is needed. Do not expose evidence belonging to another student.

## 5. Honest status vocabulary

- `pending`: accepted but not completed;
- `running`: an actual operation is underway;
- `succeeded`: completed successfully;
- `failed`: operation failed;
- `unavailable`: capability or dependency is not available;
- `needs_confirmation`: student input is required;
- `not_checked`: no verification was performed.

Never collapse failed, unavailable, or not_checked into verified.

## 6. AI and provider policy

Record the actual provider/model. Fallback is permitted only to an explicitly configured compatible provider supporting the required capability and output schema. If none is available, report failure and preserve the student's work. Bound retries and avoid duplicate charges/mutations. Treat uploaded and retrieved content as untrusted data, not application instructions.

## 7. Verification policy

Model-generated explanation is not independent verification. A checker must identify what it checked and under which assumptions. A numerical spot-check that does not prove the full symbolic claim must be labelled accordingly. Partial, failed, and unavailable checks remain explicit.

## 8. UI and analytics policy

Metrics must be computed from persisted events and define their window and denominator. Example values must not appear as live activity. Processing indicators must correspond to real jobs. Unsupported actions should be disabled or explained rather than simulated.

## 9. Release checklist

- [ ] No fabricated production records or hardcoded success responses.
- [ ] Provider/parser/verifier failure paths are tested.
- [ ] Pending/running/failed/unavailable states are truthful.
- [ ] Unsupported features are not advertised as implemented.
- [ ] Citations and extraction retain provenance.
- [ ] Student attempts survive evaluation failure.
- [ ] Retries are idempotent.
- [ ] Logs redact secrets and unnecessary personal content.
- [ ] Fixtures cannot be loaded into production accidentally.

A feature that violates this policy is not ready to merge or release.
