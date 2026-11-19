# Cogniva Tutor Learning Framework (CTL) v1

**Status:** Accepted and implemented in the Tutor response path; the latest GitHub Actions run passed tests, lint, type checking, and production build. A persisted lesson-stage state machine, explicit stage controls, and evidence-based mastery tracking are not part of v1. A persisted lesson-stage state machine, explicit stage controls, and evidence-based mastery tracking are not part of v1.

## 1. Purpose and scope

CTL defines how Cogniva teaches, not merely how it formats a reply. It gives an approved learning-plan unit a structured instructional opening and then adapts to the learner's responses. Direct concept questions and individual problem-solving sessions remain conversational and must not be forced through a full lesson sequence.

CTL v1 is text-first. It uses the existing authenticated and persisted Tutor session, message, and attempt records. It adds no database migration and does not claim that the learner has completed a stage or mastered a unit.

## 2. Learning modes

The server chooses the mode from persisted session linkage and the current turn type; the learner cannot select a privileged mode by adding instructions to the prompt.

| Mode | Routing | Behaviour |
|---|---|---|
| Structured lesson opening | First Tutor response for a session linked to an approved learning-plan unit | Required lesson sections: learning objectives, detailed explanation, worked example, practical application, and one guided-practice checkpoint |
| Structured lesson continuation | Later turns in a session linked to an approved learning-plan unit | Continue from the actual conversation; clarify, coach attempts, scaffold, reduce hints, practise, or recap according to learner intent |
| Adaptive Socratic dialogue | Sessions not linked to an approved learning-plan unit | Preserve the existing concise, turn-aware Socratic interaction |

A linked unit is eligible only after the session-creation API has validated learner ownership, approved revision status, and active plan status. The editable initial prompt remains learner input; it is not treated as an authoritative syllabus.

## 3. Structured lesson sequence

A full lesson follows this instructional sequence. It is a teaching guide, not a mandatory checklist that every short interaction must repeat.

1. **Orient and diagnose.** Explain what the lesson will cover and use the learner's first checkpoint response to gauge prior knowledge. Do not infer a diagnosis before receiving evidence.
2. **Learning objectives.** State two to four measurable outcomes using observable verbs such as define, explain, derive, calculate, compare, or apply.
3. **Detailed explanation.** Build from intuition to formal definitions, principles, equations, assumptions, and relevant misconceptions. Explain why a method works and when it applies.
4. **Worked example.** State the givens and required result, select a method, show meaningful steps, explain each step's rationale, and check the result. For non-numeric subjects, work through a complete argument, experiment, design decision, or analysis.
5. **Practical application.** Connect the concept to a genuine disciplinary or real-world situation. Do not invent research, measurements, citations, or experimental findings. Label constructed numerical scenarios as illustrative or hypothetical.
6. **Guided practice.** Give one new unworked checkpoint. Use progressive support rather than revealing the solution prematurely.
7. **Independent practice.** Reduce support when the learner demonstrates a sound approach. Use a different task or representation and interleave related problem types when appropriate.
8. **Recap and retrieval.** Summarize key ideas, assumptions, methods, and equations, then ask the learner to retrieve or apply one of them without simply repeating the worked example.

The v1 opening renders the first five teaching sections and one guided-practice checkpoint in the first tutor response. The subsequent conversation uses adaptive continuation instructions to support explanation, guided and independent practice, and recap. A separate persisted stage engine is future work.

## 4. Turn-aware teaching policy

- **Clarification:** answer the exact question, re-explain with a different representation when useful, and do not progress just because a response was generated.
- **Attempt:** preserve correct reasoning, isolate the first incorrect or unsupported step, explain why, and ask for one revised step.
- **Progressive hints:** move from a directional hint, to relevant recall, to a smaller scaffold, to partial/full solution only when needed or explicitly requested.
- **Direct answer request:** respect an explicit request for a complete worked answer; do not use Socratic withholding as a rigid rule.
- **Correction challenge:** reassess the exact previous claim and correct it when evidence supports a correction.
- **Stuck or repeated question:** change representation, use a simpler example, or reduce the next task.
- **Independent practice:** reduce hints after a sound attempt and provide a different problem that tests transfer.
- **Recap:** use retrieval practice; ask the learner to explain or apply a key idea without notes.

These are instructional behaviours. A generated reply is not evidence that a learner completed an objective.

## 5. Quality and evidence rules

1. **Correctness before fluency.** Explain assumptions and limitations. Use deterministic verification only for the exact forms Cogniva documents as supported.
2. **No false verification.** Provider-generated reasoning is not a deterministic proof. Do not label unsupported work as correct, incorrect, or verified.
3. **No fabricated context.** Never invent a syllabus, prerequisite mapping, source, research result, experimental measurement, or learner history.
4. **No premature mastery.** Tutor messages and a single correct answer do not establish mastery, unit completion, or durable learning.
5. **No false progress UI.** CTL v1 does not expose a completion percentage or stage-completed indicator because stage events are not yet persisted as structured records.
6. **Responsive teaching.** Use equations, tables, diagrams, and examples when the interface and available source content support them. Do not claim multimodal capabilities that are not implemented.
7. **Learner agency.** Allow questions, requests to slow down, alternate explanations, and explicit requests for a complete answer.

## 6. Runtime and persistence contract

- Reuse the existing student-owned Tutor session and message records.
- Derive lesson mode from the persisted learningPlanUnitId link and the turn classification.
- Version prompts and write the CTL version/mode into Tutor message metadata for traceability.
- Keep the existing session lock, optimistic version check, owner scoping, and transaction boundaries.
- Preserve the current deterministic numeric checker and its narrow verification claims.
- Do not repurpose tutor_sessions.current_step_index as a lesson-stage index. It has no CTL stage semantics today.
- Do not add schema migrations for this instructional-format slice.

## 7. Response contract

The structured opening must contain these Markdown headings in order:

- Learning objectives
- Detailed explanation
- Worked example
- Practical application
- Guided practice

It must contain two to four objectives, one worked example appropriate to the subject, one grounded or explicitly hypothetical application, and one new unworked checkpoint. It must finish with exactly one clear learner-facing question. Truncated, over-limit, incomplete, or numerically inconsistent structured openings are not persisted as successful tutor replies.

A unit-linked continuation may be longer than an ordinary Socratic turn but remains bounded and ends with exactly one learner-facing question. Ordinary direct sessions keep the existing concise response contract.

## 8. Deliberate v1 limitations and next work

Not included in CTL v1:

- persisted lesson-stage transitions and explicit Continue/Hint/Why/Simplify/Example/Repeat controls;
- learner-controlled navigation between lesson stages;
- diagnostic assessment records or prerequisite-gap profiles;
- spaced scheduling across sessions;
- independent-practice scoring beyond supported deterministic checks;
- canonical Knowledge Component mappings, mastery estimates, or adaptive recommendations;
- diagrams or other generated media as a guaranteed capability.

These require separate state, evidence, UX, and evaluation work. They must not be simulated using a stage label or a model-generated progress claim.

## 9. Acceptance checks

- A linked unit's first Tutor response contains every required section in order and one unworked checkpoint.
- A clarification receives a direct clarification without restarting the lesson.
- A learner attempt receives feedback on its demonstrated reasoning and one appropriate next step.
- Hints become more explicit progressively; a direct request for a full answer is respected.
- The Tutor does not claim mastery, official syllabus coverage, or unsupported verification.
- Incomplete/truncated structured openings fail safely and can be retried from the saved learner prompt.
- Sessions not linked to an approved unit retain the existing adaptive Socratic response mode.
