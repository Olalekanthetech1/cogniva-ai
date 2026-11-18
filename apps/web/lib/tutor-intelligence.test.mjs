import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTutorTurn,
  buildAdaptiveTutorInstructions,
  buildVerifiedCorrectionResponse,
  evaluateNumericExpression,
  findIncorrectNumericClaims
} from "./tutor-intelligence.js";

test("evaluates a square root with thousands separators", () => {
  assert.equal(
    Number(evaluateNumericExpression("√61,525.12").toFixed(2)),
    247.03
  );
});

test("evaluates bounded arithmetic without executing arbitrary code", () => {
  assert.equal(evaluateNumericExpression("2 × 120 × 140 × 0.8192"), 27525.12);
  assert.equal(evaluateNumericExpression("sqrt(81) + 3^2"), 18);
  assert.equal(evaluateNumericExpression("cos 35°"), Math.cos(35 * Math.PI / 180));
  assert.equal(evaluateNumericExpression("process.exit()"), null);
  assert.equal(evaluateNumericExpression("1 / 0"), null);
});

test("detects the wrong square-root hint and preserves the verified value", () => {
  const findings = findIncorrectNumericClaims("Hint: √61,525.12 ≈ 248.04.");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].expectedText, "247.03");
  assert.equal(findings[0].claimedText, "248.04");
});

test("does not flag a correctly rounded square-root result", () => {
  assert.deepEqual(findIncorrectNumericClaims("√61,525.12 ≈ 247.03."), []);
});

test("detects a learner correction and confirms the matching value", () => {
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
  assert.equal(analysis.learnerValueMatches, true);
  assert.equal(analysis.latestTutorClaim.expectedText, "247.03");
});

test("produces an explicit correction when the learner's value is verified", () => {
  const [claim] = findIncorrectNumericClaims("√61,525.12 ≈ 248.04");
  const response = buildVerifiedCorrectionResponse({
    claim,
    learnerMessage: "My calculator gives 247.03 N. Your hint is incorrect.",
    contextText: "The forces are measured in N."
  });

  assert.match(response, /previous hint/i);
  assert.match(response, /247\.03 N/);
  assert.match(response, /not 248\.04 N/);
  assert.equal((response.match(/\?/g) ?? []).length, 1);
  assert.ok(response.endsWith("?"));
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
      { role: "tutor", content: "Try the square root. " + repeated },
      { role: "student", content: "247.03 N." },
      { role: "tutor", content: "Check it again. " + repeated },
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
  assert.equal(analysis.learnerNumericMismatches[0].expectedText, "27,525.12");
  assert.match(buildAdaptiveTutorInstructions(analysis), /learner's submitted working/i);
});

test("does not claim independent verification for unsupported expressions", () => {
  assert.deepEqual(findIncorrectNumericClaims("The material is stronger than the previous sample."), []);
  assert.equal(evaluateNumericExpression("stress = force / area"), null);
});
