# Cogniva — Implementation Plan

**Status:** Sequenced roadmap; completion is based on tested behaviour, not document presence.

## Phase 0 — Repository and engineering foundation

- [x] Establish monorepo layout, documentation, and ZeroMock policy.
- [x] Add the Next.js App Router web shell.
- [x] Add Node/pnpm toolchain, lint, TypeScript checks, and GitHub Actions CI.
- [x] Verify a successful production build in CI.
- [x] Commit the generated `pnpm-lock.yaml` so installs can use frozen-lockfile mode.

**Exit:** application shell, quality checks, and reproducible dependency lockfile are in place.

## Phase 1 — Identity, persistence, and academic foundation

- [x] Add PostgreSQL/Drizzle database workspace and explicit connection factory.
- [x] Define Better Auth identity tables and authentication integration.
- [x] Define optional student profile and dynamic academic catalogue schema.
- [x] Add migration generation/application commands.
- [x] Require email verification and fail closed when auth infrastructure is not configured.
- [x] Configure the Neon PostgreSQL database and transactional email sender used by the deployed environment.
- [x] Generate, review, and apply the initial migration against the production database.
- [x] Verify registration, email verification, sign-in, and authenticated session retrieval end-to-end.
- [ ] Verify sign-out and password reset end-to-end.
- [x] Implement authenticated student-profile and read-only academic catalogue APIs with account ownership and academic hierarchy checks.
- [ ] Add automated integration tests for authentication boundaries, profile ownership, and invalid academic hierarchy submissions.

**Exit:** live identity and persistence flows work against a real database; academic metadata is dynamic and optional; CI tests cover access boundaries.

## Phase 2 — Universal tutor foundation

- [ ] Implement session/problem/message persistence.
- [ ] Implement tutoring state machine and concurrency rules.
- [ ] Implement one-step Socratic interaction contracts.
- [ ] Add prompt versions, provider adapter, and structured output validation.
- [ ] Implement `WHY_THIS_STEP`, progressive hints, and explicit continuation semantics.

**Exit:** text-based tutoring works end-to-end; clarification does not advance; failed calls do not mark steps complete.

## Phase 3 — Multimodal problem input

- [ ] Add private image upload and structured extraction.
- [ ] Add ambiguity detection and student confirmation.
- [ ] Preserve source input, confirmed transcription, and provenance.
- [ ] Add PDF support after image/text reliability is demonstrated.

**Exit:** uncertain symbols are shown for confirmation; the tutor uses confirmed transcription.

## Phase 4 — Guided learning and feedback

- [ ] Persist student attempts before evaluation.
- [ ] Add constructive error classification and correction guidance.
- [ ] Add supported answer checking with explicit verification provenance.
- [ ] Add summaries, examples, alternatives, and session recovery.

**Exit:** full mathematics vertical slice passes, including incorrect attempt, correction, and resume.

## Phase 5 — Subject reasoning and verification

- [ ] Define subject adapter and capability registry.
- [ ] Implement supported mathematical verification.
- [ ] Add other subjects incrementally and benchmark each capability.
- [ ] Sandbox code execution with explicit time, memory, and network limits.

**Exit:** every enabled capability has tests, documented limitations, and evidence-based support claims.

## Phase 6 — Learning intelligence

- [ ] Define knowledge components and prerequisites.
- [ ] Record assessment/attempt evidence.
- [ ] Implement mastery estimates with uncertainty.
- [ ] Recommend targeted practice.

**Exit:** progress explains the evidence supporting each estimate.

## Phase 7 — Academic resources

- [ ] Add secure document processing, extraction, chunking, embeddings, and retrieval.
- [ ] Cite uploaded document page/section/chunk locations.
- [ ] Add durable processing jobs and deletion of original/derived data.

**Exit:** answers distinguish document-grounded claims from general knowledge.

## Phase 8 — Product readiness

- [ ] Complete accessibility, mobile, security, privacy, and reliability review.
- [ ] Run end-to-end and AI evaluation suites.
- [ ] Add rate limits, usage controls, backups, and operational dashboards.
- [ ] Conduct closed beta and resolve evidence-backed defects.

**Exit:** release thresholds and support procedures are met.

## Definition of Done

A feature is complete only with an accepted capability boundary, runtime validation, ownership/security checks, persistence/failure semantics, appropriate tests, safe observability, accessible UI states, documentation, and compliance with [ZERO_MOCK.md](ZERO_MOCK.md).
