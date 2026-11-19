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

test("global academic interoperability preserves institutional scope, provenance, credit units, and KC graph integrity", {
  skip: !process.env.DATABASE_URL,
  timeout: 45_000
}, async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });

  try {
    await sql.begin(async (tx) => {
      const suffix = randomUUID();
      const sourceKey = "phase-1.1b-test-" + suffix;
      const sourceRows = await tx.unsafe(
        "INSERT INTO catalogue_sources (provider_key, name, source_type, access_method) " +
        "VALUES ($1, 'Phase 1.1B Isolated Test Source', 'official_authority', 'manual_evidence') RETURNING id",
        [sourceKey]
      );
      const sourceId = sourceRows[0].id;
      const recordRows = await tx.unsafe(
        "INSERT INTO catalogue_source_records (source_id, provider_record_id, source_url, metadata) " +
        "VALUES ($1, $2, $3, $4::jsonb) RETURNING id",
        [sourceId, suffix, "https://example.invalid/phase-1.1b/" + suffix, { fixture: true }]
      );
      const sourceRecordId = recordRows[0].id;

      const institutionA = (await tx.unsafe(
        "INSERT INTO institutions (slug, name) VALUES ($1, 'Phase 1.1B Institution A') RETURNING id",
        ["phase-1-1b-a-" + suffix]
      ))[0].id;
      const institutionB = (await tx.unsafe(
        "INSERT INTO institutions (slug, name) VALUES ($1, 'Phase 1.1B Institution B') RETURNING id",
        ["phase-1-1b-b-" + suffix]
      ))[0].id;

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO institution_identifiers " +
          "(institution_id, provider_namespace, identifier, source_record_id, review_status) " +
          "VALUES ($1, 'test-registry', $2, $3, 'accepted')",
          [institutionA, "unreviewed-" + suffix, sourceRecordId]
        ),
        "23514",
        "Accepted institution identifiers require a review timestamp."
      );
      const identifier = await tx.unsafe(
        "INSERT INTO institution_identifiers " +
        "(institution_id, provider_namespace, identifier, source_record_id, review_status, reviewed_at) " +
        "VALUES ($1, 'test-registry', $2, $3, 'accepted', now()) RETURNING id",
        [institutionA, "identifier-" + suffix, sourceRecordId]
      );
      assert.ok(identifier[0].id);

      const unitA = (await tx.unsafe(
        "INSERT INTO institution_units " +
        "(institution_id, unit_type, slug, name, source_record_id) " +
        "VALUES ($1, 'faculty', $2, 'Materials Faculty', $3) RETURNING id",
        [institutionA, "materials-" + suffix, sourceRecordId]
      ))[0].id;
      const unitChildA = (await tx.unsafe(
        "INSERT INTO institution_units " +
        "(institution_id, parent_unit_id, unit_type, slug, name, source_record_id) " +
        "VALUES ($1, $2, 'department', $3, 'Metallurgical Department', $4) RETURNING id",
        [institutionA, unitA, "metallurgy-" + suffix, sourceRecordId]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO institution_units " +
          "(institution_id, parent_unit_id, unit_type, slug, name, source_record_id) " +
          "VALUES ($1, $2, 'department', $3, 'Cross Institution Department', $4)",
          [institutionB, unitA, "cross-unit-" + suffix, sourceRecordId]
        ),
        "23503",
        "An institution unit cannot have a parent belonging to another institution."
      );

      const jurisdiction = (await tx.unsafe(
        "INSERT INTO education_jurisdictions (name, jurisdiction_type, source_record_id) " +
        "VALUES ('Phase 1.1B Test Jurisdiction', 'national', $1) RETURNING id",
        [sourceRecordId]
      ))[0].id;
      const educationSystem = (await tx.unsafe(
        "INSERT INTO education_systems (jurisdiction_id, name, source_record_id) " +
        "VALUES ($1, 'Phase 1.1B Test Education System', $2) RETURNING id",
        [jurisdiction, sourceRecordId]
      ))[0].id;
      const framework = (await tx.unsafe(
        "INSERT INTO qualification_frameworks (jurisdiction_id, education_system_id, name, source_record_id) " +
        "VALUES ($1, $2, 'Phase 1.1B Test Framework', $3) RETURNING id",
        [jurisdiction, educationSystem, sourceRecordId]
      ))[0].id;
      const frameworkVersion = (await tx.unsafe(
        "INSERT INTO qualification_framework_versions (framework_id, version_code, status) " +
        "VALUES ($1, 'test-v1', 'active') RETURNING id",
        [framework]
      ))[0].id;
      const qualificationLevel = (await tx.unsafe(
        "INSERT INTO qualification_levels (framework_version_id, code, label) " +
        "VALUES ($1, 'QF-L6', 'Test Qualification Level Six') RETURNING id",
        [frameworkVersion]
      ))[0].id;

      const programme = (await tx.unsafe(
        "INSERT INTO academic_programmes " +
        "(institution_id, institution_unit_id, slug, name, source_record_id) " +
        "VALUES ($1, $2, $3, 'B.Eng. Materials Engineering', $4) RETURNING id",
        [institutionA, unitA, "materials-eng-" + suffix, sourceRecordId]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO academic_programmes " +
          "(institution_id, institution_unit_id, slug, name, source_record_id) " +
          "VALUES ($1, $2, $3, 'Invalid Cross Institution Programme', $4)",
          [institutionB, unitA, "invalid-programme-" + suffix, sourceRecordId]
        ),
        "23503",
        "A programme unit must belong to the same institution as the programme."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO programme_versions " +
          "(programme_id, institution_id, version_code, title, status, published_at) " +
          "VALUES ($1, $2, '2026', 'Published Test Programme', 'published', now())",
          [programme, institutionB]
        ),
        "23503",
        "A programme version must preserve the parent programme institution."
      );
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO programme_versions " +
          "(programme_id, institution_id, version_code, title, status) " +
          "VALUES ($1, $2, '2026-unverified', 'Unverified Published Programme', 'published')",
          [programme, institutionA]
        ),
        "23514",
        "A published programme version requires source evidence and a publication timestamp."
      );
      const programmeVersion = (await tx.unsafe(
        "INSERT INTO programme_versions " +
        "(programme_id, institution_id, version_code, title, award_title, status, source_record_id, published_at) " +
        "VALUES ($1, $2, '2026', 'B.Eng. Materials Engineering 2026', 'Bachelor of Engineering', 'published', $3, now()) RETURNING id",
        [programme, institutionA, sourceRecordId]
      ))[0].id;

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO programme_qualifications " +
          "(programme_version_id, qualification_level_id, source_record_id, review_status, rationale) " +
          "VALUES ($1, $2, $3, 'accepted', 'Missing reviewer timestamp')",
          [programmeVersion, qualificationLevel, sourceRecordId]
        ),
        "23514",
        "Accepted programme qualification mappings require review evidence."
      );
      await tx.unsafe(
        "INSERT INTO programme_qualifications " +
        "(programme_version_id, qualification_level_id, source_record_id, review_status, reviewed_at, rationale, is_primary) " +
        "VALUES ($1, $2, $3, 'accepted', now(), 'Evidence-backed award-level mapping', true)",
        [programmeVersion, qualificationLevel, sourceRecordId]
      );

      const authority = (await tx.unsafe(
        "INSERT INTO recognition_authorities (jurisdiction_id, name, authority_type, source_record_id) " +
        "VALUES ($1, 'Phase 1.1B Recognition Authority', 'regulator', $2) RETURNING id",
        [jurisdiction, sourceRecordId]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO recognition_decisions " +
          "(authority_id, scope_kind, decision_status, review_status, institution_unit_id, source_record_id) " +
          "VALUES ($1, 'institution_unit', 'accredited', 'accepted', $2, $3)",
          [authority, unitChildA, sourceRecordId]
        ),
        "23514",
        "An accepted recognition decision requires a review timestamp."
      );
      await tx.unsafe(
        "INSERT INTO recognition_decisions " +
        "(authority_id, scope_kind, decision_status, review_status, institution_unit_id, source_record_id, reviewed_at, effective_from, effective_to) " +
        "VALUES ($1, 'institution_unit', 'accredited', 'accepted', $2, $3, now(), now(), now() + interval '1 year')",
        [authority, unitChildA, sourceRecordId]
      );
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO recognition_decisions " +
          "(authority_id, scope_kind, decision_status, institution_id, source_record_id) " +
          "VALUES ($1, 'programme', 'accredited', $2, $3)",
          [authority, institutionA, sourceRecordId]
        ),
        "23514",
        "Recognition scope kind must agree with its typed subject."
      );

      const creditSystem = (await tx.unsafe(
        "INSERT INTO credit_systems " +
        "(jurisdiction_id, code, name, unit_name, source_record_id) " +
        "VALUES ($1, 'LOCAL-CREDIT', 'Local Credit System', 'credit unit', $2) RETURNING id",
        [jurisdiction, sourceRecordId]
      ))[0].id;
      const academicYear = (await tx.unsafe(
        "INSERT INTO academic_periods " +
        "(institution_id, code, name, period_kind, starts_on, ends_on, source_record_id) " +
        "VALUES ($1, '2026-2027', '2026/2027 Session', 'academic_year', '2026-09-01', '2027-08-31', $2) RETURNING id",
        [institutionA, sourceRecordId]
      ))[0].id;
      const semester = (await tx.unsafe(
        "INSERT INTO academic_periods " +
        "(institution_id, parent_period_id, code, name, period_kind, starts_on, ends_on, source_record_id) " +
        "VALUES ($1, $2, '2026-2027-S1', 'First Semester', 'semester', '2026-09-01', '2027-01-31', $3) RETURNING id",
        [institutionA, academicYear, sourceRecordId]
      ))[0].id;
      const otherInstitutionPeriod = (await tx.unsafe(
        "INSERT INTO academic_periods " +
        "(institution_id, code, name, period_kind, starts_on, ends_on, source_record_id) " +
        "VALUES ($1, '2026-2027', 'Other Institution Session', 'academic_year', '2026-09-01', '2027-08-31', $2) RETURNING id",
        [institutionB, sourceRecordId]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO academic_periods " +
          "(institution_id, parent_period_id, code, name, period_kind, source_record_id) " +
          "VALUES ($1, $2, 'bad-child', 'Wrong Institution Child Period', 'semester', $3)",
          [institutionB, academicYear, sourceRecordId]
        ),
        "23503",
        "An academic period parent must belong to the same institution."
      );

      const subjectId = (await tx.unsafe(
        "INSERT INTO subjects (slug, name) VALUES ($1, 'Phase 1.1B Test Subject') RETURNING id",
        ["phase-1-1b-subject-" + suffix]
      ))[0].id;
      const courseId = (await tx.unsafe(
        "INSERT INTO courses (institution_id, subject_id, code, title, credit_units) " +
        "VALUES ($1, $2, $3, 'Phase 1.1B Test Course', 3.0) RETURNING id",
        [institutionA, subjectId, "P11B-" + suffix.slice(0, 8)]
      ))[0].id;
      const otherCourseId = (await tx.unsafe(
        "INSERT INTO courses (institution_id, subject_id, code, title, credit_units) " +
        "VALUES ($1, $2, $3, 'Other Institution Test Course', 2.0) RETURNING id",
        [institutionB, subjectId, "P11C-" + suffix.slice(0, 8)]
      ))[0].id;
      const curriculumVersion = (await tx.unsafe(
        "INSERT INTO curriculum_versions (course_id, version_label) " +
        "VALUES ($1, 'legacy-v1') RETURNING id",
        [courseId]
      ))[0].id;
      const otherCurriculumVersion = (await tx.unsafe(
        "INSERT INTO curriculum_versions (course_id, version_label) " +
        "VALUES ($1, 'legacy-v1') RETURNING id",
        [otherCourseId]
      ))[0].id;

      const courseContentVersion = (await tx.unsafe(
        "INSERT INTO course_content_versions " +
        "(course_id, legacy_curriculum_version_id, version_code, title, status, source_record_id, published_at) " +
        "VALUES ($1, $2, '2026-v1', 'Reviewed Course Content Version', 'published', $3, now()) RETURNING id",
        [courseId, curriculumVersion, sourceRecordId]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO course_content_versions " +
          "(course_id, legacy_curriculum_version_id, version_code, title) " +
          "VALUES ($1, $2, 'wrong-course', 'Cross Course Legacy Curriculum Version')",
          [courseId, otherCurriculumVersion]
        ),
        "23503",
        "A legacy curriculum version must belong to the same course as the content version."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO programme_course_requirements " +
          "(institution_id, programme_version_id, course_id, requirement_kind, position, credit_value, source_record_id) " +
          "VALUES ($1, $2, $3, 'core', 1, 3.0, $4)",
          [institutionA, programmeVersion, courseId, sourceRecordId]
        ),
        "23514",
        "Credit values must be paired with an explicit credit system."
      );
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO programme_course_requirements " +
          "(institution_id, programme_version_id, course_id, academic_period_id, requirement_kind, position, source_record_id) " +
          "VALUES ($1, $2, $3, $4, 'core', 1, $5)",
          [institutionA, programmeVersion, courseId, otherInstitutionPeriod, sourceRecordId]
        ),
        "23503",
        "A programme requirement period must belong to the programme institution."
      );
      const requirement = await tx.unsafe(
        "INSERT INTO programme_course_requirements " +
        "(institution_id, programme_version_id, course_id, course_content_version_id, academic_period_id, " +
        "requirement_kind, local_stage_label, local_stage_index, credit_value, credit_system_id, position, source_record_id) " +
        "VALUES ($1, $2, $3, $4, $5, 'core', 'Year 2', 2, 3.0, $6, 1, $7) RETURNING id",
        [institutionA, programmeVersion, courseId, courseContentVersion, semester, creditSystem, sourceRecordId]
      );
      assert.ok(requirement[0].id);

      const kcA = (await tx.unsafe(
        "INSERT INTO knowledge_components (slug, kind, domain_key) VALUES ($1, 'concept', 'materials') RETURNING id",
        ["phase-1-1b-kc-a-" + suffix]
      ))[0].id;
      const kcB = (await tx.unsafe(
        "INSERT INTO knowledge_components (slug, kind, domain_key) VALUES ($1, 'skill', 'materials') RETURNING id",
        ["phase-1-1b-kc-b-" + suffix]
      ))[0].id;
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO knowledge_component_versions " +
          "(knowledge_component_id, version_code, name, definition, status, reviewed_at) " +
          "VALUES ($1, 'v1', 'Unverified KC', 'No source-backed definition', 'active', now())",
          [kcA]
        ),
        "23514",
        "An active Knowledge Component version requires source evidence."
      );
      const kcVersionA = (await tx.unsafe(
        "INSERT INTO knowledge_component_versions " +
        "(knowledge_component_id, version_code, name, definition, status, source_record_id, reviewed_at) " +
        "VALUES ($1, 'v1', 'Material Balance', 'Conservation of mass in a process', 'active', $2, now()) RETURNING id",
        [kcA, sourceRecordId]
      ))[0].id;
      const kcVersionB = (await tx.unsafe(
        "INSERT INTO knowledge_component_versions " +
        "(knowledge_component_id, version_code, name, definition, status, source_record_id, reviewed_at) " +
        "VALUES ($1, 'v1', 'Stoichiometric Calculation', 'Quantitative calculation from balanced relationships', 'active', $2, now()) RETURNING id",
        [kcB, sourceRecordId]
      ))[0].id;

      await tx.unsafe(
        "INSERT INTO knowledge_component_relations " +
        "(source_version_id, target_version_id, relation_kind, review_status, rationale, source_record_id, reviewed_at) " +
        "VALUES ($1, $2, 'prerequisite', 'accepted', 'A learner needs material balance before this calculation', $3, now())",
        [kcVersionA, kcVersionB, sourceRecordId]
      );
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO knowledge_component_relations " +
          "(source_version_id, target_version_id, relation_kind, review_status, rationale, source_record_id, reviewed_at) " +
          "VALUES ($1, $2, 'prerequisite', 'accepted', 'Would create a prerequisite cycle', $3, now())",
          [kcVersionB, kcVersionA, sourceRecordId]
        ),
        "23514",
        "Accepted prerequisite relationships must remain acyclic."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO course_knowledge_component_mappings " +
          "(course_content_version_id, knowledge_component_version_id, mapping_kind, status, mapping_method, rationale) " +
          "VALUES ($1, $2, 'taught', 'accepted', 'manual_review', 'Missing evidence')",
          [courseContentVersion, kcVersionA]
        ),
        "23514",
        "Accepted course-to-KC mappings require source evidence and review time."
      );
      const mapping = await tx.unsafe(
        "INSERT INTO course_knowledge_component_mappings " +
        "(course_content_version_id, knowledge_component_version_id, mapping_kind, status, mapping_method, rationale, confidence, source_record_id, reviewed_at) " +
        "VALUES ($1, $2, 'taught', 'accepted', 'manual_review', 'Reviewed mapping from the syllabus', 0.95, $3, now()) RETURNING id",
        [courseContentVersion, kcVersionA, sourceRecordId]
      );
      assert.ok(mapping[0].id);

      const assertion = await tx.unsafe(
        "INSERT INTO entity_source_assertions " +
        "(source_record_id, knowledge_component_version_id, claim_key, claim_value, status) " +
        "VALUES ($1, $2, 'definition', $3::jsonb, 'unreviewed') RETURNING id",
        [sourceRecordId, kcVersionA, { reviewed: true }]
      );
      assert.ok(assertion[0].id);
      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO entity_source_assertions " +
          "(source_record_id, course_id, knowledge_component_version_id, claim_key, claim_value) " +
          "VALUES ($1, $2, $3, 'invalid_multi_subject', 'null'::jsonb)",
          [sourceRecordId, courseId, kcVersionA]
        ),
        "23514",
        "A source assertion must identify exactly one typed subject."
      );

      const legacyCourse = await tx.unsafe(
        "SELECT credit_units FROM courses WHERE id = $1",
        [courseId]
      );
      assert.equal(String(legacyCourse[0].credit_units), "3.0");
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
