import test from "node:test";
import assert from "node:assert/strict";
import {
  TUTOR_LEARNING_FRAMEWORK_VERSION,
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

test("routes only linked-unit sessions through CTL lesson modes", () => {
  assert.equal(
    resolveTutorLearningMode({ hasLinkedUnit: false, latestSubmissionType: "initial_prompt" }),
    "adaptive_socratic"
  );
  assert.equal(
    resolveTutorLearningMode({ hasLinkedUnit: true, latestSubmissionType: "initial_prompt" }),
    "structured_lesson_opening"
  );
  assert.equal(
    resolveTutorLearningMode({ hasLinkedUnit: true, latestSubmissionType: "question" }),
    "structured_lesson_continuation"
  );
});

test("publishes a stable framework version", () => {
  assert.equal(TUTOR_LEARNING_FRAMEWORK_VERSION, "ctl-1.0.0");
});

test("creates structured opening instructions with the required teaching sections", () => {
  const instructions = buildTutorLearningFrameworkInstructions({
    mode: "structured_lesson_opening"
  });
  for (const section of [
    "Learning objectives",
    "Detailed explanation",
    "Worked example",
    "Practical application",
    "Guided practice"
  ]) assert.ok(instructions.includes(section));
});

test("clarifications do not force lesson-stage advancement", () => {
  const instructions = buildTutorLearningFrameworkInstructions({
    mode: "structured_lesson_continuation",
    learnerIntent: "clarification"
  });
  assert.match(instructions, /do not advance the teaching sequence/i);
  assert.match(instructions, /answer the exact question directly/i);
});

test("accepts a structured opening with all required sections and one final question", () => {
  assert.equal(
    validateTutorLearningOutput({
      text: validLesson,
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    null
  );
});

test("rejects an opening that omits a required lesson section", () => {
  const incomplete = validLesson.replace(
    "## Practical application\nIn a motion model, the derivative of position with respect to time gives velocity. This is an illustrative mathematical model, not measured experimental data.\n\n",
    ""
  );
  assert.match(
    validateTutorLearningOutput({
      text: incomplete,
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /missing required sections: Practical application/
  );
});

test("rejects lesson sections that are present but out of order", () => {
  const outOfOrder = validLesson
    .replace("## Detailed explanation", "## TEMPORARY SECTION")
    .replace("## Worked example", "## Detailed explanation")
    .replace("## TEMPORARY SECTION", "## Worked example");
  assert.match(
    validateTutorLearningOutput({
      text: outOfOrder,
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /not in the required order/
  );
});

test("requires two to four list-form learning objectives", () => {
  const oneObjective = validLesson.replace(
    "- Calculate a derivative using the power rule.\n",
    ""
  );
  const fiveObjectives = validLesson.replace(
    "\n## Detailed explanation",
    "\n- Apply the derivative to a rate-of-change problem.\n- Interpret the derivative in context.\n- Check a derivative using a second method.\n## Detailed explanation"
  );

  assert.match(
    validateTutorLearningOutput({
      text: oneObjective,
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /between two and four/
  );
  assert.match(
    validateTutorLearningOutput({
      text: fiveObjectives,
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /between two and four/
  );
});

test("rejects unverified numeric errors in a structured lesson opening", () => {
  assert.match(
    validateTutorLearningOutput({
      text: validLesson,
      finishReason: "stop",
      mode: "structured_lesson_opening",
      numericMismatchCount: 1
    }),
    /numeric claim that did not pass/
  );
});

test("rejects truncated structured lesson output", () => {
  assert.match(
    validateTutorLearningOutput({
      text: validLesson,
      finishReason: "length",
      mode: "structured_lesson_opening"
    }),
    /output limit/
  );
});

test("rejects multiple questions or a response without a closing question", () => {
  assert.match(
    validateTutorLearningOutput({
      text: validLesson.replace("what derivative", "what derivative?"),
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /exactly one clear/
  );
  assert.match(
    validateTutorLearningOutput({
      text: validLesson.replace("what derivative do you obtain using the power rule?", "Use the power rule to find the derivative."),
      finishReason: "stop",
      mode: "structured_lesson_opening"
    }),
    /exactly one clear/
  );
});

test("allows a longer, focused continuation without enforcing opening headings", () => {
  const text = "The derivative measures instantaneous rate of change. For a power function, the power rule gives the derivative by bringing the exponent forward and reducing the exponent by one. In your earlier example, apply that rule to each term separately, keeping constants and signs intact. Which term would you differentiate first?";
  assert.equal(
    validateTutorLearningOutput({
      text,
      finishReason: "stop",
      mode: "structured_lesson_continuation"
    }),
    null
  );
});
