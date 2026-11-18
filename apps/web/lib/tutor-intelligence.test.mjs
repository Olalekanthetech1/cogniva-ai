import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTutorTurn,
  buildAdaptiveTutorInstructions,
  buildVerifiedCorrectionResponse,
  evaluateNumericExpression,
  findIncorrectNumericClaims,
  findNumericClaims
} from "./tutor-intelligence.js";

test("evaluates a square root with thousands separators", () => {
  assert.equal(
    Number(evaluateNumericExpression("√61,525.12").toFixed(2)),
    248.04
  );
});

test("evaluates bounded arithmetic without executing arbitrary code", () => {
  assert.ok(Math.abs(evaluateNumericExpression("2 × 120 × 140 × 0.8192") - 27525.12) < 1e-8);
  assert.ok(Math.abs(evaluateNumericExpression("2(120)(140)(.8192)") - 27525.12) < 1e-8);
  assert.equal(evaluateNumericExpression("sqrt(81) + 3^2"), 18);
  assert.ok(Math.abs(evaluateNumericExpression("cos(60°)") - 0.5) < 1e-12);
  assert.ok(Math.abs(evaluateNumericExpression("cos(60°)") - Math.cos(Math.PI / 3)) < 1e-12);
  assert.ok(Math.abs(evaluateNumericExpression("sin 30°") - 0.5) < 1e-12);
  assert.equal(evaluateNumericExpression("12 * (7 - 2)"), 60);
  assert.equal(evaluateNumericExpression("-2^2"), -4);
  assert.equal(evaluateNumericExpression("(-2)^2"), 4);
  assert.equal(evaluateNumericExpression("2^-2"), 0.25);
  assert.equal(evaluateNumericExpression("process.exit()"), null);
  assert.equal(evaluateNumericExpression("1 / 0"), null);
});

test("detects the wrong square-root hint and preserves the verified value", () => {
  const findings = findIncorrectNumericClaims("Hint: √61,525.12 ≈ 247.03.");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].expectedText, "248.04");
  assert.equal(findings[0].claimedText, "247.03");
});

test("does not flag a correctly rounded square-root result", () => {
  assert.deepEqual(findIncorrectNumericClaims("√61,525.12 ≈ 248.04."), []);
});

test("detects a learner challenge to a correct tutor calculation", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "attempt",
    messages: [
      { role: "tutor", content: "Hint: √61,525.12 ≈ 248.04." },
      { role: "student", content: "What does your calculator show?" },
      { role: "tutor", content: "Recalculate √61,525.12 carefully. What does your calculator show?" },
      { role: "student", content: "My calculator gives 247.03 N. Your hint of 248.04 N is incorrect." }
    ]
  });

  assert.equal(analysis.learnerIntent, "correction_challenge");
  assert.equal(analysis.correctionRequired, true);
  assert.equal(analysis.learnerValueMatches, false);
  assert.equal(analysis.learnerValueDiffers, true);
  assert.equal(analysis.latestTutorClaim.isCorrect, true);
  assert.equal(analysis.latestTutorClaim.expectedText, "248.04");
});

test("explains why the tutor's verified value stands when the learner reports a different value", () => {
  const [claim] = findNumericClaims("√61,525.12 ≈ 248.04");
  const response = buildVerifiedCorrectionResponse({
    claim,
    learnerMessage: "My calculator gives 247.03 N. Your hint is incorrect.",
    contextText: "The forces are measured in N."
  });

  assert.match(response, /previous tutor value|previous numeric claim/i);
  assert.match(response, /248\.04/);
  assert.match(response, /247\.03/);
  assert.match(response, /agrees at the displayed precision/i);
  assert.match(response, /show the arithmetic step by step/i);
  assert.doesNotMatch(response, /square-root input/i);
  assert.equal((response.match(/\?/g) ?? []).length, 1);
  assert.ok(response.endsWith("?"));
});

test("corrects an actually incorrect prior tutor calculation when the learner supplies the verified value", () => {
  const [claim] = findIncorrectNumericClaims("√61,525.12 ≈ 247.03");
  assert.ok(claim);
  const response = buildVerifiedCorrectionResponse({
    claim: { ...claim, isCorrect: false },
    learnerMessage: "My calculator gives 248.04 N. Your hint is incorrect.",
    contextText: "The forces are measured in N."
  });

  assert.match(response, /previous tutor value|previous numeric claim/i);
  assert.match(response, /248\.04/);
  assert.match(response, /not 247\.03/);
  assert.equal((response.match(/\?/g) ?? []).length, 1);
});

test("recognizes an explicit direct-answer request", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "question",
    messages: [
      { role: "tutor", content: "What step would you try next?" },
      { role: "student", content: "Please provide the full worked solution." }
    ]
  });

  assert.equal(analysis.learnerIntent, "direct_answer_request");
  assert.match(buildAdaptiveTutorInstructions(analysis), /provide a concise worked explanation/i);
});

test("detects repeated tutor questions and changes the strategy", () => {
  const repeated = "What does your calculator show for the square root?";
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "question",
    messages: [
      { role: "tutor", content: repeated },
      { role: "student", content: "I am checking it." },
      { role: "tutor", content: repeated },
      { role: "student", content: "It is 247.03 N." }
    ]
  });

  assert.ok(analysis.repeatedQuestionCount >= 2);
  assert.match(buildAdaptiveTutorInstructions(analysis), /change approach/i);
});

test("detects a learner's incorrect arithmetic without rejecting unrelated prose", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "attempt",
    messages: [
      { role: "tutor", content: "Substitute the values and calculate the product." },
      { role: "student", content: "2 × 120 × 140 × 0.8192 = 27,535.12" }
    ]
  });

  assert.equal(analysis.learnerNumericMismatches.length, 1);
  assert.equal(analysis.learnerNumericMismatches[0].expectedText, "27525.12");
  assert.match(buildAdaptiveTutorInstructions(analysis), /learner's submitted working/i);
});

test("does not claim independent verification for unsupported expressions", () => {
  assert.deepEqual(findIncorrectNumericClaims("The material is stronger than the previous sample."), []);
  assert.equal(evaluateNumericExpression("stress = force / area"), null);
});


test("fails closed instead of extracting a numeric suffix from prose", () => {
  assert.deepEqual(
    findIncorrectNumericClaims("A note mentions 99 before the unsupported expression 3 + 4 = 8."),
    []
  );
});

test("accepts an explicit labelled expression but not arbitrary prose", () => {
  assert.equal(findNumericClaims("Result: 12 * (7 - 2) = 60")[0]?.isCorrect, true);
  assert.deepEqual(findNumericClaims("The result is probably 12 * (7 - 2) = 60"), []);
});

test("uses rounding at displayed precision rather than symmetric half-step tolerance", () => {
  assert.equal(findNumericClaims("2.5 = 3")[0]?.isCorrect, true);
  assert.equal(findNumericClaims("2.5 = 2")[0]?.isCorrect, false);
});

test("does not interpret an ordinary question about the tutor's answer as a correction challenge", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "question",
    messages: [
      { role: "tutor", content: "Result: 3 * 4 = 12." },
      { role: "student", content: "What is your answer?" }
    ]
  });

  assert.notEqual(analysis.learnerIntent, "correction_challenge");
  assert.equal(analysis.correctionRequired, false);
});

test("does not auto-correct when the learner simply reports the same answer", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "attempt",
    messages: [
      { role: "tutor", content: "Result: 3 * 4 = 12." },
      { role: "student", content: "My answer is 12." }
    ]
  });

  assert.notEqual(analysis.learnerIntent, "correction_challenge");
  assert.equal(analysis.correctionRequired, false);
});

test("does not select an arbitrary claim when recent tutor history contains multiple calculations", () => {
  const analysis = analyzeTutorTurn({
    latestSubmissionType: "question",
    messages: [
      { role: "tutor", content: "Result: 3 + 4 = 7\nCheck: 5 + 5 = 10." },
      { role: "student", content: "Your answer is wrong." }
    ]
  });

  assert.equal(analysis.latestTutorClaim, null);
  assert.equal(analysis.correctionRequired, false);
});

test("does not infer Newtons or any other physical unit from nearby conversation text", () => {
  const [claim] = findNumericClaims("Result: sqrt(16) = 4");
  const response = buildVerifiedCorrectionResponse({
    claim,
    learnerMessage: "My calculator gives 3. Your previous value is wrong.",
    contextText: "Forces are measured in N."
  });

  assert.doesNotMatch(response, /\bN\b/);
  assert.match(response, /does not verify units/i);
});


test("covers independent arithmetic, precedence, and negative-number cases", () => {
  const cases = [
    ["0.1 + 0.2", 0.30000000000000004],
    ["2^3^2", 512],
    ["-3(4 - 7)", 9],
    ["10 / 4", 2.5],
    ["(8 + 4) / 3", 4],
    ["2 * (3 + 5)^2", 128]
  ];

  for (const [expression, expected] of cases) {
    const actual = evaluateNumericExpression(expression);
    assert.notEqual(actual, null, expression + " should be supported");
    assert.ok(Math.abs(actual - expected) <= 1e-10, expression + " should evaluate correctly");
  }
});

test("covers independent square-root and trigonometric cases", () => {
  const cases = [
    ["sqrt(0.04)", 0.2],
    ["√(144)", 12],
    ["sin(90°)", 1],
    ["cos(180°)", -1],
    ["tan(45°)", 1],
    ["cos(60°)", 0.5]
  ];

  for (const [expression, expected] of cases) {
    const actual = evaluateNumericExpression(expression);
    assert.notEqual(actual, null, expression + " should be supported");
    assert.ok(Math.abs(actual - expected) <= 1e-10, expression + " should evaluate correctly");
  }
});

test("rejects ambiguous angle units and unsupported mathematical notation", () => {
  for (const expression of [
    "sin(90)",
    "cos(1.2)",
    "log(100)",
    "ln(e)",
    "integral(x^2)",
    "x^2 + 2x + 1"
  ]) {
    assert.equal(evaluateNumericExpression(expression), null, expression + " must remain unverified");
  }
});

test("rejects division by zero, invalid roots, and out-of-bound results", () => {
  for (const expression of [
    "10 / 0",
    "sqrt(-1)",
    "(-1)^0.5",
    "10^1000"
  ]) {
    assert.equal(evaluateNumericExpression(expression), null, expression + " must fail closed");
  }
});

test("handles exact displayed precision for independent claims", () => {
  assert.deepEqual(findIncorrectNumericClaims("Result: 0.1 + 0.2 = 0.3"), []);
  assert.equal(findIncorrectNumericClaims("Result: 2^3^2 = 64")[0]?.expectedText, "512");
  assert.equal(findIncorrectNumericClaims("Result: sin(90°) = 0.9")[0]?.expectedText, "1");
});
