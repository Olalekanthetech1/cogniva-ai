export type PlanRelationshipDecision = "accepted" | "rejected";

export function parseRelationshipReviewInput(
  value: unknown
): { expectedVersion: number; decision: PlanRelationshipDecision } | null;

export function parsePlanApprovalInput(
  value: unknown
): { expectedVersion: number } | null;
