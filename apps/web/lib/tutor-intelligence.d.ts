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

export type TutorTurnAnalysis = {
  learnerIntent: "correction_challenge" | "direct_answer_request" | "work_attempt" | "clarification" | "follow_up";
  latestStudentMessage: string;
  latestTutorClaim: NumericClaimMismatch | null;
  learnerNumericMismatches: NumericClaimMismatch[];
  learnerProposedValues: number[];
  learnerValueMatches: boolean;
  learnerValueDiffers: boolean;
  correctionRequired: boolean;
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
export function buildVerifiedCorrectionResponse(input: {
  claim: NumericClaimMismatch;
  learnerMessage: string;
  contextText: string;
}): string;
export function buildNumericOutputCorrectionResponse(claim: NumericClaimMismatch): string;
