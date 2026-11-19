export type TutorLearningMode =
  | "adaptive_socratic"
  | "structured_lesson_opening"
  | "structured_lesson_continuation"
  | "concept_mini_lesson"
  | "problem_solving"
  | "attempt_feedback"
  | "quick_clarification";

export const TUTOR_LEARNING_FRAMEWORK_VERSION: "ctl-1.2.0";

export function resolveTutorLearningMode(input: {
  hasLinkedUnit: boolean;
  latestSubmissionType: "attempt" | "question" | "initial_prompt";
  learnerIntent?: "correction_challenge" | "direct_answer_request" | "work_attempt" | "hint_request" | "simplification_request" | "example_request" | "recap_request" | "clarification" | "follow_up";
  sessionIntent?: "learn_topic" | "understand_concept" | "solve_problem" | string;
  latestStudentMessage?: string;
  requestedLearningMode?: "concept_mini_lesson" | "problem_solving" | null;
}): TutorLearningMode;

export type TutorLearningModeConfig = {
  label: string;
  maxOutputTokens: number;
  maxWords: number;
  maxCharacters: number;
  responseLengthInstruction: string;
  requiredSections: readonly string[] | null;
  rejectNumericMismatches: boolean;
  limitMessage: string;
  mismatchMessage?: string;
};

export function getTutorLearningModeConfig(mode: TutorLearningMode | string): TutorLearningModeConfig;

export function buildTutorLearningFrameworkInstructions(input: {
  mode: TutorLearningMode;
  learnerIntent?: string;
}): string;

export function validateTutorLearningOutput(input: {
  text: string;
  finishReason: string | null;
  mode: TutorLearningMode;
  numericMismatchCount?: number;
}): string | null;
