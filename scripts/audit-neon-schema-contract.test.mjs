import assert from "node:assert/strict";
import test from "node:test";
import {
  aiModelRegistrySchemaContract,
  buildAiModelRegistrySchemaReport
} from "./audit-neon-schema-contract.mjs";

function createCompleteSnapshot() {
  return {
    existingTables: [...aiModelRegistrySchemaContract.tables],
    columns: aiModelRegistrySchemaContract.columns.map((column) => ({
      table_name: column.tableName,
      column_name: column.columnName,
      data_type: column.dataType,
      udt_name: column.udtName,
      is_nullable: column.isNullable,
      character_maximum_length: column.characterMaximumLength ?? null
    })),
    enumTypes: aiModelRegistrySchemaContract.enums.map((enumType) => ({
      type_name: enumType.typeName,
      labels: [...enumType.labels]
    })),
    constraints: aiModelRegistrySchemaContract.constraints.map((constraint) => ({
      table_name: constraint.tableName,
      constraint_name: constraint.constraintName,
      constraint_type: constraint.constraintType,
      definition: "fixture"
    })),
    indexes: aiModelRegistrySchemaContract.indexes.map((index) => ({
      table_name: index.tableName,
      index_name: index.indexName,
      is_unique: index.isUnique,
      definition: "fixture"
    }))
  };
}

test("accepts the complete Phase 1.3a registry schema contract", () => {
  const report = buildAiModelRegistrySchemaReport(createCompleteSnapshot());

  assert.equal(report.passed, true);
  assert.deepEqual(report.missingTables, []);
  assert.deepEqual(report.missingColumns, []);
  assert.deepEqual(report.missingEnums, []);
  assert.deepEqual(report.missingConstraints, []);
  assert.deepEqual(report.missingIndexes, []);
});

test("rejects a missing registry table and required column", () => {
  const snapshot = createCompleteSnapshot();
  snapshot.existingTables = snapshot.existingTables.filter((name) => name !== "ai_task_model_candidates");
  snapshot.columns = snapshot.columns.filter((column) => column.column_name !== "priority");

  const report = buildAiModelRegistrySchemaReport(snapshot);

  assert.equal(report.passed, false);
  assert.deepEqual(report.missingTables, ["ai_task_model_candidates"]);
  assert.equal(report.missingColumns.some((column) => column.columnName === "priority"), true);
});

test("rejects mismatched column types, nullability, and bounded string lengths", () => {
  const snapshot = createCompleteSnapshot();
  snapshot.columns.find((column) => column.table_name === "ai_models" && column.column_name === "model_id").character_maximum_length = 120;
  snapshot.columns.find((column) => column.table_name === "ai_task_model_candidates" && column.column_name === "priority").is_nullable = "YES";

  const report = buildAiModelRegistrySchemaReport(snapshot);

  assert.equal(report.passed, false);
  assert.equal(report.mismatchedColumns.length, 2);
});

test("rejects missing or changed registry enum labels", () => {
  const snapshot = createCompleteSnapshot();
  snapshot.enumTypes.find((enumType) => enumType.type_name === "ai_model_status").labels = ["pending", "enabled"];

  const report = buildAiModelRegistrySchemaReport(snapshot);

  assert.equal(report.passed, false);
  assert.equal(report.mismatchedEnums.length, 1);
});

test("rejects missing constraints and constraints with the wrong PostgreSQL type", () => {
  const snapshot = createCompleteSnapshot();
  snapshot.constraints = snapshot.constraints.filter((constraint) => constraint.constraint_name !== "ai_models_enabled_requires_test_and_capability_evidence");
  snapshot.constraints.find((constraint) => constraint.constraint_name === "ai_task_model_candidates_priority_range_check").constraint_type = "f";

  const report = buildAiModelRegistrySchemaReport(snapshot);

  assert.equal(report.passed, false);
  assert.equal(report.missingConstraints.length, 1);
  assert.equal(report.mismatchedConstraints.length, 1);
});

test("rejects missing indexes and unique/non-unique definition mismatches", () => {
  const snapshot = createCompleteSnapshot();
  snapshot.indexes = snapshot.indexes.filter((index) => index.index_name !== "ai_models_provider_status_idx");
  snapshot.indexes.find((index) => index.index_name === "ai_task_model_candidates_task_model_unique").is_unique = false;

  const report = buildAiModelRegistrySchemaReport(snapshot);

  assert.equal(report.passed, false);
  assert.equal(report.missingIndexes.length, 1);
  assert.equal(report.mismatchedIndexes.length, 1);
});


test("strictly requires the persisted per-task routing settings table, columns, and mode enum", () => {
  const snapshot = createCompleteSnapshot();
  const settings = snapshot.columns.filter((column) => column.table_name === "ai_task_routing_settings");

  assert.equal(settings.length, 4);
  assert.equal(settings.find((column) => column.column_name === "mode").udt_name, "ai_task_routing_mode");
  assert.deepEqual(
    snapshot.enumTypes.find((enumType) => enumType.type_name === "ai_task_routing_mode").labels,
    ["pinned", "adaptive"]
  );

  snapshot.existingTables = snapshot.existingTables.filter((name) => name !== "ai_task_routing_settings");
  const report = buildAiModelRegistrySchemaReport(snapshot);
  assert.equal(report.passed, false);
  assert.deepEqual(report.missingTables, ["ai_task_routing_settings"]);
});
