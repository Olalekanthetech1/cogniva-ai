export type DeterministicAttemptEvaluationEvidence = {
  method: string;
  expectedValue: number;
  submittedValue: number;
  isCorrect: boolean;
};

export function shouldPersistDeterministicAttemptEvaluation(input: {
  latestSubmissionType: "attempt" | "question" | "initial_prompt";
  responseSource: "provider" | "deterministic_verifier";
  evaluation: DeterministicAttemptEvaluationEvidence | null;
}): boolean;
