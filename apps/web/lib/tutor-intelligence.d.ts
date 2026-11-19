export type TutorMessageForAnalysis = {
  role: "student" | "tutor";
  content: string;
};

export type NumericClaimMismatch = {
  expression: string;
  operator: "=" | "≈" | "≃";
  claimedText: string;
  claimedValue: number;
  computedValue: number;
  difference: number;
  decimalPlaces: number;
  expectedText: string;
  isCorrect: boolean;
};

export type RealPairFeasibility = {
  variables: [string, string];
  sumSquares: number;
  product: number;
  sumSquare: number;
  differenceSquare: number;
  hasRealPair: boolean;
  hasNonnegativePair: boolean;
  forceMagnitudeContext: boolean;
  possible: boolean;
  impossibleReason: string | null;
};

export type NumericAnswerEvaluation = {
  method: string;
  expression: string;
  expectedValue: number;
  expectedText: string;
  submittedValue: number;
  submittedText: string;
  isCorrect: boolean;
};

export type LearnerErrorAnalysis = {
  status: "verified_mismatch";
  classification: "arithmetic_result_mismatch" | "multiple_arithmetic_result_mismatches";
  method: "bounded_arithmetic_expression";
  mismatchCount: number;
  mismatches: NumericClaimMismatch[];
  omittedMismatchCount: number;
};

export type TutorTurnAnalysis = {
  learnerIntent: "correction_challenge" | "direct_answer_request" | "work_attempt" | "hint_request" | "simplification_request" | "example_request" | "recap_request" | "clarification" | "follow_up";
  requestedLearningMode: "concept_mini_lesson" | "problem_solving" | null;
  latestStudentMessage: string;
  latestTutorClaim: NumericClaimMismatch | null;
  learnerNumericMismatches: NumericClaimMismatch[];
  learnerErrorAnalysis: LearnerErrorAnalysis | null;
  learnerProposedValues: number[];
  learnerValueMatches: boolean;
  learnerValueDiffers: boolean;
  correctionRequired: boolean;
  realPairFeasibility: RealPairFeasibility | null;
  realFeasibilityQuestion: boolean;
  numericAnswerEvaluation: NumericAnswerEvaluation | null;
  repeatedQuestionCount: number;
  previousTutorMessageCount: number;
  latestSubmissionType: string;
};

export function evaluateNumericExpression(expression: string): number | null;
export function findNumericClaims(text: string): NumericClaimMismatch[];
export function findIncorrectNumericClaims(text: string): NumericClaimMismatch[];
export function analyzeTutorTurn(input: {
  messages: TutorMessageForAnalysis[];
  latestSubmissionType?: "attempt" | "question" | "initial_prompt";
}): TutorTurnAnalysis;
export function buildAdaptiveTutorInstructions(analysis: TutorTurnAnalysis): string;
export function buildLearnerArithmeticFeedback(analysis: LearnerErrorAnalysis): string | null;
export function buildVerifiedCorrectionResponse(input: {
  claim: NumericClaimMismatch;
  learnerMessage: string;
  contextText: string;
}): string;
export function buildNumericOutputCorrectionResponse(claim: NumericClaimMismatch): string;
export function buildNumericAnswerFeedback(evaluation: NumericAnswerEvaluation): string;
export function buildRealPairInconsistencyResponse(
  pair: RealPairFeasibility,
  answerEvaluation?: NumericAnswerEvaluation | null
): string;
