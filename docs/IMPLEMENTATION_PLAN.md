# Cogniva — Implementation Plan

**Status:** Roadmap only. The existence of a phase in this file does not mean it is complete.

## Phase 0 — Repository and engineering foundation
Establish monorepo, package boundaries, supported runtime/tooling, formatting/type/test conventions, secure environment configuration, CI, web shell, health checks, and setup documentation.

**Exit:** reproducible install/build; lint, typecheck, and tests run in CI; no secrets committed.

## Phase 1 — Identity, persistence, and academic foundation
Select authentication/session strategy; implement PostgreSQL, Drizzle, migrations, ownership boundaries, optional dynamic academic taxonomy, and idempotency/audit foundations.

**Exit:** authenticated users, isolated records, repeatable migrations, database-driven curriculum structures.

## Phase 2 — Universal tutor foundation
Implement session/problem/message persistence, tutoring state machine, Socratic action contracts, structured AI outputs, prompt versions, initial provider adapter, and truthful failure handling.

**Exit:** text tutoring works end-to-end; clarification does not advance; failed calls do not complete steps.

## Phase 3 — Multimodal problem input
Add private image upload, extraction, structured interpretation, ambiguity detection, student confirmation, and provenance. Add PDF support only after image/text reliability is demonstrated.

**Exit:** uncertain symbols are shown for confirmation; tutor uses confirmed transcription.

## Phase 4 — Guided learning and feedback
Persist attempts before evaluation; add error analysis, correction guidance, supported answer checking, summaries, alternatives, and session recovery.

**Exit:** complete mathematics vertical slice including wrong attempt, correction, and resume.

## Phase 5 — Subject reasoning and verification
Define subject adapter/capability registry; implement mathematical verification first; add physics, chemistry, computer science, economics, and general modules incrementally. Sandbox code execution with explicit time/memory/network limits. Benchmark before advertising capability.

**Exit:** every enabled capability has tests, limits, and support claims grounded in evidence.

## Phase 6 — Learning intelligence
Define knowledge components/prerequisites; record attempt/assessment evidence; implement mastery estimates with uncertainty; recommend targeted practice.

**Exit:** progress explains the evidence supporting each estimate.

## Phase 7 — Academic resources
Add secure document processing, extraction, chunking, embeddings, retrieval, source citations, durable retries, and deletion of original/derived data.

**Exit:** answers distinguish document-grounded claims from general knowledge and preserve source locations.

## Phase 8 — Product readiness
Complete accessibility, mobile, security, privacy, reliability, AI evaluations, rate limits, usage controls, backups, operational dashboards, and closed beta. Decide billing/institutional features separately.

**Exit:** release thresholds, support process, and operational controls are met.

## First implementation target

Prioritise Phase 0, then one complete text-based Socratic mathematics path. Add image interpretation once the stepwise state machine is stable. This sequence validates the core product while retaining the wider all-subject direction.

## Definition of Done

A feature is complete only with an accepted capability boundary, runtime validation, ownership/security checks, persistence/failure semantics, appropriate tests, safe observability, accessible UI states, documentation, and compliance with [ZERO_MOCK.md](ZERO_MOCK.md).
