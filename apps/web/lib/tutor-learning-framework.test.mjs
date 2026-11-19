import test from "node:test";
import assert from "node:assert/strict";
import {
  TUTOR_LEARNING_FRAMEWORK_VERSION,
  getTutorLearningModeConfig,
  buildTutorLearningFrameworkInstructions,
  resolveTutorLearningMode,
  validateTutorLearningOutput
} from "./tutor-learning-framework.js";

const validLesson = [
  "## Learning objectives",
  "- Explain the relationship between a function and its derivative.",
  "- Calculate a derivative using the power rule.",
  "",
  "## Detailed explanation",
  "The derivative describes the instantaneous rate of change of a function. It is defined using a limit of average rates of change. The power rule provides an efficient method for differentiating powers of x when its conditions apply.",
  "",
  "## Worked example",
  "Given f(x) = x², differentiate with respect to x. Apply the power rule: multiply by the exponent, then reduce the exponent by one. Therefore f'(x) = 2x. Substituting x = 3 gives a derivative value of 6.",
  "",
  "## Practical application",
  "In a motion model, the derivative of position with respect to time gives velocity. This is an illustrative mathematical model, not measured experimental data.",
  "",
  "## Guided practice",
  "For g(x) = x³, what derivative do you obtain using the power rule?"
].join("\n");

const validConceptLesson = [
  "## Core idea",
  "Differentiation finds the instantaneous rate at which a function changes.",
  "",
  "## Explanation",
  "It is defined from the limit of average change over a shrinking interval. The derivative therefore describes the local slope of the function when the limit exists.",
  "",
  "## Example",
  "For f(x) = x², the power rule gives f'(x) = 2x. At x = 3, the slope is 6.",
  "",
  "## Check your understanding",
  "For g(x) = x³, what derivative follows from the power rule?"
].join("\n");

const validProblemSolution = [
  "## Understand the problem",
  "The problem gives a position function and asks for velocity at a specified time.",
  "",
  "## Governing principle",
  "Velocity is the derivative of position with respect to time.",
  "",
  "## Strategy",
  "Differentiate the position function first, then substitute the requested time.",
  "",
  "## Work through the solution",
  "For s(t) = t², v(t) = ds/dt = 2t. At t = 3 s, v = 6 m/s.",
  "",
  "## Verify and interpret",
  "The units are metres per second, as expected for velocity.",
  "",
  "## Transfer check",
  "For s(t) = t³, what expression gives the velocity?"
].join("\n");

test("publishes the unified CTL 1.1 framework version", () => {
  assert.equal(TUTOR_LEARNING_FRAMEWORK_VERSION, "ctl-1.2.0");
});

test("keeps linked-unit opening and continuation routing unchanged", () => {
  assert.equal(resolveTutorLearningMode({ hasLinkedUnit: true, latestSubmissionType: "initial_prompt" }), "structured_lesson_opening");
  assert.equal(resolveTutorLearningMode({ hasLinkedUnit: true, latestSubmissionType: "question", learnerIntent: "clarification" }), "structured_lesson_continuation");
});

test("routes standalone concept and topic starts to a concept mini-lesson", () => {
  for (const sessionIntent of ["understand_concept", "learn_topic"]) {
    assert.equal(resolveTutorLearningMode({
      hasLinkedUnit: false,
      latestSubmissionType: "initial_prompt",
      sessionIntent,
      learnerIntent: "clarification",
      latestStudentMessage: "What is differentiation?"
    }), "concept_mini_lesson");
  }
});

test("routes standalone problem starts and subsequent problem turns to problem-solving mode", () => {
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "initial_prompt",
    sessionIntent: "solve_problem"
  }), "problem_solving");
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "solve_problem",
    learnerIntent: "follow_up"
  }), "problem_solving");
});

test("routes submitted attempts to feedback independently of the original session intent", () => {
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "attempt",
    sessionIntent: "solve_problem",
    learnerIntent: "work_attempt"
  }), "attempt_feedback");
});

test("routes later clarifications and correction challenges to concise clarification mode", () => {
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "solve_problem",
    learnerIntent: "clarification"
  }), "quick_clarification");
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "understand_concept",
    learnerIntent: "correction_challenge"
  }), "quick_clarification");
});

test("routes explicit complete concept answers to a mini-lesson and preserves a safe fallback", () => {
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "understand_concept",
    learnerIntent: "direct_answer_request"
  }), "concept_mini_lesson");
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "learn_topic",
    learnerIntent: "follow_up"
  }), "adaptive_socratic");
});

test("creates concept mini-lesson instructions with explanation, example and a checkpoint", () => {
  const instructions = buildTutorLearningFrameworkInstructions({ mode: "concept_mini_lesson" });
  for (const phrase of ["Core idea", "Explanation", "Example", "Check your understanding"]) assert.ok(instructions.includes(phrase));
  assert.match(instructions, /direct plain-language answer/i);
});

test("creates problem-solving instructions with verification and transfer steps", () => {
  const instructions = buildTutorLearningFrameworkInstructions({ mode: "problem_solving" });
  for (const phrase of ["Understand the problem", "Governing principle", "Strategy", "Work through the solution", "Verify and interpret", "Transfer check"]) assert.ok(instructions.includes(phrase));
  assert.match(instructions, /do not invent/i);
  assert.match(instructions, /units/i);
});

test("creates attempt-feedback instructions that preserve valid reasoning", () => {
  const instructions = buildTutorLearningFrameworkInstructions({ mode: "attempt_feedback" });
  assert.match(instructions, /preserve valid reasoning/i);
  assert.match(instructions, /first incorrect, incomplete, or unsupported step/i);
  assert.match(instructions, /do not infer a cognitive misconception/i);
});

test("creates direct clarification instructions without restarting a lesson", () => {
  const instructions = buildTutorLearningFrameworkInstructions({ mode: "quick_clarification" });
  assert.match(instructions, /answer the learner's specific clarification directly/i);
  assert.match(instructions, /do not restart a lesson/i);
});

test("creates structured opening instructions with required linked-unit sections", () => {
  const instructions = buildTutorLearningFrameworkInstructions({ mode: "structured_lesson_opening" });
  for (const section of ["Learning objectives", "Detailed explanation", "Worked example", "Practical application", "Guided practice"]) assert.ok(instructions.includes(section));
});

test("clarifications in linked-unit continuations do not force stage advancement", () => {
  const instructions = buildTutorLearningFrameworkInstructions({
    mode: "structured_lesson_continuation",
    learnerIntent: "clarification"
  });
  assert.match(instructions, /do not advance the teaching sequence/i);
  assert.match(instructions, /answer the exact question directly/i);
});

test("accepts a structured linked-unit opening with required sections and one final question", () => {
  assert.equal(validateTutorLearningOutput({
    text: validLesson,
    finishReason: "stop",
    mode: "structured_lesson_opening"
  }), null);
});

test("rejects a linked-unit opening that omits a required section", () => {
  const incomplete = validLesson.replace(
    "## Practical application\nIn a motion model, the derivative of position with respect to time gives velocity. This is an illustrative mathematical model, not measured experimental data.\n\n",
    ""
  );
  assert.match(validateTutorLearningOutput({
    text: incomplete,
    finishReason: "stop",
    mode: "structured_lesson_opening"
  }), /missing required sections: Practical application/);
});

test("requires two to four list-form objectives in structured openings", () => {
  const oneObjective = validLesson.replace("- Calculate a derivative using the power rule.\n", "");
  assert.match(validateTutorLearningOutput({
    text: oneObjective,
    finishReason: "stop",
    mode: "structured_lesson_opening"
  }), /between two and four/);
});

test("accepts concept mini-lessons with the teaching sequence", () => {
  assert.equal(validateTutorLearningOutput({
    text: validConceptLesson,
    finishReason: "stop",
    mode: "concept_mini_lesson"
  }), null);
});

test("rejects a concept mini-lesson that omits its example or exceeds the response budget", () => {
  const incomplete = validConceptLesson.replace(
    "## Example\nFor f(x) = x², the power rule gives f'(x) = 2x. At x = 3, the slope is 6.\n\n",
    ""
  );
  assert.match(validateTutorLearningOutput({
    text: incomplete,
    finishReason: "stop",
    mode: "concept_mini_lesson"
  }), /missing required sections: Example/);
  const oversized = validConceptLesson.replace(
    "For g(x) = x³, what derivative follows from the power rule?",
    "detail ".repeat(270) + "For g(x) = x³, what derivative follows from the power rule?"
  );
  assert.match(validateTutorLearningOutput({
    text: oversized,
    finishReason: "stop",
    mode: "concept_mini_lesson"
  }), /exceeded Cogniva's response limit/);
});

test("accepts problem-solving responses with ordered reasoning and a transfer checkpoint", () => {
  assert.equal(validateTutorLearningOutput({
    text: validProblemSolution,
    finishReason: "stop",
    mode: "problem_solving"
  }), null);
});

test("rejects problem-solving output that omits its verification section", () => {
  const incomplete = validProblemSolution.replace(
    "## Verify and interpret\nThe units are metres per second, as expected for velocity.\n\n",
    ""
  );
  assert.match(validateTutorLearningOutput({
    text: incomplete,
    finishReason: "stop",
    mode: "problem_solving"
  }), /missing required sections: Verify and interpret/);
});

test("validates attempt feedback and concise clarification without imposing lesson headings", () => {
  const feedback = "You correctly identified the derivative as the quantity needed for velocity. The missing step is differentiating the position function before substituting the time. Differentiate it first, then evaluate the result at the given time. What derivative do you obtain?";
  const clarification = "The derivative is the instantaneous rate of change. For a position function, it gives velocity because it measures how position changes with time. Would a small numerical example help?";
  assert.equal(validateTutorLearningOutput({ text: feedback, finishReason: "stop", mode: "attempt_feedback" }), null);
  assert.equal(validateTutorLearningOutput({ text: clarification, finishReason: "stop", mode: "quick_clarification" }), null);
});

test("rejects truncated output and multiple or missing closing questions", () => {
  assert.match(validateTutorLearningOutput({
    text: validConceptLesson,
    finishReason: "length",
    mode: "concept_mini_lesson"
  }), /output limit/);
  assert.match(validateTutorLearningOutput({
    text: validConceptLesson.replace("what derivative follows", "what derivative follows?"),
    finishReason: "stop",
    mode: "concept_mini_lesson"
  }), /exactly one clear/);
  assert.match(validateTutorLearningOutput({
    text: validConceptLesson.replace("what derivative follows from the power rule?", "Use the power rule to differentiate it."),
    finishReason: "stop",
    mode: "concept_mini_lesson"
  }), /exactly one clear/);
});

test("rejects numeric mismatches when the bounded checker supplies evidence", () => {
  assert.match(validateTutorLearningOutput({
    text: validProblemSolution,
    finishReason: "stop",
    mode: "problem_solving",
    numericMismatchCount: 1
  }), /bounded arithmetic check/);
});


test("routes explicit learner assistance requests without forcing the original session mode", () => {
  for (const learnerIntent of [
    "hint_request",
    "simplification_request",
    "example_request",
    "recap_request"
  ]) {
    assert.equal(resolveTutorLearningMode({
      hasLinkedUnit: false,
      latestSubmissionType: "question",
      sessionIntent: "solve_problem",
      learnerIntent
    }), "quick_clarification");
  }
});

test("allows an explicit new task to switch away from the original session intent", () => {
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "understand_concept",
    requestedLearningMode: "problem_solving"
  }), "problem_solving");
  assert.equal(resolveTutorLearningMode({
    hasLinkedUnit: false,
    latestSubmissionType: "question",
    sessionIntent: "solve_problem",
    requestedLearningMode: "concept_mini_lesson"
  }), "concept_mini_lesson");
});

test("adds action-specific hint, simplification, example and recap guidance", () => {
  const guidance = [
    ["hint_request", /next useful hint|next level/i],
    ["simplification_request", /plainer language|different representation/i],
    ["example_request", /new, relevant example/i],
    ["recap_request", /only what the conversation actually covered/i]
  ];

  for (const [learnerIntent, expected] of guidance) {
    const instructions = buildTutorLearningFrameworkInstructions({
      mode: "quick_clarification",
      learnerIntent
    });
    assert.match(instructions, expected);
  }
});

test("keeps linked-unit continuity while adapting the requested teaching action", () => {
  const mode = resolveTutorLearningMode({
    hasLinkedUnit: true,
    latestSubmissionType: "question",
    learnerIntent: "hint_request"
  });
  const instructions = buildTutorLearningFrameworkInstructions({
    mode,
    learnerIntent: "hint_request"
  });

  assert.equal(mode, "structured_lesson_continuation");
  assert.match(instructions, /direction, recall of a relevant principle/i);
  assert.match(instructions, /do not claim a persisted hint stage/i);
});

test("centralizes mode budgets and provides a safe fallback for unregistered future modes", () => {
  const modes = [
    "adaptive_socratic",
    "structured_lesson_opening",
    "structured_lesson_continuation",
    "concept_mini_lesson",
    "problem_solving",
    "attempt_feedback",
    "quick_clarification"
  ];

  for (const mode of modes) {
    const config = getTutorLearningModeConfig(mode);
    assert.ok(config.maxOutputTokens > 0, mode);
    assert.ok(config.maxWords > 0, mode);
    assert.ok(config.maxCharacters > 0, mode);
    assert.ok(config.responseLengthInstruction.length > 0, mode);
  }

  assert.equal(
    getTutorLearningModeConfig("future_unregistered_mode").maxOutputTokens,
    getTutorLearningModeConfig("adaptive_socratic").maxOutputTokens
  );
});

test("validates adaptive Socratic output through the same framework contract", () => {
  assert.equal(validateTutorLearningOutput({
    text: "The derivative measures the instantaneous rate of change. Which part would you like to examine?",
    finishReason: "stop",
    mode: "adaptive_socratic"
  }), null);
  assert.match(validateTutorLearningOutput({
    text: "detail ".repeat(90) + "What would you like to do next?",
    finishReason: "stop",
    mode: "adaptive_socratic"
  }), /concise-response limit/);
});
