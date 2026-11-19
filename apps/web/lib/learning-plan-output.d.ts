export type LearningPlanConceptKind = "concept" | "skill";
export type LearningPlanRelationType = "prerequisite" | "related" | "part_of";

export type LearningPlanOutput = {
  title: string;
  summary: string;
  concepts: Array<{
    name: string;
    kind: LearningPlanConceptKind;
    description: string;
  }>;
  units: Array<{
    title: string;
    description: string;
    objectives: string[];
    concepts: string[];
  }>;
  relationships: Array<{
    sourceConcept: string;
    targetConcept: string;
    type: LearningPlanRelationType;
  }>;
};

export class LearningPlanOutputValidationError extends Error {
  constructor(code: string, message: string);
  readonly code: string;
}

export const LEARNING_PLAN_PROMPT_VERSION: string;
export const LEARNING_PLAN_OUTPUT_SCHEMA_VERSION: string;
export function buildLearningPlanSystemPrompt(): string;
export function buildLearningPlanUserPrompt(topic: string): string;
export function parseLearningPlanOutput(rawText: string): LearningPlanOutput;
