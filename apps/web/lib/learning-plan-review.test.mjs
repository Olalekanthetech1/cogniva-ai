import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePlanApprovalInput,
  parseRelationshipReviewInput
} from "./learning-plan-review.js";

test("relationship review accepts an explicit learner decision and version", () => {
  assert.deepEqual(
    parseRelationshipReviewInput({ expectedVersion: 4, decision: "accepted" }),
    { expectedVersion: 4, decision: "accepted" }
  );
  assert.deepEqual(
    parseRelationshipReviewInput({ expectedVersion: 9, decision: "rejected" }),
    { expectedVersion: 9, decision: "rejected" }
  );
});

test("relationship review rejects invalid, reset, and extra input", () => {
  assert.equal(parseRelationshipReviewInput({ expectedVersion: 4, decision: "proposed" }), null);
  assert.equal(parseRelationshipReviewInput({ expectedVersion: 0, decision: "accepted" }), null);
  assert.equal(parseRelationshipReviewInput({ expectedVersion: 1.5, decision: "accepted" }), null);
  assert.equal(parseRelationshipReviewInput({ expectedVersion: "4", decision: "accepted" }), null);
  assert.equal(parseRelationshipReviewInput({ expectedVersion: 4, decision: "accepted", studentId: "other" }), null);
  assert.equal(parseRelationshipReviewInput(null), null);
});

test("plan approval accepts only a positive safe expected version", () => {
  assert.deepEqual(
    parsePlanApprovalInput({ expectedVersion: 7 }),
    { expectedVersion: 7 }
  );
  assert.equal(parsePlanApprovalInput({ expectedVersion: -1 }), null);
  assert.equal(parsePlanApprovalInput({ expectedVersion: Number.MAX_SAFE_INTEGER + 1 }), null);
  assert.equal(parsePlanApprovalInput({ expectedVersion: 7, status: "active" }), null);
  assert.equal(parsePlanApprovalInput({}), null);
});
