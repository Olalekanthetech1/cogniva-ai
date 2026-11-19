import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

const databaseRequire = createRequire(new URL("../../packages/database/package.json", import.meta.url));
const postgres = databaseRequire("postgres");

async function expectDatabaseFailure(transaction, query, code, message) {
  await assert.rejects(
    transaction.savepoint(async (savepoint) => query(savepoint)),
    (error) => error?.code === code,
    message
  );
}

test("global academic reference foundation preserves jurisdiction, version, and provenance boundaries", {
  skip: !process.env.DATABASE_URL,
  timeout: 30_000
}, async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });

  try {
    await sql.begin(async (tx) => {
      const suffix = randomUUID();
      const providerKey = "phase-1.1a-test-" + suffix;
      const sourceRows = await tx.unsafe(
        "INSERT INTO catalogue_sources (provider_key, name, source_type, access_method) " +
        "VALUES ($1, $2, 'official_authority', 'manual_evidence') RETURNING id",
        [providerKey, "Isolated Phase 1.1A Test Source"]
      );
      const sourceId = sourceRows[0].id;

      const sourceRecordRows = await tx.unsafe(
        "INSERT INTO catalogue_source_records (source_id, provider_record_id, source_url, metadata) " +
        "VALUES ($1, $2, $3, $4::jsonb) RETURNING id",
        [sourceId, suffix, "https://example.invalid/record/" + suffix, { fixture: true }]
      );
      const sourceRecordId = sourceRecordRows[0].id;

      const countryRows = await tx.unsafe(
        "INSERT INTO countries (iso_alpha_2, iso_alpha_3, iso_numeric, name) " +
        "VALUES ('XQ', 'XQQ', '999', 'Isolated Test Country') RETURNING id"
      );
      const countryId = countryRows[0].id;

      await tx.unsafe(
        "INSERT INTO country_aliases (country_id, name, normalized_name, language_tag, alias_type) " +
        "VALUES ($1, 'Test Country (alternate)', 'test country alternate', 'en', 'short')",
        [countryId]
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO countries (iso_alpha_2, name) VALUES ('ng', 'Invalid lower-case ISO code')"
        ),
        "23514",
        "Country alpha-2 codes must use the ISO uppercase shape."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO catalogue_sources (provider_key, name, source_type, access_method, status) " +
          "VALUES ($1, 'Unreviewed Source', 'registry', 'public_search', 'approved')",
          [providerKey + "-unreviewed"]
        ),
        "23514",
        "A source must have explicit reviewed rights before it can be approved."
      );

      const approvedSource = await tx.unsafe(
        "INSERT INTO catalogue_sources (provider_key, name, source_type, access_method, status, " +
        "may_cache, may_store, may_display, may_redistribute, rights_reviewed_at) " +
        "VALUES ($1, 'Rights-reviewed Test Source', 'open_dataset', 'data_dump', 'approved', " +
        "true, true, true, false, now()) RETURNING id",
        [providerKey + "-approved"]
      );
      assert.ok(approvedSource[0].id);

      const jurisdictionRows = await tx.unsafe(
        "INSERT INTO education_jurisdictions (country_id, code, name, jurisdiction_type, source_record_id) " +
        "VALUES ($1, 'national-test', 'Test National Education Jurisdiction', 'national', $2) RETURNING id",
        [countryId, sourceRecordId]
      );
      const jurisdictionId = jurisdictionRows[0].id;

      const systemRows = await tx.unsafe(
        "INSERT INTO education_systems (jurisdiction_id, code, name, source_record_id) " +
        "VALUES ($1, 'system-test', 'Test Education System', $2) RETURNING id",
        [jurisdictionId, sourceRecordId]
      );
      const systemId = systemRows[0].id;

      const frameworkRows = await tx.unsafe(
        "INSERT INTO qualification_frameworks (jurisdiction_id, education_system_id, code, name, source_record_id) " +
        "VALUES ($1, $2, 'framework-test', 'Test Qualifications Framework', $3) RETURNING id",
        [jurisdictionId, systemId, sourceRecordId]
      );
      const frameworkId = frameworkRows[0].id;

      const frameworkVersionRows = await tx.unsafe(
        "INSERT INTO qualification_framework_versions (framework_id, version_code, status, source_record_id) " +
        "VALUES ($1, 'v1-test', 'active', $2) RETURNING id",
        [frameworkId, sourceRecordId]
      );
      const frameworkVersionId = frameworkVersionRows[0].id;

      const secondFrameworkVersionRows = await tx.unsafe(
        "INSERT INTO qualification_framework_versions (framework_id, version_code, status) " +
        "VALUES ($1, 'v2-test', 'draft') RETURNING id",
        [frameworkId]
      );
      const secondFrameworkVersionId = secondFrameworkVersionRows[0].id;

      const parentLevelRows = await tx.unsafe(
        "INSERT INTO qualification_levels (framework_version_id, code, label, sequence, descriptors) " +
        "VALUES ($1, 'L1', 'Level One', 1, '{}'::jsonb) RETURNING id",
        [frameworkVersionId]
      );
      const parentLevelId = parentLevelRows[0].id;

      const childLevelRows = await tx.unsafe(
        "INSERT INTO qualification_levels (framework_version_id, parent_level_id, code, label, sequence) " +
        "VALUES ($1, $2, 'L2', 'Level Two', 2) RETURNING id",
        [frameworkVersionId, parentLevelId]
      );
      const qualificationLevelId = childLevelRows[0].id;

      const otherVersionLevel = await tx.unsafe(
        "INSERT INTO qualification_levels (framework_version_id, code, label) " +
        "VALUES ($1, 'OTHER', 'Different Version Level') RETURNING id",
        [secondFrameworkVersionId]
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO qualification_levels (framework_version_id, parent_level_id, code, label) " +
          "VALUES ($1, $2, 'CROSS', 'Cross-version child')",
          [frameworkVersionId, otherVersionLevel[0].id]
        ),
        "23503",
        "A qualification-level parent must belong to the same framework version."
      );

      const programmeSchemeRows = await tx.unsafe(
        "INSERT INTO classification_schemes (scheme_code, name, kind, publisher) " +
        "VALUES ('TEST_PROGRAMME', 'Test Programme Classification', 'programme', 'Test publisher') RETURNING id"
      );
      const attainmentSchemeRows = await tx.unsafe(
        "INSERT INTO classification_schemes (scheme_code, name, kind, publisher) " +
        "VALUES ('TEST_ATTAINMENT', 'Test Attainment Classification', 'attainment', 'Test publisher') RETURNING id"
      );
      const programmeVersionRows = await tx.unsafe(
        "INSERT INTO classification_scheme_versions (scheme_id, version_code) VALUES ($1, 'v1') RETURNING id",
        [programmeSchemeRows[0].id]
      );
      const attainmentVersionRows = await tx.unsafe(
        "INSERT INTO classification_scheme_versions (scheme_id, version_code) VALUES ($1, 'v1') RETURNING id",
        [attainmentSchemeRows[0].id]
      );
      const programmeCodeRows = await tx.unsafe(
        "INSERT INTO classification_codes (scheme_version_id, code, label, depth) VALUES ($1, 'P-1', 'Programme Level One', 1) RETURNING id",
        [programmeVersionRows[0].id]
      );
      const attainmentCodeRows = await tx.unsafe(
        "INSERT INTO classification_codes (scheme_version_id, code, label, depth) VALUES ($1, 'A-1', 'Attainment Level One', 1) RETURNING id",
        [attainmentVersionRows[0].id]
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO classification_codes (scheme_version_id, parent_code_id, code, label) " +
          "VALUES ($1, $2, 'CROSS', 'Cross-version classification child')",
          [attainmentVersionRows[0].id, programmeCodeRows[0].id]
        ),
        "23503",
        "A classification-code parent must belong to the same classification version."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO qualification_level_classification_mappings " +
          "(qualification_level_id, classification_code_id, mapping_kind, status, rationale) " +
          "VALUES ($1, $2, 'isced_p', 'accepted', 'Missing source evidence')",
          [qualificationLevelId, programmeCodeRows[0].id]
        ),
        "23514",
        "An accepted mapping requires a source record and review timestamp."
      );

      await tx.unsafe(
        "INSERT INTO qualification_level_classification_mappings " +
        "(qualification_level_id, classification_code_id, mapping_kind, status, rationale, source_record_id, reviewed_at) " +
        "VALUES ($1, $2, 'isced_p', 'accepted', 'Reviewed programme-level mapping fixture', $3, now())",
        [qualificationLevelId, programmeCodeRows[0].id, sourceRecordId]
      );
      await tx.unsafe(
        "INSERT INTO qualification_level_classification_mappings " +
        "(qualification_level_id, classification_code_id, mapping_kind, status, rationale, source_record_id, reviewed_at) " +
        "VALUES ($1, $2, 'isced_a', 'accepted', 'Reviewed attainment mapping fixture', $3, now())",
        [qualificationLevelId, attainmentCodeRows[0].id, sourceRecordId]
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO qualification_level_classification_mappings " +
          "(qualification_level_id, classification_code_id, mapping_kind, status, rationale, source_record_id, reviewed_at) " +
          "VALUES ($1, $2, 'isced_p', 'accepted', 'Wrong classification kind', $3, now())",
          [qualificationLevelId, attainmentCodeRows[0].id, sourceRecordId]
        ),
        "23514",
        "ISCED-P and ISCED-A mappings must target the corresponding classification scheme kind."
      );

      const institutionRows = await tx.unsafe(
        "INSERT INTO institutions (slug, name) VALUES ($1, 'Isolated Test Institution') RETURNING id",
        ["phase-1-1a-" + suffix]
      );
      const institutionId = institutionRows[0].id;

      const assertionRows = await tx.unsafe(
        "INSERT INTO entity_source_assertions " +
        "(source_record_id, institution_id, claim_key, claim_value, status) " +
        "VALUES ($1, $2, 'official_name', $3::jsonb, 'unreviewed') RETURNING id",
        [sourceRecordId, institutionId, { value: "Isolated Test Institution" }]
      );
      const assertionId = assertionRows[0].id;

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO entity_source_assertions " +
          "(source_record_id, institution_id, jurisdiction_id, claim_key, claim_value) " +
          "VALUES ($1, $2, $3, 'invalid_subject', 'null'::jsonb)",
          [sourceRecordId, institutionId, jurisdictionId]
        ),
        "23514",
        "A source assertion must identify exactly one typed subject."
      );

      await tx.unsafe(
        "INSERT INTO catalogue_review_events (assertion_id, action, previous_status, new_status, rationale) " +
        "VALUES ($1, 'reviewed', 'unreviewed', 'under_review', 'Evidence queued for human review')",
        [assertionId]
      );

      const reviewRows = await tx.unsafe(
        "SELECT count(*)::int AS count FROM catalogue_review_events WHERE assertion_id = $1",
        [assertionId]
      );
      assert.equal(reviewRows[0].count, 1);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
