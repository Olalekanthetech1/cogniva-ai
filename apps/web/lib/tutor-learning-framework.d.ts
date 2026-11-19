export type TutorLearningMode =
  | "adaptive_socratic"
  | "structured_lesson_opening"
  | "structured_lesson_continuation"
  | "concept_mini_lesson"
  | "problem_solving"
  | "attempt_feedback"
  | "quick_clarification";

export const TUTOR_LEARNING_FRAMEWORK_VERSION: "ctl-1.1.0";

export function resolveTutorLearningMode(input: {
  hasLinkedUnit: boolean;
  latestSubmissionType: "attempt" | "question" | "initial_prompt";
  learnerIntent?: "correction_challenge" | "direct_answer_request" | "work_attempt" | "clarification" | "follow_up";
  sessionIntent?: "learn_topic" | "understand_concept" | "solve_problem" | string;
  latestStudentMessage?: string;
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
