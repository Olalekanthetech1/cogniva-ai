# Cogniva Tutor Learning Framework (CTL) v1.2

**Status:** CTL v1.2 is implemented in the Tutor response path in this pull request. It defines provider-generated instructional modes, turn-aware routing, action-specific assistance guidance, centralized response budgets, and mode-specific validation. It does not introduce persisted lesson-stage transitions, explicit stage controls, diagnostic assessment records, mastery scoring, or academic validation.

## 1. Purpose and boundaries

CTL governs how Cogniva teaches across approved linked-unit and standalone Tutor sessions. It is an instructional policy layer, not a persisted workflow state machine.

The session's initial intent is starting context, not a permanent restriction. For the first response, high-signal wording in the actual initial prompt can refine the selected intent. For each later response, the server combines authenticated session linkage, the persisted starting intent, the latest submission type, turn analysis, and explicit task-switch signals from the learner's latest message. Recognized learner actions include clarification, correction challenge, answer request, attempt submission, hint request, simplification, example request, and recap. A clear request to start a different concept or problem can switch the standalone teaching mode. The active standalone task mode is carried forward in the existing Tutor-message metadata so an unrelated initial session intent does not reassert itself on the next turn.

The classifier uses bounded, high-signal rules rather than claiming perfect semantic understanding. When it cannot confidently identify a special action or task switch, the mode resolver preserves the session context or falls back to adaptive Socratic dialogue. Learner text cannot request a privileged mode or override system policy.

## 2. Response modes and routing

| Mode | When selected | Teaching contract |
|---|---|---|
| Structured lesson opening | First response for an approved linked learning-plan unit | Learning objectives, detailed explanation, worked example, practical application, guided practice |
| Structured lesson continuation | Later turns for that linked unit | Continue from actual context and adapt to the learner's current action |
| Concept mini-lesson | Initial standalone concept/topic session, explicit complete concept explanation, or a clear mid-session topic switch | Direct answer, deeper explanation, example, understanding checkpoint; application when relevant |
| Problem-solving opening | Initial standalone problem session, explicit complete-solution request, or a clear switch to a new problem | Understand the problem, governing principle, strategy, worked reasoning, verification, transfer check |
| Problem-solving continuation | Later ordinary turns in an existing standalone problem session | Continue from the current reasoning step without repeating the full walkthrough |
| Attempt feedback | A learner explicitly submits an attempt | Preserve correct work, identify the first evidenced issue, explain it, and give one useful next step |
| Quick clarification / focused assistance | Clarification, correction challenge, hint, simplification, example, or recap request | Address the exact requested action without restarting or silently advancing the broader task |
| Adaptive Socratic | Safe fallback when no richer mode is justified | Concise, turn-aware guidance and one focused next step |

Linked-unit sessions retain their approved unit context and use structured continuation after the opening. The continuation instructions still adapt to hints, simplification, examples, recap, attempts, clarification, and correction challenges. Standalone sessions can change mode when the learner clearly starts a different task. Ordinary follow-up turns in a problem session use a continuation mode rather than repeating the six-section opening. A response-mode change is not a stage transition, mastery result, or completion event.

## 3. Dynamic generation versus fixed instructional guardrails

The configured AI provider generates the lesson explanations, examples, calculations-as-explanations, feedback, and question content from the learner's actual prompt and available conversation. The code does not use sample lessons, mock answers, fabricated learner progress, or a canned provider-failure fallback.

Some parts are intentionally deterministic:
- The mode policy defines the teaching purpose and the quality requirements for each type of response.
- Structured modes use consistent section expectations so explanations remain teachable and reviewable.
- Response budgets and truncation checks bound provider output.
- The bounded numeric verifier may return evidence-linked feedback only for the exact arithmetic forms it supports.

These guardrails are not static lesson content. Deterministic verifier responses must remain narrowly scoped and must not be presented as general subject verification. When the configured provider is missing or unavailable, the request fails truthfully; Cogniva does not substitute a fabricated lesson.

## 4. Concept mini-lesson

A standalone concept or topic start must not be reduced to a one-line Socratic prompt. Its opening follows this concise structure:

1. **Core idea:** answer the learner directly in plain language.
2. **Explanation:** develop the principle, intuition, conditions, assumptions, and relevant misconception.
3. **Example:** demonstrate one accurate example with meaningful reasoning.
4. **Application:** add a genuine disciplinary or practical connection when it materially helps; label constructed scenarios as illustrative.
5. **Check your understanding:** finish with one unworked checkpoint or transfer question.

The validator requires the Core idea, Explanation, Example, and Check your understanding sections in order. Application remains optional because some abstract concepts do not have a meaningful practical example in the available context. Content and examples are generated for the learner's requested concept; the section contract does not supply canned content.

## 5. Problem-solving mode

For a standalone problem, Tutor follows this sequence:

1. **Understand the problem:** identify givens, required result, conditions, and assumptions.
2. **Governing principle:** name the relevant law, theorem, formula, or principle and explain why it applies.
3. **Strategy:** outline the method before calculation.
4. **Work through the solution:** show meaningful steps, reasoning, and units.
5. **Verify and interpret:** check arithmetic, signs, units, dimensions, and consistency with the stated conditions. State the scope of any deterministic check.
6. **Transfer check:** ask one related question or test the next meaningful step.

If information is missing or the prompt is ambiguous, Tutor must identify what is known and what is missing instead of inventing a value or forcing a numerical result. A complete worked solution is appropriate when the learner explicitly requests one.

## 6. Attempt feedback and progressive assistance

When the learner submits an attempt:
- Preserve valid reasoning and identify the first incorrect, incomplete, or unsupported step.
- Explain why that step needs attention; do not merely label the work right or wrong.
- Use a deterministic result only when the expression falls within Cogniva's documented bounded arithmetic support.
- An arithmetic mismatch proves only that the explicit arithmetic result differs; it does not establish the learner's cognitive cause or misconception.
- Offer one useful next action: revise a step, receive a directional hint, recall a principle, break the task into a smaller step, or inspect a partial/full solution when requested or needed.

When a learner asks for a hint, the Tutor uses conversation context to select an appropriate level: **direction → relevant recall → smaller scaffold → near-solution step**. It avoids repeating hints already given and does not reveal the complete solution unless requested or needed. Simplification requests change wording or representation; example requests produce a new contextual example; recap requests summarize only material present in the conversation.

This hint progression is inferred from visible conversation history. It is not a persisted hint-stage record, diagnostic profile, or mastery estimate.

## 7. Clarification, intent and mode switching

A clarification receives a direct answer to the exact question. The Tutor can change representation, give a smaller example, or restate a definition. Clarification must not restart a structured lesson or silently advance a problem-solving sequence.

A correction challenge requires reassessing the disputed claim. The Tutor must neither defend nor accept a claim automatically. It should use available evidence, acknowledge a supported error, and state when independent checking is unavailable.

A clear new-task request can override the starting session intent for a standalone session. The selected active task mode is recovered from the latest Tutor message metadata and carried forward across subsequent turns. A problem-solving session can switch to a new concept, and a concept/topic session can switch to a new problem. High-signal requests are classified explicitly; unclear requests retain the persisted task context or use adaptive Socratic dialogue. Linked-unit sessions keep their approved unit linkage, while the continuation policy adapts the immediate teaching action.

## 8. Extensible mode policy and output validation

Mode limits and validation contracts are defined centrally in the Tutor mode policy registry. Each registered mode declares its output-token budget, word/character limits, response-length guidance, required sections where appropriate, and whether bounded numeric mismatches block delivery.

The response route consumes this registry instead of maintaining a separate nested token-budget or validation chain. The problem-solving opening and continuation have separate registered budgets and instructional contracts. The instructional builder remains explicit so each newly added mode must receive reviewed pedagogical instructions rather than inheriting an unintended prompt. Adding a new mode requires an explicit registry entry, instructional builder branch, routing rule where appropriate, regression tests, and documentation; route-level token and response-validation conditionals are not duplicated. The configuration accessor returns the adaptive Socratic limits for an unknown key, but the output validator rejects an unregistered active mode until its contract is implemented. This is a fail-closed extension point, not an automatic implementation of future modes.

This is an extensible architecture, not a guarantee that future capabilities need no engineering. Every new teaching capability still requires an explicit policy, tests, operational limits, and evidence that the behavior is suitable.

All responses must be non-empty, non-truncated, within the registered budgets, and end with exactly one learner-facing question. Structured openings and the concept/problem modes have ordered section validation. Structured openings require two to four list-form objectives. Applicable modes reject output containing numeric claims that fail Cogniva's bounded arithmetic check.

## 9. Quality and evidence rules

1. **Correctness before fluency.** Explain assumptions, notation, units, and limitations.
2. **No false verification.** A provider-generated explanation is not deterministic proof. Only documented bounded checks may produce a verified status, and only within their stated scope.
3. **No fabricated context.** Never invent syllabi, prerequisites, sources, research results, experimental measurements, or learner history.
4. **No premature mastery.** Tutor messages and one correct attempt do not establish mastery, objective completion, or durable learning.
5. **No false progress UI.** This framework does not expose lesson-stage completion or percentages; those events are not persisted.
6. **Adaptive depth.** Keep a clarification concise, but teach a new concept or problem with enough context and reasoning to support reuse.
7. **Learner agency.** Accept requests to slow down, change approach, receive another example, or see a complete solution.
8. **Provider honesty.** Use only the administrator-configured provider/model for tutoring; do not silently switch providers or return fabricated fallback content.
9. **Traceable mode choice.** Store the framework version, selected response mode, learner action classification, any explicit requested mode, and the active standalone task context in existing Tutor-message metadata.

## 10. Runtime and persistence contract

- Reuse existing student-owned Tutor session, message, and attempt records.
- For linked-unit sessions, require the server-validated approved revision/unit linkage established by session creation.
- Derive each response mode from linkage, persisted session intent, submission type, latest-turn analysis, and explicit task-switch evidence.
- Store CTL framework version, selected response mode, learner intent, requested task mode, and active standalone task context in existing Tutor-message metadata. Recover the latest valid active task context from the prior Tutor message when continuing a standalone session.
- Keep the existing session lock, optimistic version check, ownership scoping, and transaction boundaries.
- Preserve the bounded deterministic numeric checker and its narrow verification scope.
- Do not repurpose tutor_sessions.current_step_index as a CTL lesson-stage index.
- Add no database migration for this instructional policy slice.

## 11. Acceptance checks

- Linked-unit openings contain the five required teaching sections in order and two to four list-form objectives.
- Linked-unit clarifications answer the exact question without restarting the lesson.
- Standalone concept/topic starts select a validated concept mini-lesson.
- Standalone problem sessions select a structured problem walkthrough with reasoning and verification.
- A clear new concept or problem request can switch a standalone session away from its original intent.
- Explicit attempts receive attempt feedback unless a more specific bounded deterministic response applies.
- Hint, simplification, example, recap, clarification, and correction requests receive action-specific guidance.
- Progressive hints use conversation context and do not claim a persisted stage.
- A complete answer request is respected.
- All modes stay within registered output budgets, reject truncation, and end with exactly one learner-facing question.
- Unsupported facts, experimental results, academic requirements, mastery, and verification claims are not invented.
- Unclear intent has a safe adaptive Socratic fallback.
- Provider failure preserves learner input and returns a truthful unavailable/error state.

## 12. Deliberate limitations and future work

Not included in CTL v1.2:
- persisted lesson-stage transitions and explicit Continue/Hint/Why/Simplify/Example/Repeat controls;
- persisted hint-level counters or learner-controlled navigation between lesson stages;
- diagnostic assessment records or prerequisite-gap profiles;
- spaced scheduling across sessions;
- independent-practice scoring beyond supported deterministic checks;
- canonical Knowledge Component mappings, mastery estimates, or adaptive recommendations;
- guaranteed generated diagrams or multimodal content;
- independent subject-specific verification beyond the bounded checks already documented.

These require separate state, evidence, UX, and evaluation work. They must not be simulated with a stage label or model-generated progress claim.
