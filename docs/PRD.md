# Cogniva — Product Requirements Document

**Status:** Architecture baseline · **Version:** 1.0  
**Tagline:** Understand More. Think Better.

> This document specifies intended product behaviour. It is not evidence that these features have been implemented.

## 1. Vision

Cogniva is an AI-powered university learning companion. It helps students understand difficult academic material through guided reasoning, stepwise explanations, constructive feedback, and evidence-aware learning support. It should develop independent understanding rather than merely return completed answers.

**Core promise:** Do not simply give students answers. Help them understand how to arrive at those answers.

## 2. Audience and product scope

- Primary audience: undergraduate university students.
- Initial platform: responsive, mobile-first web application; PWA support when implemented.
- Academic coverage: university subjects across STEM, business, social sciences, humanities, law, and health sciences.
- Curriculum: flexible and institution-independent. University, faculty, department, course, and topic information may personalise learning but must not be required to begin.
- Subject claims: support and verification must be declared per capability. “All subjects” is the long-term product scope, not a claim of equal or independently verified capability at launch.

## 3. Product principles

1. Teach rather than merely answer; expose one meaningful reasoning step at a time.
2. Preserve student agency through attempts, progressive hints, and explicit continuation.
3. Explain the current step without silently advancing.
4. Make uncertainty, source provenance, and verification status visible.
5. Never treat model-generated agreement as independent verification.
6. Design for mobile accessibility, readable language, and professional math rendering.
7. Keep student history and uploaded materials private and access-controlled.
8. Follow the mandatory ZeroMock policy in `ZERO_MOCK.md`.

## 4. Student journeys and functional requirements

### 4.1 Ask and interpret
Students may submit text, mathematical notation, supported code, images, and academic documents. The system extracts equations, symbols, text, tables, and relevant diagram information. It distinguishes observed content from inferred meaning. Ambiguous or incomplete extraction must be shown to the student for correction/confirmation before it is used as the problem statement.

### 4.2 Socratic tutoring
A session presents one pedagogically meaningful current step. The student can:
- ask “Why did we do that?”;
- request a progressive hint;
- ask for simpler wording or a related example;
- submit an attempt;
- request an answer check where supported;
- explicitly continue, repeat, or end the session.

The `WHY_THIS_STEP` action explains the specific operation/principle and its assumptions. It must not advance the current step. Only a valid explicit continuation may advance.

### 4.3 Attempts and error correction
Persist the original student attempt before evaluating it. Feedback should explain what is wrong, why it is wrong, and how to correct it without shaming the student. Classify errors only when supported by evidence, including arithmetic, algebra, sign, substitution, concept/principle selection, unit conversion, dimensional inconsistency, incomplete reasoning, code syntax/logic, or unsupported factual claims. Preserve an “uncertain/unclassified” outcome when evidence is insufficient.

Hints should progress from a conceptual nudge to more specific guidance. Do not label a full solution as a hint.

### 4.4 Completion and transfer
On completion, offer a grounded concept summary, key principles and assumptions, a valid alternative method where one exists, a relevant real-world application, and follow-up practice. Do not invent an alternative method, application, or source to fill a UI slot.

### 4.5 Academic documents
Students can upload supported lecture notes and course materials. Processing should extract, chunk, and index content with page/section provenance. Document-grounded answers cite the student's accessible source. When a claim is not supported by the uploaded material, say so and distinguish general subject knowledge from document evidence.

### 4.6 Learning progress
Track learning through attempts, repeated performance, error patterns, knowledge components, and transfer to new problems. Time spent or one correct response must not automatically equal mastery. Mastery estimates retain their evidence and uncertainty.

## 5. Subject coverage

The architecture should support mathematics/statistics, physics, chemistry, engineering, computer science, economics/business, biological/life sciences, health sciences, social sciences, arts/humanities, and law.

Each subject adapter declares:
- supported input/task types;
- interpretation and reasoning capabilities;
- available verification capabilities and limitations;
- relevant knowledge components;
- structured unsupported-task/error responses.

Examples: symbolic math checks may use a computer algebra system; code needs isolated execution and tests; law requires jurisdiction and date awareness. Natural-language model output alone is not independent verification.

## 6. Functional acceptance summary

| ID | Requirement | Acceptance condition |
|---|---|---|
| FR-01 | Question input | Student can submit, view, and resume a question. |
| FR-02 | Image interpretation | Extracted content is reviewable; uncertainty can be confirmed. |
| FR-03 | Guided tutoring | One current step is shown; continuation is explicit. |
| FR-04 | Clarification | Asking why/simplifying does not advance the session. |
| FR-05 | Hints | Progressive hints do not falsely claim correctness. |
| FR-06 | Attempt evaluation | Original attempt is retained and feedback is evidence-based. |
| FR-07 | Correction | Supported errors receive constructive explanation. |
| FR-08 | Summary | Completed problem can produce a grounded summary. |
| FR-09 | Alternatives | Only valid, available alternative methods are offered. |
| FR-10 | Documents | Document-grounded answers cite accessible source locations. |
| FR-11 | Progress | Mastery uses explicit evidence and knowledge components. |
| FR-12 | Persistence | Student can leave and resume without losing committed work. |
| FR-13 | Capability transparency | Unsupported or failed operations are reported honestly. |

## 7. Non-functional requirements

- Correctness: preserve assumptions, domains, units, and constraints; use deterministic checks where supported.
- Reliability: failed model/parser/database/verifier operations must not become successful state transitions.
- Security: authentication, record ownership, input validation, private uploads, server-side secrets, rate limits.
- Privacy: minimise collection; define retention/deletion across files and derived data.
- Performance: stream safe interactive output; queue long document processing durably.
- Accessibility: target WCAG 2.2 AA practices for contrast, labels, focus, keyboard, and assistive technologies.
- Observability: request IDs, latency, provider/model, retry and cost metadata, safe error records; redact secrets.
- Maintainability: typed contracts, migrations, tests, versioned prompts, clear package ownership.

## 8. First end-to-end milestone

Build one complete Socratic mathematics workflow:
1. Student submits a text or image problem.
2. System extracts the statement and requests confirmation when ambiguous.
3. Tutor creates a first step with an independently checked mathematical claim where supported.
4. Student asks why; the system explains without advancing.
5. Student submits an incorrect attempt; it is preserved and analysed.
6. Tutor guides correction and evaluates the revised attempt.
7. Student explicitly continues; only then does the session advance.
8. Problem is completed with a concept summary.
9. Student leaves and resumes with state and history intact.

This is a vertical slice to validate the core tutoring loop, not a permanent restriction to mathematics.

## 9. Success measures

Measure guided workflow completion, correctness/calibration of verification, transcription correction rate, related-problem transfer, repeated error reduction, session recovery, provider failure rates, and student-reported clarity. Do not use message volume or time spent as proxies for learning.

## 10. Not required for the first vertical slice

An LMS replacement, institutional administration suite, live classes, social feeds, automated grading for whole courses, payments, and universal expert verification are not prerequisites. Consider them only through later product decisions.
