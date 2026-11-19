export type TutorLearningMode =
  | "adaptive_socratic"
  | "structured_lesson_opening"
  | "structured_lesson_continuation";

export const TUTOR_LEARNING_FRAMEWORK_VERSION: "ctl-1.0.0";

export function resolveTutorLearningMode(input: {
  hasLinkedUnit: boolean;
  latestSubmissionType: "attempt" | "question" | "initial_prompt";
}): TutorLearningMode;

export function buildTutorLearningFrameworkInstructions(input: {
  mode: TutorLearningMode;
  learnerIntent?: string;
}): string;

export function validateTutorLearningOutput(input: {
  text: string;
  finishReason: string | null;
  mode: Exclude<TutorLearningMode, "adaptive_socratic">;
  numericMismatchCount?: number;
}): string | null;
