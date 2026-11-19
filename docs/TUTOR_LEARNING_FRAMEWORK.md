# Cogniva Tutor Learning Framework (CTL) v1.1

**Status:** The unified response-mode resolver, prompt policies, output limits, and regression tests are implemented in the Tutor response path in this pull request. This framework does not introduce persisted lesson-stage transitions, explicit stage controls, mastery scoring, or a claim of academic validation.

## 1. Purpose and boundaries

CTL defines how Cogniva teaches across linked-unit and standalone Tutor sessions. The selected mode controls instructional depth and response validation; it is not a persisted workflow state machine. The Tutor continues to use authenticated, owner-scoped, saved sessions, messages, and attempts.

The learner's starting intent is stored with the session. The server combines that intent with the latest turn classification and session linkage to select a response mode. Learner text cannot request a privileged mode or override system policy.

## 2. Response modes and routing

| Mode | When selected | Teaching contract |
|---|---|---|
| Structured lesson opening | First response for an approved linked learning-plan unit | Learning objectives, detailed explanation, worked example, practical application, and guided practice |
| Structured lesson continuation | Later turns for that linked unit | Continue from actual conversation context; adapt to clarifications, attempts, hints, practice, or recap |
| Concept mini-lesson | Initial standalone `understand_concept` or `learn_topic` session; also an explicit complete concept explanation request | Direct answer, deeper explanation, example, and understanding checkpoint; application when relevant |
| Problem-solving | Standalone `solve_problem` session turns, except when the learner submits an attempt or asks a clarification | Understand the problem, governing principle, strategy, worked reasoning, verification, and transfer check |
| Attempt feedback | A learner explicitly submits an attempt | Preserve correct work, diagnose the first evidenced issue, explain why, and give one useful next step |
| Quick clarification | A later clarification or correction challenge | Answer the exact question directly without restarting or advancing the broader lesson/problem sequence |
| Adaptive Socratic | Safe fallback when no richer mode is justified | One focused next step and concise, turn-aware guidance |

Linked-unit routing takes precedence so its first response remains a structured lesson opening and later linked-unit turns remain adaptive continuations. In standalone sessions, submitted attempts route to feedback; later clarifications and correction challenges route to quick clarification; the persisted session intent selects concept teaching or problem-solving where appropriate.

The response mode may change on the next learner turn. It is not a stage number, mastery result, completion event, or learner-controlled override.

## 3. Concept mini-lesson

A standalone concept or topic start must not be reduced to a one-line hint. Its opening follows this concise instructional structure:

1. **Core idea:** answer the learner directly in plain language.
2. **Explanation:** develop the principle, intuition, conditions, assumptions, and relevant misconception.
3. **Example:** demonstrate one accurate example with meaningful reasoning.
4. **Application:** add a genuine disciplinary or practical connection when it materially helps; label constructed scenarios as illustrative.
5. **Check your understanding:** finish with one unworked checkpoint or transfer question.

The response validator requires the Core idea, Explanation, Example, and Check your understanding headings in order. Application is useful but optional because some abstract concepts do not have a meaningful practical example in the available context. Output is bounded and must end with exactly one learner-facing question.

## 4. Problem-solving mode

For a standalone problem, Tutor follows this sequence:

1. **Understand the problem:** identify givens, required result, conditions, and assumptions.
2. **Governing principle:** name the relevant law, theorem, formula, or principle and explain why it applies.
3. **Strategy:** outline the method before calculation.
4. **Work through the solution:** show meaningful steps, reasoning, and units.
5. **Verify and interpret:** check arithmetic, signs, units, dimensions, and consistency with the stated conditions. State the scope of any deterministic check.
6. **Transfer check:** ask one related question or test the next meaningful step.

The response validator requires these section headings in order. If information is missing or the prompt is ambiguous, Tutor must identify what is known and what is missing instead of inventing a value or forcing a numerical result. A complete worked solution is appropriate when the learner explicitly requests one.

## 5. Attempt feedback and progressive assistance

When the learner submits an attempt:

- Preserve valid reasoning and identify the first incorrect, incomplete, or unsupported step.
- Explain why that step needs attention; do not merely label the work right or wrong.
- Use a deterministic result only when the expression falls within Cogniva's documented bounded arithmetic support.
- An arithmetic mismatch proves only that the explicit arithmetic result differs; it does not establish the learner's cognitive cause or misconception.
- Offer one useful next action: revise a step, receive a directional hint, recall a principle, break the task into a smaller step, or inspect a partial/full solution when requested or needed.

The assistance gradient is: **direction → relevant recall → smaller scaffold → partial/complete solution**. The model should not reveal the complete answer prematurely, but it must respect a clear request for a full worked solution. Attempt status and message history do not establish mastery.

## 6. Clarification and mode switching

A clarification receives a direct answer to the exact question. The Tutor can change representation, give a smaller example, or restate a definition. Clarification must not restart a structured lesson or silently advance the problem-solving sequence.

A correction challenge requires reassessing the disputed claim. The Tutor must neither defend nor accept a claim automatically. It should use available evidence, acknowledge a supported error, and state when independent checking is unavailable.

Intent classification and mode routing are bounded heuristics over the latest learner turn, persisted session intent, and available conversation. They do not guarantee perfect semantic classification. When the evidence does not justify a richer mode, the resolver falls back to adaptive Socratic dialogue.

## 7. Quality and evidence rules

1. **Correctness before fluency.** Explain assumptions, notation, units, and limitations.
2. **No false verification.** A provider-generated explanation is not deterministic proof. Only documented bounded checks may produce a verified status, and only within their stated scope.
3. **No fabricated context.** Never invent syllabi, prerequisites, sources, research results, experimental measurements, or learner history.
4. **No premature mastery.** Tutor messages and one correct attempt do not establish mastery, objective completion, or durable learning.
5. **No false progress UI.** This framework does not expose lesson-stage completion or percentages; those events are not persisted.
6. **Adaptive depth.** Keep a clarification concise, but teach a new concept or problem with enough context and reasoning to support reuse.
7. **Learner agency.** Accept requests to slow down, change approach, receive another example, or see a complete solution.
8. **Output limits.** Each instructional mode has its own word/character/token budget, truncation check, and one-question closing contract. Structured modes have required heading validation.

## 8. Runtime and persistence contract

- Reuse existing student-owned Tutor session, message, and attempt records.
- For linked-unit sessions, require the server-validated approved revision/unit linkage established by session creation.
- Derive the response mode from linkage, persisted session intent, current submission type, and turn analysis.
- Store CTL framework version and selected mode in the Tutor message metadata.
- Keep the existing session lock, optimistic version check, ownership scoping, and transaction boundaries.
- Preserve the bounded deterministic numeric checker and its narrow verification scope.
- Do not repurpose `tutor_sessions.current_step_index` as a CTL lesson-stage index.
- Add no database migration for this instructional policy slice.

## 9. Acceptance checks

- Linked-unit openings still contain the five required teaching sections in order and two to four list-form objectives.
- Linked-unit clarifications answer the exact question without restarting the lesson.
- Standalone concept/topic starts select a validated concept mini-lesson.
- Standalone problem sessions select a structured problem walkthrough with reasoning and verification.
- Explicit attempts receive attempt feedback unless a more specific bounded deterministic response applies.
- Later clarifications and correction challenges use the concise clarification mode.
- A complete answer request is respected.
- All modes stay within their output budgets, reject truncation, and end with exactly one clear learner-facing question.
- Unsupported facts, experimental results, academic requirements, mastery, and verification claims are not invented.
- Standalone fallback remains available when intent evidence is insufficient.

## 10. Deliberate limitations and future work

Not included in CTL v1.1:

- persisted lesson-stage transitions and explicit Continue/Hint/Why/Simplify/Example/Repeat controls;
- learner-controlled navigation between lesson stages;
- diagnostic assessment records or prerequisite-gap profiles;
- spaced scheduling across sessions;
- independent-practice scoring beyond supported deterministic checks;
- canonical Knowledge Component mappings, mastery estimates, or adaptive recommendations;
- guaranteed generated diagrams or multimodal content;
- independent subject-specific verification beyond the bounded checks already documented.

These require separate state, evidence, UX, and evaluation work. They must not be simulated with a stage label or model-generated progress claim.
