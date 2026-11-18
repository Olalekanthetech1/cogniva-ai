export function shouldPersistDeterministicAttemptEvaluation(input) {
  if (!input || typeof input !== "object") return false;

  const evaluation = input.evaluation;
  return (
    input.latestSubmissionType === "attempt" &&
    input.responseSource === "deterministic_verifier" &&
    evaluation !== null &&
    typeof evaluation === "object" &&
    !Array.isArray(evaluation) &&
    typeof evaluation.method === "string" &&
    evaluation.method.trim().length > 0 &&
    Number.isFinite(evaluation.expectedValue) &&
    Number.isFinite(evaluation.submittedValue) &&
    typeof evaluation.isCorrect === "boolean"
  );
}
