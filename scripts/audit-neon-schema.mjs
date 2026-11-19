import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRequire = createRequire(join(repositoryRoot, "packages/database/package.json"));
const postgres = packageRequire("postgres");
const migrationDirectory = join(repositoryRoot, "packages/database/migrations");
const journalPath = join(migrationDirectory, "meta/_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const assertAllMigrations = process.argv.includes("--assert-all-repository-migrations");
const databaseUrl = process.env.DATABASE_MIGRATION_URL?.trim();

const academicTables = [
  "institutions",
  "faculties",
  "departments",
  "subjects",
  "courses",
  "topics",
  "curriculum_versions",
  "course_topics",
  "student_profiles"
];

const targetTables = [
  "countries",
  "country_aliases",
  "education_jurisdictions",
  "education_systems",
  "qualification_frameworks",
  "qualification_framework_versions",
  "qualification_levels",
  "classification_schemes",
  "classification_scheme_versions",
  "classification_codes",
  "qualification_level_classification_mappings",
  "institution_identifiers",
  "institution_aliases",
  "institution_units",
  "recognition_authorities",
  "recognition_decisions",
  "academic_programmes",
  "programme_versions",
  "programme_qualifications",
  "academic_periods",
  "programme_course_requirements",
  "credit_systems",
  "course_content_versions",
  "catalogue_sources",
  "catalogue_source_records",
  "entity_source_assertions",
  "catalogue_review_events",
  "knowledge_components",
  "knowledge_component_versions",
  "knowledge_component_relations",
  "course_knowledge_component_mappings"
];

if (!databaseUrl) {
  process.stderr.write("DATABASE_MIGRATION_URL is required for a read-only schema audit.\n");
  process.exit(1);
}

function buildMigrationReport(appliedRows) {
  const appliedByTimestamp = new Map(
    appliedRows.map((row) => [String(row.created_at), row])
  );
  const expectedTimestamps = new Set(journal.entries.map((entry) => String(entry.when)));

  const expected = journal.entries.map((entry) => ({
    index: entry.idx,
    tag: entry.tag,
    expectedTimestamp: String(entry.when),
    migrationFilePresent: existsSync(join(migrationDirectory, entry.tag + ".sql")),
    applied: appliedByTimestamp.has(String(entry.when))
  }));

  const unexpected = appliedRows
    .filter((row) => !expectedTimestamps.has(String(row.created_at)))
    .map((row) => ({ createdAt: String(row.created_at) }));

  return {
    expectedCount: expected.length,
    appliedCount: expected.filter((item) => item.applied).length,
    missingMigrations: expected.filter((item) => !item.applied).map((item) => item.tag),
    missingRepositoryFiles: expected.filter((item) => !item.migrationFilePresent).map((item) => item.tag),
    unexpectedAppliedMigrationCount: unexpected.length,
    unexpectedAppliedMigrations: unexpected,
    entries: expected
  };
}

async function runAudit() {
  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    prepare: false
  });

  try {
    return await client.begin(async (transaction) => {
      await transaction.unsafe("SET TRANSACTION READ ONLY");

      const databaseRows = await transaction.unsafe(
        "SELECT current_database() AS database_name, current_setting('server_version') AS server_version"
      );
      const databaseInfo = databaseRows[0];

      const migrationRelationRows = await transaction.unsafe(
        "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS relation"
      );
      const migrationRelation = migrationRelationRows[0];

      let appliedRows = [];
      if (migrationRelation?.relation) {
        appliedRows = await transaction.unsafe(
          "SELECT created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY created_at"
        );
      }

      const columns = await transaction.unsafe(
        "SELECT table_name, column_name, data_type, is_nullable " +
        "FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND table_name = ANY($1) " +
        "ORDER BY table_name, ordinal_position",
        [academicTables]
      );

      const existingTables = await transaction.unsafe(
        "SELECT table_name FROM information_schema.tables " +
        "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' " +
        "ORDER BY table_name"
      );

      const constraints = await transaction.unsafe(
        "SELECT table_name, constraint_name, constraint_type " +
        "FROM information_schema.table_constraints " +
        "WHERE table_schema = 'public' AND table_name = ANY($1) " +
        "ORDER BY table_name, constraint_type, constraint_name",
        [academicTables]
      );

      const currentTableNames = new Set(existingTables.map((row) => row.table_name));
      const targetTablePresence = targetTables.map((tableName) => ({
        table: tableName,
        present: currentTableNames.has(tableName)
      }));

      const migrationLedger = buildMigrationReport(appliedRows);
      const result = {
        auditMode: "READ_ONLY_TRANSACTION",
        generatedAt: new Date().toISOString(),
        database: {
          name: databaseInfo.database_name,
          serverVersion: databaseInfo.server_version
        },
        migrationLedgerTablePresent: Boolean(migrationRelation?.relation),
        migrationLedger,
        academicSchema: {
          existingTables: academicTables.filter((tableName) => currentTableNames.has(tableName)),
          missingCurrentTables: academicTables.filter((tableName) => !currentTableNames.has(tableName)),
          columns,
          constraints
        },
        targetTablePresence
      };

      if (
        assertAllMigrations &&
        (
          !result.migrationLedgerTablePresent ||
          migrationLedger.missingMigrations.length > 0 ||
          migrationLedger.missingRepositoryFiles.length > 0 ||
          migrationLedger.unexpectedAppliedMigrationCount > 0
        )
      ) {
        result.assertion = "FAILED: repository migration journal and database ledger do not match.";
      } else {
        result.assertion = assertAllMigrations
          ? "PASSED: all repository migrations are applied to this audit database."
          : "NOT ASSERTED: review the production migration ledger and table inventory.";
      }

      return result;
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

try {
  const report = await runAudit();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  if (assertAllMigrations && report.assertion.startsWith("FAILED:")) {
    process.exitCode = 2;
  }
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "AUDIT_FAILED";
  process.stderr.write("Read-only database schema audit failed (" + code + "). Check connectivity and database permissions.\n");
  process.exitCode = 1;
}
