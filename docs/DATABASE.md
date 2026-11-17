# Cogniva — Database Design Baseline

**Status:** Logical schema proposal only; not an executable migration or deployed database.

## 1. Principles

Use PostgreSQL as the transactional source of truth, UUID primary keys, UTC timestamps, foreign keys, explicit indexes/unique constraints, and transactions for related state mutations. Drizzle ORM is the proposed typed access layer; SQL migrations remain version-controlled. JSONB is suitable for bounded, versioned structured payloads, not for the entire conversation or all learning state.

## 2. Logical entity groups

**Identity and academic context**
- `users`, `student_profiles`
- `institutions`, `faculties`, `departments`
- `subjects`, `courses`, `topics`, `course_topics`, `curriculum_versions`

**Knowledge and mastery**
- `knowledge_components`, `knowledge_prerequisites`, `mastery_records`

**Tutoring**
- `learning_sessions`, `problems`, `solution_steps`
- `conversation_messages`, `student_attempts`, `error_records`
- `solution_verifications`

**Documents and sources**
- `uploaded_documents`, `document_chunks`, `academic_sources`

**AI operations and evaluations**
- `ai_providers`, `ai_models`, `ai_requests`
- `prompt_versions`, `evaluation_runs`

**Operational support, when needed**
- usage ledger, audit log, idempotency records, outbox events, feedback, and feature configuration.

## 3. Ownership and relationships

A user owns their sessions, attempts, profile, and uploaded documents. A session belongs to one user and can reference its active problem, current step, and state version. Steps have an ordering key unique within their problem. Attempts preserve the original student submission. Verifications point to the exact claim/input, method/version, result, and limitations. Mastery references both a student and a knowledge component and retains supporting assessment evidence. Document chunks retain page/section/offset provenance. Idempotency keys are unique within a defined user and operation scope.

Enforce ownership in server-side queries or database policies; never trust a client-supplied user ID alone.

## 4. Transactions and concurrency

1. Persist an attempt before starting a slow evaluation.
2. Use unique idempotency constraints to prevent duplicate attempts on retry.
3. Use a session state version or equivalent optimistic concurrency token.
4. Atomically persist step transitions, status, and their durable messages.
5. Never keep a transaction open while waiting for an external provider.
6. If evaluation fails, preserve the attempt and record retryable/terminal failure.
7. If verification fails, preserve the failed/unavailable outcome.

## 5. JSONB and vector handling

Validate every structured JSONB payload against a versioned schema. Keep relationally constrained/searchable data in relational columns. Determine vector dimension from the exact embedding model chosen; never guess it. Deleting a source must address derived chunks, vectors, caches, and indexes.

## 6. Migration order

Create identity and academic taxonomy first; then session/problem/message entities; then steps, attempts, and verification; then documents, AI telemetry, and mastery. If sessions reference problems/current steps, add those foreign keys after the referenced tables to avoid migration cycles.

## 7. Retention and deletion

Define retention before public launch. A deletion request must account for relational rows, original objects, extracted text, embeddings, search indexes, caches, analytics identifiers, and queued jobs. Retain only data required by documented legal/operational needs.

## 8. Implementation gate

Confirm authentication, ownership/tenant model, database host, embedding model, object storage, and retention requirements before writing production migrations. This document is a logical model, not a final schema.
