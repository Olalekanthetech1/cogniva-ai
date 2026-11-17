# Cogniva — Software Architecture

**Status:** Proposed baseline · **Style:** Modular monolith in a TypeScript monorepo.

## 1. Goals

Support a responsive university learning companion across disciplines; isolate tutoring, subject reasoning, AI providers, verification, documents, and persistence; enforce stepwise session state; keep provider/infrastructure choices replaceable; avoid premature microservices; and make uncertainty and failure explicit.

## 2. Target repository layout

```text
cogniva-ai/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       └── styles/
├── packages/
│   ├── database/{schema,migrations,queries}/
│   ├── ai-core/{providers,routing,prompts,schemas,evaluation}/
│   ├── tutoring/{sessions,state-machine,socratic,error-analysis,summaries}/
│   ├── subjects/{mathematics,physics,chemistry,computer-science,economics,general}/
│   ├── verification/
│   ├── documents/
│   ├── curriculum/
│   ├── shared/
│   └── ui/
├── workers/
│   ├── document-processing/
│   └── background-jobs/
├── tests/{unit,integration,e2e,evaluations}/
├── docs/{PRD,ARCHITECTURE,DATABASE,API,ZERO_MOCK,IMPLEMENTATION_PLAN}.md
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Subject folders initially remain modules inside one `packages/subjects` workspace package; they do not need separate package manifests. Other folders become real workspace packages only when they contain an implementation and their own dependency boundary. A directory placeholder is not a completed feature.

## 3. Proposed technology choices

These are recommendations, not installed dependencies:
- Web: Next.js App Router, React, TypeScript.
- Workspace: pnpm.
- Persistence: PostgreSQL, Drizzle ORM, versioned SQL migrations.
- AI orchestration: provider-neutral interfaces; Vercel AI SDK is a candidate integration layer.
- Mathematical verification: isolated SymPy-based service/worker for supported symbolic operations.
- Math rendering/input: KaTeX and MathLive where needed.
- Retrieval: PostgreSQL with pgvector; vector dimension must match the actual selected embedding model.
- Files: private object storage and short-lived signed URLs.
- Background work: durable queue only for long-running/retryable jobs.
- Hosting: choose Vercel, Render, or another host after validating web, database, worker, and cost requirements.

Do not install all candidate dependencies at once. Select and validate each during the relevant phase.

## 4. Layer responsibilities

- `apps/web`: routing, pages, accessible UI, auth presentation, uploads, session display. No secrets or authoritative domain rules.
- `packages/shared`: shared types, runtime schemas, errors, identifiers, and cross-package contracts.
- `packages/tutoring`: state machine, session orchestration, Socratic policy, hint progression, attempt/error workflows, summaries.
- `packages/ai-core`: provider adapters, model registry, routing, prompts, structured outputs, retries, usage, evaluations.
- `packages/subjects`: subject-specific interpretation/reasoning modules with explicit capabilities.
- `packages/verification`: deterministic checks with method, assumptions, inputs, outputs, status, and limitations.
- `packages/database`: schema, migrations, queries, transactions, data access.
- `packages/documents`: upload validation, extraction, chunking, embeddings, access control, provenance, retrieval.
- `packages/curriculum`: institution-independent academic taxonomy and versioned curriculum metadata.
- `packages/ui`: reusable presentation components without domain-specific server logic.
- `workers`: durable document/background workloads; idempotent, observable, retry-safe.
- `tests`: unit, integration, end-to-end, and AI evaluation suites.

## 5. Subject adapter contract

Every subject adapter declares its ID/version, supported input and task types, interpretation capability, reasoning capability, verification capability/limits, knowledge-component mapping, and structured unsupported-task behaviour. The common tutoring engine calls this contract. UI components should not contain subject-name conditionals.

## 6. AI provider routing

Route by task capability, configured availability, schema compatibility, latency, and cost limits. Distinguish reasoning, multimodal interpretation, embeddings, external research, and independent verification. A fallback is valid only when an explicitly configured alternative supports the same required capability and output contract. Record the actual provider/model. If no compatible provider exists, return an observable failure; never substitute a canned answer.

## 7. Tutoring state machine

Suggested states: `created`, `interpreting`, `needs_confirmation`, `ready`, `guiding`, `awaiting_attempt`, `explaining_why`, `evaluating_attempt`, `correcting_misconception`, `completed`, `failed`, `cancelled`.

Invariants:
1. Clarification does not change the current step.
2. Failed model/parser requests do not complete a step.
3. Failed/unavailable verification never becomes success.
4. Student attempts are persisted before asynchronous evaluation.
5. Retries are idempotent and do not duplicate attempts/messages.
6. Only explicit valid continuation advances the current step.
7. State-changing operations use optimistic concurrency/version checks.
8. Historical steps and attempts remain auditable.

Persist state, current step, messages, and version consistently in a transaction. Do not hold a database transaction open across an external AI request.

## 8. Typical request flow

Authenticated client submits input + idempotency key → API validates and creates records → interpreter returns structured content + uncertainty → student confirms if required → tutoring engine requests a structured next-step proposal → verification checks supported claims → response is persisted with provenance and state version → client renders the step → server validates the next student action.

## 9. Security and privacy

Keep secrets server-side. Enforce ownership on every student record. Validate upload size/type, parse safely, store privately, and use short-lived access URLs. Protect URL fetching against SSRF, private-range redirects, DNS rebinding, and oversized responses. Treat uploads/retrieved text as untrusted data, not privileged instructions. Define deletion/retention for originals, extracted text, embeddings, caches, and queued work.

## 10. Reliability and observability

AI, parsing, and verification operations need correlation IDs, status, duration, provider/tool, retry count, and redacted error metadata. Define bounded timeouts/retries. Persist enough evidence to diagnose failed workflows without retaining unnecessary sensitive content.

## 11. Testing

Unit-test state transitions, hints, schemas, adapters, and verifiers. Integration-test transactions, provider adapters, uploads, ownership, and idempotency. End-to-end test student journeys on mobile and desktop. Evaluate Socratic discipline, correctness, calibration, uncertainty, citation fidelity, unsupported-task handling, and the no-advance clarification invariant.

## 12. Architecture decision rule

Prefer the simplest design that preserves domain boundaries and measurable reliability. Add a service, queue, package, provider, or deployment boundary only when a concrete capability or operational requirement justifies it.
