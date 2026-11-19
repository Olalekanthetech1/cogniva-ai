function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRelationshipReviewInput(value) {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, "expectedVersion") ||
    !Object.hasOwn(value, "decision") ||
    !Number.isSafeInteger(value.expectedVersion) ||
    value.expectedVersion < 1 ||
    (value.decision !== "accepted" && value.decision !== "rejected")
  ) {
    return null;
  }

  return {
    expectedVersion: value.expectedVersion,
    decision: value.decision
  };
}

export function parsePlanApprovalInput(value) {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "expectedVersion") ||
    !Number.isSafeInteger(value.expectedVersion) ||
    value.expectedVersion < 1
  ) {
    return null;
  }

  return { expectedVersion: value.expectedVersion };
}
