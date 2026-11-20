export const aiModelRegistrySchemaContract = {
  tables: ["ai_models", "ai_task_model_candidates"],
  columns: [
    { tableName: "ai_models", columnName: "id", dataType: "uuid", udtName: "uuid", isNullable: "NO" },
    { tableName: "ai_models", columnName: "provider", dataType: "USER-DEFINED", udtName: "ai_provider", isNullable: "NO" },
    { tableName: "ai_models", columnName: "model_id", dataType: "character varying", udtName: "varchar", isNullable: "NO", characterMaximumLength: 160 },
    { tableName: "ai_models", columnName: "display_name", dataType: "character varying", udtName: "varchar", isNullable: "NO", characterMaximumLength: 160 },
    { tableName: "ai_models", columnName: "status", dataType: "USER-DEFINED", udtName: "ai_model_status", isNullable: "NO" },
    { tableName: "ai_models", columnName: "capabilities", dataType: "jsonb", udtName: "jsonb", isNullable: "NO" },
    { tableName: "ai_models", columnName: "capability_evidence_url", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_models", columnName: "capabilities_verified_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "YES" },
    { tableName: "ai_models", columnName: "capabilities_verified_by", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_models", columnName: "last_test_status", dataType: "USER-DEFINED", udtName: "ai_model_connection_status", isNullable: "YES" },
    { tableName: "ai_models", columnName: "last_tested_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "YES" },
    { tableName: "ai_models", columnName: "last_test_latency_ms", dataType: "integer", udtName: "int4", isNullable: "YES" },
    { tableName: "ai_models", columnName: "last_test_error_code", dataType: "character varying", udtName: "varchar", isNullable: "YES", characterMaximumLength: 80 },
    { tableName: "ai_models", columnName: "created_by", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_models", columnName: "updated_by", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_models", columnName: "created_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "NO" },
    { tableName: "ai_models", columnName: "updated_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "id", dataType: "uuid", udtName: "uuid", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "task", dataType: "USER-DEFINED", udtName: "ai_task_key", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "model_id", dataType: "uuid", udtName: "uuid", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "is_enabled", dataType: "boolean", udtName: "bool", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "priority", dataType: "integer", udtName: "int4", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "created_by", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_task_model_candidates", columnName: "updated_by", dataType: "text", udtName: "text", isNullable: "YES" },
    { tableName: "ai_task_model_candidates", columnName: "created_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "NO" },
    { tableName: "ai_task_model_candidates", columnName: "updated_at", dataType: "timestamp with time zone", udtName: "timestamptz", isNullable: "NO" }
  ],
  enums: [
    { typeName: "ai_model_status", labels: ["pending", "enabled", "disabled"] },
    { typeName: "ai_model_connection_status", labels: ["connected", "failed"] }
  ],
  constraints: [
    { tableName: "ai_models", constraintName: "ai_models_pkey", constraintType: "p" },
    { tableName: "ai_models", constraintName: "ai_models_capabilities_verified_by_user_id_fk", constraintType: "f" },
    { tableName: "ai_models", constraintName: "ai_models_created_by_user_id_fk", constraintType: "f" },
    { tableName: "ai_models", constraintName: "ai_models_updated_by_user_id_fk", constraintType: "f" },
    { tableName: "ai_models", constraintName: "ai_models_model_id_nonempty_check", constraintType: "c" },
    { tableName: "ai_models", constraintName: "ai_models_display_name_nonempty_check", constraintType: "c" },
    { tableName: "ai_models", constraintName: "ai_models_capabilities_object_check", constraintType: "c" },
    { tableName: "ai_models", constraintName: "ai_models_test_latency_nonnegative_check", constraintType: "c" },
    { tableName: "ai_models", constraintName: "ai_models_enabled_requires_test_and_capability_evidence", constraintType: "c" },
    { tableName: "ai_task_model_candidates", constraintName: "ai_task_model_candidates_pkey", constraintType: "p" },
    { tableName: "ai_task_model_candidates", constraintName: "ai_task_model_candidates_model_id_ai_models_id_fk", constraintType: "f" },
    { tableName: "ai_task_model_candidates", constraintName: "ai_task_model_candidates_created_by_user_id_fk", constraintType: "f" },
    { tableName: "ai_task_model_candidates", constraintName: "ai_task_model_candidates_updated_by_user_id_fk", constraintType: "f" },
    { tableName: "ai_task_model_candidates", constraintName: "ai_task_model_candidates_priority_range_check", constraintType: "c" }
  ],
  indexes: [
    { tableName: "ai_models", indexName: "ai_models_provider_model_id_unique", isUnique: true },
    { tableName: "ai_models", indexName: "ai_models_provider_status_idx", isUnique: false },
    { tableName: "ai_task_model_candidates", indexName: "ai_task_model_candidates_task_model_unique", isUnique: true },
    { tableName: "ai_task_model_candidates", indexName: "ai_task_model_candidates_task_enabled_priority_idx", isUnique: false }
  ]
};

export function buildAiModelRegistrySchemaReport(snapshot) {
  const existingTables = new Set(snapshot.existingTables ?? []);
  const actualColumns = new Map(
    (snapshot.columns ?? []).map((column) => [
      column.table_name + "." + column.column_name,
      column
    ])
  );
  const actualEnums = new Map(
    (snapshot.enumTypes ?? []).map((enumType) => [enumType.type_name, enumType])
  );
  const actualConstraints = new Map(
    (snapshot.constraints ?? []).map((constraint) => [
      constraint.table_name + "." + constraint.constraint_name,
      constraint
    ])
  );
  const actualIndexes = new Map(
    (snapshot.indexes ?? []).map((index) => [index.table_name + "." + index.index_name, index])
  );

  const missingTables = aiModelRegistrySchemaContract.tables.filter((tableName) => !existingTables.has(tableName));
  const missingColumns = [];
  const mismatchedColumns = [];
  for (const expected of aiModelRegistrySchemaContract.columns) {
    const key = expected.tableName + "." + expected.columnName;
    const actual = actualColumns.get(key);
    if (!actual) {
      missingColumns.push(expected);
      continue;
    }
    const matches =
      actual.data_type === expected.dataType &&
      actual.udt_name === expected.udtName &&
      actual.is_nullable === expected.isNullable &&
      (
        expected.characterMaximumLength === undefined ||
        Number(actual.character_maximum_length) === expected.characterMaximumLength
      );
    if (!matches) mismatchedColumns.push({ expected, actual });
  }

  const missingEnums = [];
  const mismatchedEnums = [];
  for (const expected of aiModelRegistrySchemaContract.enums) {
    const actual = actualEnums.get(expected.typeName);
    if (!actual) {
      missingEnums.push(expected.typeName);
    } else if (JSON.stringify(actual.labels ?? []) !== JSON.stringify(expected.labels)) {
      mismatchedEnums.push({ expected, actual });
    }
  }

  const missingConstraints = [];
  const mismatchedConstraints = [];
  for (const expected of aiModelRegistrySchemaContract.constraints) {
    const key = expected.tableName + "." + expected.constraintName;
    const actual = actualConstraints.get(key);
    if (!actual) {
      missingConstraints.push(expected);
    } else if (actual.constraint_type !== expected.constraintType) {
      mismatchedConstraints.push({ expected, actual });
    }
  }

  const missingIndexes = [];
  const mismatchedIndexes = [];
  for (const expected of aiModelRegistrySchemaContract.indexes) {
    const key = expected.tableName + "." + expected.indexName;
    const actual = actualIndexes.get(key);
    if (!actual) {
      missingIndexes.push(expected);
    } else if (actual.is_unique !== expected.isUnique) {
      mismatchedIndexes.push({ expected, actual });
    }
  }

  const passed =
    missingTables.length === 0 &&
    missingColumns.length === 0 &&
    mismatchedColumns.length === 0 &&
    missingEnums.length === 0 &&
    mismatchedEnums.length === 0 &&
    missingConstraints.length === 0 &&
    mismatchedConstraints.length === 0 &&
    missingIndexes.length === 0 &&
    mismatchedIndexes.length === 0;

  return {
    passed,
    expectedTables: aiModelRegistrySchemaContract.tables,
    existingTables: aiModelRegistrySchemaContract.tables.filter((tableName) => existingTables.has(tableName)),
    missingTables,
    expectedColumnCount: aiModelRegistrySchemaContract.columns.length,
    observedColumnCount: (snapshot.columns ?? []).length,
    missingColumns,
    mismatchedColumns,
    enums: snapshot.enumTypes ?? [],
    missingEnums,
    mismatchedEnums,
    constraints: snapshot.constraints ?? [],
    missingConstraints,
    mismatchedConstraints,
    indexes: snapshot.indexes ?? [],
    missingIndexes,
    mismatchedIndexes
  };
}
