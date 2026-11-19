import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { courses, curriculumVersions, institutions } from "./academic";
import { user } from "./auth";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const educationJurisdictionType = pgEnum("education_jurisdiction_type", [
  "national",
  "subnational",
  "territorial",
  "regional",
  "other"
]);

export const countryAliasType = pgEnum("country_alias_type", [
  "official",
  "short",
  "historical",
  "transliteration",
  "source_name",
  "other"
]);

export const qualificationFrameworkVersionStatus = pgEnum(
  "qualification_framework_version_status",
  ["draft", "active", "superseded", "withdrawn"]
);

export const classificationSchemeKind = pgEnum("classification_scheme_kind", [
  "programme",
  "attainment",
  "field",
  "other"
]);

export const catalogueSourceType = pgEnum("catalogue_source_type", [
  "official_authority",
  "official_institution",
  "intergovernmental",
  "registry",
  "licensed_directory",
  "open_dataset",
  "other"
]);

export const catalogueAccessMethod = pgEnum("catalogue_access_method", [
  "official_api",
  "data_dump",
  "public_search",
  "licensed_access",
  "manual_evidence"
]);

export const catalogueSourceStatus = pgEnum("catalogue_source_status", [
  "proposed",
  "approved",
  "restricted",
  "disabled",
  "rejected"
]);

export const catalogueAssertionStatus = pgEnum("catalogue_assertion_status", [
  "unreviewed",
  "under_review",
  "accepted",
  "disputed",
  "rejected",
  "superseded"
]);

export const catalogueReviewAction = pgEnum("catalogue_review_action", [
  "submitted",
  "reviewed",
  "accepted",
  "disputed",
  "rejected",
  "superseded"
]);

export const qualificationClassificationMappingKind = pgEnum(
  "qualification_classification_mapping_kind",
  ["isced_p", "isced_a"]
);

export const qualificationClassificationMappingStatus = pgEnum(
  "qualification_classification_mapping_status",
  ["proposed", "under_review", "accepted", "rejected"]
);

export const institutionIdentifierKind = pgEnum("institution_identifier_kind", [
  "registry",
  "official",
  "provider",
  "legacy",
  "other"
]);

export const institutionAliasKind = pgEnum("institution_alias_kind", [
  "official",
  "former",
  "local",
  "transliteration",
  "abbreviation",
  "source_name",
  "other"
]);

export const institutionUnitType = pgEnum("institution_unit_type", [
  "campus",
  "school",
  "college",
  "faculty",
  "department",
  "institute",
  "centre",
  "division",
  "research_centre",
  "other"
]);

export const recognitionScopeKind = pgEnum("recognition_scope_kind", [
  "institution",
  "institution_unit",
  "programme",
  "qualification",
  "delivery_mode"
]);

export const recognitionDecisionStatus = pgEnum("recognition_decision_status", [
  "recognised",
  "accredited",
  "provisionally_recognised",
  "not_recognised",
  "suspended",
  "withdrawn"
]);

export const recognitionReviewStatus = pgEnum("recognition_review_status", [
  "unreviewed",
  "under_review",
  "accepted",
  "disputed",
  "rejected"
]);

export const academicProgrammeType = pgEnum("academic_programme_type", [
  "degree",
  "diploma",
  "certificate",
  "professional",
  "vocational",
  "foundation",
  "other"
]);

export const programmeVersionStatus = pgEnum("programme_version_status", [
  "draft",
  "published",
  "superseded",
  "retired"
]);

export const academicPeriodKind = pgEnum("academic_period_kind", [
  "academic_year",
  "semester",
  "trimester",
  "quarter",
  "term",
  "session",
  "other"
]);

export const creditSystemStatus = pgEnum("credit_system_status", [
  "active",
  "inactive",
  "retired"
]);

export const programmeCourseRequirementKind = pgEnum(
  "programme_course_requirement_kind",
  ["core", "elective", "optional", "capstone", "prerequisite", "other"]
);

export const courseContentVersionStatus = pgEnum(
  "course_content_version_status",
  ["draft", "published", "superseded", "archived"]
);

export const knowledgeComponentKind = pgEnum("knowledge_component_kind", [
  "concept",
  "skill",
  "procedure",
  "principle",
  "strategy",
  "model",
  "misconception",
  "other"
]);

export const knowledgeComponentStatus = pgEnum("knowledge_component_status", [
  "draft",
  "active",
  "deprecated"
]);

export const knowledgeComponentVersionStatus = pgEnum(
  "knowledge_component_version_status",
  ["draft", "active", "superseded", "withdrawn"]
);

export const knowledgeComponentRelationKind = pgEnum(
  "knowledge_component_relation_kind",
  ["prerequisite", "part_of", "related_to", "progression", "contrasts_with"]
);

export const knowledgeComponentRelationReviewStatus = pgEnum(
  "knowledge_component_relation_review_status",
  ["proposed", "accepted", "rejected"]
);

export const courseKnowledgeMappingKind = pgEnum("course_knowledge_mapping_kind", [
  "taught",
  "practised",
  "assessed",
  "required",
  "learning_outcome"
]);

export const courseKnowledgeMappingStatus = pgEnum(
  "course_knowledge_mapping_status",
  ["proposed", "under_review", "accepted", "rejected"]
);

export const catalogueSources = pgTable(
  "catalogue_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerKey: varchar("provider_key", { length: 100 }).notNull(),
    name: text("name").notNull(),
    sourceType: catalogueSourceType("source_type").notNull(),
    accessMethod: catalogueAccessMethod("access_method").notNull(),
    baseUrl: text("base_url"),
    termsUrl: text("terms_url"),
    licenseName: text("license_name"),
    licenseUrl: text("license_url"),
    attributionText: text("attribution_text"),
    mayCache: boolean("may_cache"),
    mayStore: boolean("may_store"),
    mayDisplay: boolean("may_display"),
    mayRedistribute: boolean("may_redistribute"),
    status: catalogueSourceStatus("status").notNull().default("proposed"),
    rightsReviewedAt: timestampWithTimezone("rights_reviewed_at"),
    rightsReviewNotes: text("rights_review_notes"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("catalogue_sources_provider_key_unique").on(table.providerKey),
    index("catalogue_sources_status_idx").on(table.status),
    check("catalogue_sources_provider_key_nonempty_check", sql.raw('length(btrim("catalogue_sources"."provider_key")) > 0')),
    check("catalogue_sources_name_nonempty_check", sql.raw('length(btrim("catalogue_sources"."name")) > 0')),
    check("catalogue_sources_approved_rights_check", sql.raw('"catalogue_sources"."status" <> \'approved\' or ("catalogue_sources"."rights_reviewed_at" is not null and "catalogue_sources"."may_cache" is not null and "catalogue_sources"."may_store" is not null and "catalogue_sources"."may_display" is not null and "catalogue_sources"."may_redistribute" is not null)'))
  ]
);

export const catalogueSourceRecords = pgTable(
  "catalogue_source_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").notNull()
      .references(() => catalogueSources.id, { onDelete: "restrict" }),
    providerRecordId: varchar("provider_record_id", { length: 240 }),
    sourceUrl: text("source_url").notNull(),
    sourceRelease: varchar("source_release", { length: 120 }),
    sourcePublishedAt: timestampWithTimezone("source_published_at"),
    retrievedAt: timestampWithTimezone("retrieved_at").notNull().defaultNow(),
    contentHash: varchar("content_hash", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [
    uniqueIndex("catalogue_source_records_provider_record_unique")
      .on(table.sourceId, table.providerRecordId),
    index("catalogue_source_records_source_retrieved_idx")
      .on(table.sourceId, table.retrievedAt),
    check("catalogue_source_records_url_nonempty_check", sql.raw('length(btrim("catalogue_source_records"."source_url")) > 0')),
    check("catalogue_source_records_metadata_object_check", sql.raw('jsonb_typeof("catalogue_source_records"."metadata") = \'object\''))
  ]
);

/**
 * Reference records are intentionally not seeded by migrations. ISO and
 * education-system records must enter through a reviewed, attributable source.
 */
export const countries = pgTable(
  "countries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    isoAlpha2: varchar("iso_alpha_2", { length: 2 }),
    isoAlpha3: varchar("iso_alpha_3", { length: 3 }),
    isoNumeric: varchar("iso_numeric", { length: 3 }),
    name: text("name").notNull(),
    officialName: text("official_name"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    validFrom: timestampWithTimezone("valid_from"),
    validTo: timestampWithTimezone("valid_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("countries_iso_alpha_2_unique").on(table.isoAlpha2),
    uniqueIndex("countries_iso_alpha_3_unique").on(table.isoAlpha3),
    uniqueIndex("countries_iso_numeric_unique").on(table.isoNumeric),
    check("countries_name_nonempty_check", sql.raw('length(btrim("countries"."name")) > 0')),
    check("countries_iso_alpha_2_format_check", sql.raw('"countries"."iso_alpha_2" is null or "countries"."iso_alpha_2" ~ \'^[A-Z]{2}$\'')),
    check("countries_iso_alpha_3_format_check", sql.raw('"countries"."iso_alpha_3" is null or "countries"."iso_alpha_3" ~ \'^[A-Z]{3}$\'')),
    check("countries_iso_numeric_format_check", sql.raw('"countries"."iso_numeric" is null or "countries"."iso_numeric" ~ \'^[0-9]{3}$\'')),
    check("countries_valid_period_check", sql.raw('"countries"."valid_to" is null or "countries"."valid_from" is null or "countries"."valid_to" > "countries"."valid_from"'))
  ]
);

export const countryAliases = pgTable(
  "country_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id").notNull()
      .references(() => countries.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    languageTag: varchar("language_tag", { length: 35 }),
    aliasType: countryAliasType("alias_type").notNull().default("other"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("country_aliases_country_normalized_language_unique")
      .on(table.countryId, table.normalizedName, table.languageTag),
    index("country_aliases_normalized_name_idx").on(table.normalizedName),
    check("country_aliases_name_nonempty_check", sql.raw('length(btrim("country_aliases"."name")) > 0')),
    check("country_aliases_normalized_name_nonempty_check", sql.raw('length(btrim("country_aliases"."normalized_name")) > 0'))
  ]
);

export const educationJurisdictions = pgTable(
  "education_jurisdictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id")
      .references(() => countries.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => educationJurisdictions.id,
      { onDelete: "restrict" }
    ),
    code: varchar("code", { length: 120 }),
    name: text("name").notNull(),
    jurisdictionType: educationJurisdictionType("jurisdiction_type").notNull(),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "set null" }),
    validFrom: timestampWithTimezone("valid_from"),
    validTo: timestampWithTimezone("valid_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("education_jurisdictions_country_code_unique")
      .on(table.countryId, table.code),
    index("education_jurisdictions_parent_idx").on(table.parentId),
    index("education_jurisdictions_country_idx").on(table.countryId),
    check("education_jurisdictions_name_nonempty_check", sql.raw('length(btrim("education_jurisdictions"."name")) > 0')),
    check("education_jurisdictions_not_self_parent_check", sql.raw('"education_jurisdictions"."parent_id" is null or "education_jurisdictions"."parent_id" <> "education_jurisdictions"."id"')),
    check("education_jurisdictions_valid_period_check", sql.raw('"education_jurisdictions"."valid_to" is null or "education_jurisdictions"."valid_from" is null or "education_jurisdictions"."valid_to" > "education_jurisdictions"."valid_from"'))
  ]
);

export const educationSystems = pgTable(
  "education_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionId: uuid("jurisdiction_id")
      .notNull().references(() => educationJurisdictions.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 120 }),
    name: text("name").notNull(),
    description: text("description"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "set null" }),
    validFrom: timestampWithTimezone("valid_from"),
    validTo: timestampWithTimezone("valid_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("education_systems_jurisdiction_code_unique")
      .on(table.jurisdictionId, table.code),
    uniqueIndex("education_systems_id_jurisdiction_unique")
      .on(table.id, table.jurisdictionId),
    index("education_systems_jurisdiction_idx").on(table.jurisdictionId),
    check("education_systems_name_nonempty_check", sql.raw('length(btrim("education_systems"."name")) > 0')),
    check("education_systems_valid_period_check", sql.raw('"education_systems"."valid_to" is null or "education_systems"."valid_from" is null or "education_systems"."valid_to" > "education_systems"."valid_from"'))
  ]
);

export const qualificationFrameworks = pgTable(
  "qualification_frameworks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionId: uuid("jurisdiction_id").notNull()
      .references(() => educationJurisdictions.id, { onDelete: "restrict" }),
    educationSystemId: uuid("education_system_id"),
    code: varchar("code", { length: 120 }),
    name: text("name").notNull(),
    description: text("description"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "set null" }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("qualification_frameworks_jurisdiction_code_unique")
      .on(table.jurisdictionId, table.code),
    index("qualification_frameworks_education_system_idx").on(table.educationSystemId),
    foreignKey({
      name: "qualification_frameworks_system_same_jurisdiction_fk",
      columns: [table.educationSystemId, table.jurisdictionId],
      foreignColumns: [educationSystems.id, educationSystems.jurisdictionId]
    }).onDelete("restrict"),
    check("qualification_frameworks_name_nonempty_check", sql.raw('length(btrim("qualification_frameworks"."name")) > 0'))
  ]
);

export const qualificationFrameworkVersions = pgTable(
  "qualification_framework_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id").notNull()
      .references(() => qualificationFrameworks.id, { onDelete: "restrict" }),
    versionCode: varchar("version_code", { length: 120 }).notNull(),
    status: qualificationFrameworkVersionStatus("status").notNull().default("draft"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "set null" }),
    publishedAt: timestampWithTimezone("published_at"),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("qualification_framework_versions_framework_code_unique")
      .on(table.frameworkId, table.versionCode),
    index("qualification_framework_versions_status_idx").on(table.status),
    check("qualification_framework_versions_code_nonempty_check", sql.raw('length(btrim("qualification_framework_versions"."version_code")) > 0')),
    check("qualification_framework_versions_effective_period_check", sql.raw('"qualification_framework_versions"."effective_to" is null or "qualification_framework_versions"."effective_from" is null or "qualification_framework_versions"."effective_to" > "qualification_framework_versions"."effective_from"'))
  ]
);

export const qualificationLevels = pgTable(
  "qualification_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkVersionId: uuid("framework_version_id").notNull()
      .references(() => qualificationFrameworkVersions.id, { onDelete: "restrict" }),
    parentLevelId: uuid("parent_level_id"),
    code: varchar("code", { length: 120 }).notNull(),
    label: text("label").notNull(),
    description: text("description"),
    sequence: smallint("sequence"),
    descriptors: jsonb("descriptors").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [
    uniqueIndex("qualification_levels_version_code_unique")
      .on(table.frameworkVersionId, table.code),
    uniqueIndex("qualification_levels_id_version_unique")
      .on(table.id, table.frameworkVersionId),
    index("qualification_levels_parent_idx").on(table.parentLevelId),
    foreignKey({
      name: "qualification_levels_parent_same_version_fk",
      columns: [table.parentLevelId, table.frameworkVersionId],
      foreignColumns: [table.id, table.frameworkVersionId]
    }).onDelete("restrict"),
    check("qualification_levels_not_self_parent_check", sql.raw('"qualification_levels"."parent_level_id" is null or "qualification_levels"."parent_level_id" <> "qualification_levels"."id"')),
    check("qualification_levels_sequence_positive_check", sql.raw('"qualification_levels"."sequence" is null or "qualification_levels"."sequence" > 0')),
    check("qualification_levels_label_nonempty_check", sql.raw('length(btrim("qualification_levels"."label")) > 0')),
    check("qualification_levels_descriptors_object_check", sql.raw('jsonb_typeof("qualification_levels"."descriptors") = \'object\''))
  ]
);

export const classificationSchemes = pgTable(
  "classification_schemes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schemeCode: varchar("scheme_code", { length: 100 }).notNull(),
    name: text("name").notNull(),
    kind: classificationSchemeKind("kind").notNull(),
    publisher: text("publisher"),
    description: text("description"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("classification_schemes_code_unique").on(table.schemeCode),
    check("classification_schemes_code_nonempty_check", sql.raw('length(btrim("classification_schemes"."scheme_code")) > 0')),
    check("classification_schemes_name_nonempty_check", sql.raw('length(btrim("classification_schemes"."name")) > 0'))
  ]
);

export const classificationSchemeVersions = pgTable(
  "classification_scheme_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schemeId: uuid("scheme_id").notNull()
      .references(() => classificationSchemes.id, { onDelete: "restrict" }),
    versionCode: varchar("version_code", { length: 120 }).notNull(),
    sourceUrl: text("source_url"),
    publishedAt: timestampWithTimezone("published_at"),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("classification_scheme_versions_scheme_code_unique")
      .on(table.schemeId, table.versionCode),
    check("classification_scheme_versions_code_nonempty_check", sql.raw('length(btrim("classification_scheme_versions"."version_code")) > 0')),
    check("classification_scheme_versions_effective_period_check", sql.raw('"classification_scheme_versions"."effective_to" is null or "classification_scheme_versions"."effective_from" is null or "classification_scheme_versions"."effective_to" > "classification_scheme_versions"."effective_from"'))
  ]
);

export const classificationCodes = pgTable(
  "classification_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schemeVersionId: uuid("scheme_version_id").notNull()
      .references(() => classificationSchemeVersions.id, { onDelete: "restrict" }),
    parentCodeId: uuid("parent_code_id"),
    code: varchar("code", { length: 120 }).notNull(),
    label: text("label").notNull(),
    description: text("description"),
    depth: smallint("depth")
  },
  (table) => [
    uniqueIndex("classification_codes_version_code_unique")
      .on(table.schemeVersionId, table.code),
    uniqueIndex("classification_codes_id_version_unique")
      .on(table.id, table.schemeVersionId),
    index("classification_codes_parent_idx").on(table.parentCodeId),
    foreignKey({
      name: "classification_codes_parent_same_version_fk",
      columns: [table.parentCodeId, table.schemeVersionId],
      foreignColumns: [table.id, table.schemeVersionId]
    }).onDelete("restrict"),
    check("classification_codes_not_self_parent_check", sql.raw('"classification_codes"."parent_code_id" is null or "classification_codes"."parent_code_id" <> "classification_codes"."id"')),
    check("classification_codes_depth_positive_check", sql.raw('"classification_codes"."depth" is null or "classification_codes"."depth" > 0')),
    check("classification_codes_label_nonempty_check", sql.raw('length(btrim("classification_codes"."label")) > 0'))
  ]
);

export const qualificationLevelClassificationMappings = pgTable(
  "qualification_level_classification_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    qualificationLevelId: uuid("qualification_level_id").notNull()
      .references(() => qualificationLevels.id, { onDelete: "cascade" }),
    classificationCodeId: uuid("classification_code_id").notNull()
      .references(() => classificationCodes.id, { onDelete: "restrict" }),
    mappingKind: qualificationClassificationMappingKind("mapping_kind").notNull(),
    status: qualificationClassificationMappingStatus("status").notNull().default("proposed"),
    rationale: text("rationale").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("qual_level_map_unique")
      .on(table.qualificationLevelId, table.classificationCodeId, table.mappingKind),
    index("qual_level_map_status_idx").on(table.status),
    check("qual_level_map_rationale_nonempty_chk", sql.raw('length(btrim("qualification_level_classification_mappings"."rationale")) > 0')),
    check("qual_level_map_confidence_chk", sql.raw('"qualification_level_classification_mappings"."confidence" is null or ("qualification_level_classification_mappings"."confidence" >= 0 and "qualification_level_classification_mappings"."confidence" <= 1)')),
    check("qual_level_map_accepted_evidence_chk", sql.raw('"qualification_level_classification_mappings"."status" <> \'accepted\' or ("qualification_level_classification_mappings"."source_record_id" is not null and "qualification_level_classification_mappings"."reviewed_at" is not null)'))
  ]
);

export const institutionIdentifiers = pgTable(
  "institution_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    providerNamespace: varchar("provider_namespace", { length: 120 }).notNull(),
    identifier: varchar("identifier", { length: 240 }).notNull(),
    identifierKind: institutionIdentifierKind("identifier_kind").notNull().default("provider"),
    identifierUri: text("identifier_uri"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewStatus: catalogueAssertionStatus("review_status").notNull().default("unreviewed"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("institution_identifiers_namespace_identifier_unique")
      .on(table.providerNamespace, table.identifier),
    uniqueIndex("institution_identifiers_institution_namespace_unique")
      .on(table.institutionId, table.providerNamespace, table.identifier),
    index("institution_identifiers_institution_idx").on(table.institutionId),
    check("institution_identifiers_namespace_nonempty_check", sql.raw('length(btrim("institution_identifiers"."provider_namespace")) > 0')),
    check("institution_identifiers_value_nonempty_check", sql.raw('length(btrim("institution_identifiers"."identifier")) > 0')),
    check("institution_identifiers_review_evidence_check", sql.raw('"institution_identifiers"."review_status" <> \'accepted\' or ("institution_identifiers"."source_record_id" is not null and "institution_identifiers"."reviewed_at" is not null)'))
  ]
);

export const institutionAliases = pgTable(
  "institution_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    languageTag: varchar("language_tag", { length: 35 }).notNull().default("und"),
    aliasKind: institutionAliasKind("alias_kind").notNull().default("other"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewStatus: catalogueAssertionStatus("review_status").notNull().default("unreviewed"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("institution_aliases_institution_name_language_unique")
      .on(table.institutionId, table.normalizedName, table.languageTag),
    index("institution_aliases_normalized_name_idx").on(table.normalizedName),
    check("institution_aliases_name_nonempty_check", sql.raw('length(btrim("institution_aliases"."name")) > 0')),
    check("institution_aliases_normalized_name_nonempty_check", sql.raw('length(btrim("institution_aliases"."normalized_name")) > 0')),
    check("institution_aliases_review_evidence_check", sql.raw('"institution_aliases"."review_status" <> \'accepted\' or ("institution_aliases"."source_record_id" is not null and "institution_aliases"."reviewed_at" is not null)'))
  ]
);

export const institutionUnits = pgTable(
  "institution_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    parentUnitId: uuid("parent_unit_id"),
    unitType: institutionUnitType("unit_type").notNull(),
    code: varchar("code", { length: 120 }),
    slug: varchar("slug", { length: 140 }),
    name: text("name").notNull(),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewStatus: catalogueAssertionStatus("review_status").notNull().default("unreviewed"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    validFrom: timestampWithTimezone("valid_from"),
    validTo: timestampWithTimezone("valid_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("institution_units_id_institution_unique")
      .on(table.id, table.institutionId),
    uniqueIndex("institution_units_institution_slug_unique")
      .on(table.institutionId, table.slug),
    foreignKey({
      name: "institution_units_parent_same_institution_fk",
      columns: [table.parentUnitId, table.institutionId],
      foreignColumns: [table.id, table.institutionId]
    }).onDelete("restrict"),
    index("institution_units_parent_idx").on(table.parentUnitId),
    index("institution_units_institution_type_idx").on(table.institutionId, table.unitType),
    check("institution_units_not_self_parent_check", sql.raw('"institution_units"."parent_unit_id" is null or "institution_units"."parent_unit_id" <> "institution_units"."id"')),
    check("institution_units_name_nonempty_check", sql.raw('length(btrim("institution_units"."name")) > 0')),
    check("institution_units_valid_period_check", sql.raw('"institution_units"."valid_to" is null or "institution_units"."valid_from" is null or "institution_units"."valid_to" > "institution_units"."valid_from"')),
    check("institution_units_review_evidence_check", sql.raw('"institution_units"."review_status" <> \'accepted\' or ("institution_units"."source_record_id" is not null and "institution_units"."reviewed_at" is not null)'))
  ]
);

export const recognitionAuthorities = pgTable(
  "recognition_authorities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionId: uuid("jurisdiction_id").notNull()
      .references(() => educationJurisdictions.id, { onDelete: "restrict" }),
    authorityCode: varchar("authority_code", { length: 120 }),
    name: text("name").notNull(),
    authorityType: varchar("authority_type", { length: 80 }).notNull(),
    websiteUrl: text("website_url"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("recognition_authorities_jurisdiction_code_unique")
      .on(table.jurisdictionId, table.authorityCode),
    index("recognition_authorities_jurisdiction_idx").on(table.jurisdictionId),
    check("recognition_authorities_name_nonempty_check", sql.raw('length(btrim("recognition_authorities"."name")) > 0')),
    check("recognition_authorities_type_nonempty_check", sql.raw('length(btrim("recognition_authorities"."authority_type")) > 0'))
  ]
);

export const academicProgrammes = pgTable(
  "academic_programmes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    institutionUnitId: uuid("institution_unit_id"),
    programmeCode: varchar("programme_code", { length: 120 }),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: text("name").notNull(),
    programmeType: academicProgrammeType("programme_type").notNull().default("other"),
    description: text("description"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewStatus: catalogueAssertionStatus("review_status").notNull().default("unreviewed"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("academic_programmes_id_institution_unique")
      .on(table.id, table.institutionId),
    uniqueIndex("academic_programmes_institution_slug_unique")
      .on(table.institutionId, table.slug),
    uniqueIndex("academic_programmes_institution_code_unique")
      .on(table.institutionId, table.programmeCode),
    foreignKey({
      name: "academic_programmes_unit_same_institution_fk",
      columns: [table.institutionUnitId, table.institutionId],
      foreignColumns: [institutionUnits.id, institutionUnits.institutionId]
    }).onDelete("restrict"),
    index("academic_programmes_institution_idx").on(table.institutionId),
    index("academic_programmes_unit_idx").on(table.institutionUnitId),
    check("academic_programmes_name_nonempty_check", sql.raw('length(btrim("academic_programmes"."name")) > 0')),
    check("academic_programmes_slug_nonempty_check", sql.raw('length(btrim("academic_programmes"."slug")) > 0')),
    check("academic_programmes_review_evidence_check", sql.raw('"academic_programmes"."review_status" <> \'accepted\' or ("academic_programmes"."source_record_id" is not null and "academic_programmes"."reviewed_at" is not null)'))
  ]
);

export const programmeVersions = pgTable(
  "programme_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programmeId: uuid("programme_id").notNull(),
    institutionId: uuid("institution_id").notNull(),
    versionCode: varchar("version_code", { length: 120 }).notNull(),
    title: text("title").notNull(),
    awardTitle: text("award_title"),
    status: programmeVersionStatus("status").notNull().default("draft"),
    minimumDurationMonths: smallint("minimum_duration_months"),
    maximumDurationMonths: smallint("maximum_duration_months"),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    publishedAt: timestampWithTimezone("published_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("programme_versions_programme_code_unique")
      .on(table.programmeId, table.versionCode),
    uniqueIndex("programme_versions_id_programme_unique")
      .on(table.id, table.programmeId),
    uniqueIndex("programme_versions_id_institution_unique")
      .on(table.id, table.institutionId),
    foreignKey({
      name: "programme_versions_programme_same_institution_fk",
      columns: [table.programmeId, table.institutionId],
      foreignColumns: [academicProgrammes.id, academicProgrammes.institutionId]
    }).onDelete("restrict"),
    index("programme_versions_programme_status_idx").on(table.programmeId, table.status),
    check("programme_versions_title_nonempty_check", sql.raw('length(btrim("programme_versions"."title")) > 0')),
    check("programme_versions_duration_check", sql.raw('"programme_versions"."minimum_duration_months" is null or "programme_versions"."maximum_duration_months" is null or "programme_versions"."maximum_duration_months" >= "programme_versions"."minimum_duration_months"')),
    check("programme_versions_effective_period_check", sql.raw('"programme_versions"."effective_to" is null or "programme_versions"."effective_from" is null or "programme_versions"."effective_to" > "programme_versions"."effective_from"')),
    check("programme_versions_published_evidence_check", sql.raw('"programme_versions"."status" <> \'published\' or ("programme_versions"."source_record_id" is not null and "programme_versions"."published_at" is not null)'))
  ]
);

export const programmeQualifications = pgTable(
  "programme_qualifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programmeVersionId: uuid("programme_version_id").notNull()
      .references(() => programmeVersions.id, { onDelete: "restrict" }),
    qualificationLevelId: uuid("qualification_level_id").notNull()
      .references(() => qualificationLevels.id, { onDelete: "restrict" }),
    awardTitle: text("award_title"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewStatus: catalogueAssertionStatus("review_status").notNull().default("unreviewed"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    rationale: text("rationale").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("programme_qualifications_version_level_unique")
      .on(table.programmeVersionId, table.qualificationLevelId),
    index("programme_qualifications_level_idx").on(table.qualificationLevelId),
    check("programme_qualifications_rationale_nonempty_check", sql.raw('length(btrim("programme_qualifications"."rationale")) > 0')),
    check("programme_qualifications_review_evidence_check", sql.raw('"programme_qualifications"."review_status" <> \'accepted\' or ("programme_qualifications"."source_record_id" is not null and "programme_qualifications"."reviewed_at" is not null)'))
  ]
);

export const recognitionDecisions = pgTable(
  "recognition_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorityId: uuid("authority_id").notNull()
      .references(() => recognitionAuthorities.id, { onDelete: "restrict" }),
    scopeKind: recognitionScopeKind("scope_kind").notNull(),
    decisionStatus: recognitionDecisionStatus("decision_status").notNull(),
    reviewStatus: recognitionReviewStatus("review_status").notNull().default("unreviewed"),
    institutionId: uuid("institution_id")
      .references(() => institutions.id, { onDelete: "restrict" }),
    institutionUnitId: uuid("institution_unit_id")
      .references(() => institutionUnits.id, { onDelete: "restrict" }),
    programmeVersionId: uuid("programme_version_id")
      .references(() => programmeVersions.id, { onDelete: "restrict" }),
    qualificationLevelId: uuid("qualification_level_id")
      .references(() => qualificationLevels.id, { onDelete: "restrict" }),
    deliveryMode: varchar("delivery_mode", { length: 80 }),
    decisionReference: varchar("decision_reference", { length: 160 }),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    rationale: text("rationale"),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    issuedAt: timestampWithTimezone("issued_at"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index("recognition_decisions_authority_status_idx").on(table.authorityId, table.reviewStatus),
    index("recognition_decisions_institution_idx").on(table.institutionId),
    index("recognition_decisions_programme_idx").on(table.programmeVersionId),
    index("recognition_decisions_validity_idx").on(table.effectiveFrom, table.effectiveTo),
    check("recognition_decisions_exactly_one_subject_check", sql.raw('num_nonnulls("recognition_decisions"."institution_id", "recognition_decisions"."institution_unit_id", "recognition_decisions"."programme_version_id", "recognition_decisions"."qualification_level_id") = 1')),
    check("recognition_decisions_scope_subject_check", sql.raw('("recognition_decisions"."scope_kind" = \'institution\' and "recognition_decisions"."institution_id" is not null and "recognition_decisions"."delivery_mode" is null) or ("recognition_decisions"."scope_kind" = \'institution_unit\' and "recognition_decisions"."institution_unit_id" is not null and "recognition_decisions"."delivery_mode" is null) or ("recognition_decisions"."scope_kind" = \'programme\' and "recognition_decisions"."programme_version_id" is not null and "recognition_decisions"."delivery_mode" is null) or ("recognition_decisions"."scope_kind" = \'qualification\' and "recognition_decisions"."qualification_level_id" is not null and "recognition_decisions"."delivery_mode" is null) or ("recognition_decisions"."scope_kind" = \'delivery_mode\' and "recognition_decisions"."programme_version_id" is not null and length(btrim(coalesce("recognition_decisions"."delivery_mode", \'\'))) > 0)')),
    check("recognition_decisions_accepted_review_check", sql.raw('"recognition_decisions"."review_status" <> \'accepted\' or "recognition_decisions"."reviewed_at" is not null')),
    check("recognition_decisions_validity_check", sql.raw('"recognition_decisions"."effective_to" is null or "recognition_decisions"."effective_from" is null or "recognition_decisions"."effective_to" > "recognition_decisions"."effective_from"'))
  ]
);

export const creditSystems = pgTable(
  "credit_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionId: uuid("jurisdiction_id").notNull()
      .references(() => educationJurisdictions.id, { onDelete: "restrict" }),
    institutionId: uuid("institution_id")
      .references(() => institutions.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 120 }).notNull(),
    name: text("name").notNull(),
    unitName: text("unit_name").notNull(),
    symbol: varchar("symbol", { length: 24 }),
    decimalPlaces: smallint("decimal_places").notNull().default(2),
    description: text("description"),
    status: creditSystemStatus("status").notNull().default("active"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("credit_systems_jurisdiction_code_unique")
      .on(table.jurisdictionId, table.code),
    index("credit_systems_institution_idx").on(table.institutionId),
    check("credit_systems_name_nonempty_check", sql.raw('length(btrim("credit_systems"."name")) > 0')),
    check("credit_systems_unit_name_nonempty_check", sql.raw('length(btrim("credit_systems"."unit_name")) > 0')),
    check("credit_systems_decimal_places_check", sql.raw('"credit_systems"."decimal_places" between 0 and 6')),
    check("credit_systems_validity_check", sql.raw('"credit_systems"."effective_to" is null or "credit_systems"."effective_from" is null or "credit_systems"."effective_to" > "credit_systems"."effective_from"'))
  ]
);

export const academicPeriods = pgTable(
  "academic_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    parentPeriodId: uuid("parent_period_id"),
    code: varchar("code", { length: 120 }),
    name: text("name").notNull(),
    periodKind: academicPeriodKind("period_kind").notNull(),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("academic_periods_id_institution_unique")
      .on(table.id, table.institutionId),
    uniqueIndex("academic_periods_institution_code_unique")
      .on(table.institutionId, table.code),
    foreignKey({
      name: "academic_periods_parent_same_institution_fk",
      columns: [table.parentPeriodId, table.institutionId],
      foreignColumns: [table.id, table.institutionId]
    }).onDelete("restrict"),
    index("academic_periods_institution_dates_idx").on(table.institutionId, table.startsOn, table.endsOn),
    check("academic_periods_name_nonempty_check", sql.raw('length(btrim("academic_periods"."name")) > 0')),
    check("academic_periods_validity_check", sql.raw('"academic_periods"."ends_on" is null or "academic_periods"."starts_on" is null or "academic_periods"."ends_on" > "academic_periods"."starts_on"')),
    check("academic_periods_not_self_parent_check", sql.raw('"academic_periods"."parent_period_id" is null or "academic_periods"."parent_period_id" <> "academic_periods"."id"'))
  ]
);

export const courseContentVersions = pgTable(
  "course_content_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id").notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    legacyCurriculumVersionId: uuid("legacy_curriculum_version_id"),
    versionCode: varchar("version_code", { length: 120 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sourceUrl: text("source_url"),
    contentHash: varchar("content_hash", { length: 160 }),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    status: courseContentVersionStatus("status").notNull().default("draft"),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    publishedAt: timestampWithTimezone("published_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("course_content_versions_course_code_unique")
      .on(table.courseId, table.versionCode),
    uniqueIndex("course_content_versions_id_course_unique")
      .on(table.id, table.courseId),
    foreignKey({
      name: "course_content_versions_legacy_curriculum_course_fk",
      columns: [table.legacyCurriculumVersionId, table.courseId],
      foreignColumns: [curriculumVersions.id, curriculumVersions.courseId]
    }).onDelete("restrict"),
    index("course_content_versions_course_status_idx").on(table.courseId, table.status),

    check("course_content_versions_title_nonempty_check", sql.raw('length(btrim("course_content_versions"."title")) > 0')),
    check("course_content_versions_validity_check", sql.raw('"course_content_versions"."effective_to" is null or "course_content_versions"."effective_from" is null or "course_content_versions"."effective_to" > "course_content_versions"."effective_from"')),
    check("course_content_versions_published_evidence_check", sql.raw('"course_content_versions"."status" <> \'published\' or ("course_content_versions"."source_record_id" is not null and "course_content_versions"."published_at" is not null)'))
  ]
);

export const programmeCourseRequirements = pgTable(
  "programme_course_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    programmeVersionId: uuid("programme_version_id").notNull(),
    courseId: uuid("course_id").notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    courseContentVersionId: uuid("course_content_version_id"),
    academicPeriodId: uuid("academic_period_id"),
    requirementKind: programmeCourseRequirementKind("requirement_kind").notNull(),
    localStageLabel: varchar("local_stage_label", { length: 120 }),
    localStageIndex: smallint("local_stage_index"),
    creditValue: numeric("credit_value", { precision: 8, scale: 3 }),
    creditSystemId: uuid("credit_system_id")
      .references(() => creditSystems.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    requirementGroup: varchar("requirement_group", { length: 120 }),
    description: text("description"),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    foreignKey({
      name: "programme_course_requirements_programme_same_institution_fk",
      columns: [table.programmeVersionId, table.institutionId],
      foreignColumns: [programmeVersions.id, programmeVersions.institutionId]
    }).onDelete("restrict"),
    foreignKey({
      name: "programme_course_requirements_period_same_institution_fk",
      columns: [table.academicPeriodId, table.institutionId],
      foreignColumns: [academicPeriods.id, academicPeriods.institutionId]
    }).onDelete("restrict"),
    foreignKey({
      name: "programme_course_requirements_content_course_fk",
      columns: [table.courseContentVersionId, table.courseId],
      foreignColumns: [courseContentVersions.id, courseContentVersions.courseId]
    }).onDelete("restrict"),
    uniqueIndex("programme_course_requirements_unique")
      .on(table.programmeVersionId, table.courseId, table.requirementKind, table.localStageIndex),
    index("programme_course_requirements_course_idx").on(table.courseId),
    index("programme_course_requirements_period_idx").on(table.academicPeriodId),
    check("programme_course_requirements_position_positive_check", sql.raw('"programme_course_requirements"."position" > 0')),
    check("programme_course_requirements_stage_positive_check", sql.raw('"programme_course_requirements"."local_stage_index" is null or "programme_course_requirements"."local_stage_index" > 0')),
    check("programme_course_requirements_credit_pair_check", sql.raw('("programme_course_requirements"."credit_value" is null and "programme_course_requirements"."credit_system_id" is null) or ("programme_course_requirements"."credit_value" is not null and "programme_course_requirements"."credit_system_id" is not null and "programme_course_requirements"."credit_value" >= 0'))
  ]
);

export const knowledgeComponents = pgTable(
  "knowledge_components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    kind: knowledgeComponentKind("kind").notNull(),
    status: knowledgeComponentStatus("status").notNull().default("draft"),
    domainKey: varchar("domain_key", { length: 120 }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("knowledge_components_slug_unique").on(table.slug),
    check("knowledge_components_slug_nonempty_check", sql.raw('length(btrim("knowledge_components"."slug")) > 0'))
  ]
);

export const knowledgeComponentVersions = pgTable(
  "knowledge_component_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    knowledgeComponentId: uuid("knowledge_component_id").notNull()
      .references(() => knowledgeComponents.id, { onDelete: "restrict" }),
    versionCode: varchar("version_code", { length: 80 }).notNull(),
    name: text("name").notNull(),
    definition: text("definition").notNull(),
    learningObjectives: jsonb("learning_objectives")
      .$type<string[]>()
      .notNull()
      .default([]),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    status: knowledgeComponentVersionStatus("status").notNull().default("draft"),
    effectiveFrom: timestampWithTimezone("effective_from"),
    effectiveTo: timestampWithTimezone("effective_to"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("knowledge_component_versions_component_code_unique")
      .on(table.knowledgeComponentId, table.versionCode),
    uniqueIndex("knowledge_component_versions_id_component_unique")
      .on(table.id, table.knowledgeComponentId),
    check("knowledge_component_versions_name_nonempty_check", sql.raw('length(btrim("knowledge_component_versions"."name")) > 0')),
    check("knowledge_component_versions_definition_nonempty_check", sql.raw('length(btrim("knowledge_component_versions"."definition")) > 0')),
    check("knowledge_component_versions_objectives_array_check", sql.raw('jsonb_typeof("knowledge_component_versions"."learning_objectives") = \'array\'')),
    check("knowledge_component_versions_validity_check", sql.raw('"knowledge_component_versions"."effective_to" is null or "knowledge_component_versions"."effective_from" is null or "knowledge_component_versions"."effective_to" > "knowledge_component_versions"."effective_from"')),
    check("knowledge_component_versions_active_evidence_check", sql.raw('"knowledge_component_versions"."status" <> \'active\' or ("knowledge_component_versions"."source_record_id" is not null and "knowledge_component_versions"."reviewed_at" is not null)'))
  ]
);

export const knowledgeComponentRelations = pgTable(
  "knowledge_component_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceVersionId: uuid("source_version_id").notNull()
      .references(() => knowledgeComponentVersions.id, { onDelete: "restrict" }),
    targetVersionId: uuid("target_version_id").notNull()
      .references(() => knowledgeComponentVersions.id, { onDelete: "restrict" }),
    relationKind: knowledgeComponentRelationKind("relation_kind").notNull(),
    reviewStatus: knowledgeComponentRelationReviewStatus("review_status").notNull().default("proposed"),
    rationale: text("rationale").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("knowledge_component_relations_unique")
      .on(table.sourceVersionId, table.targetVersionId, table.relationKind),
    index("knowledge_component_relations_source_status_idx").on(table.sourceVersionId, table.reviewStatus),
    index("knowledge_component_relations_target_idx").on(table.targetVersionId),
    check("knowledge_component_relations_not_self_check", sql.raw('"knowledge_component_relations"."source_version_id" <> "knowledge_component_relations"."target_version_id"')),
    check("knowledge_component_relations_rationale_nonempty_check", sql.raw('length(btrim("knowledge_component_relations"."rationale")) > 0')),
    check("knowledge_component_relations_confidence_check", sql.raw('"knowledge_component_relations"."confidence" is null or ("knowledge_component_relations"."confidence" >= 0 and "knowledge_component_relations"."confidence" <= 1)')),
    check("knowledge_component_relations_accepted_evidence_check", sql.raw('"knowledge_component_relations"."review_status" <> \'accepted\' or ("knowledge_component_relations"."source_record_id" is not null and "knowledge_component_relations"."reviewed_at" is not null)'))
  ]
);

export const courseKnowledgeComponentMappings = pgTable(
  "course_knowledge_component_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseContentVersionId: uuid("course_content_version_id").notNull()
      .references(() => courseContentVersions.id, { onDelete: "restrict" }),
    knowledgeComponentVersionId: uuid("knowledge_component_version_id").notNull()
      .references(() => knowledgeComponentVersions.id, { onDelete: "restrict" }),
    mappingKind: courseKnowledgeMappingKind("mapping_kind").notNull(),
    status: courseKnowledgeMappingStatus("status").notNull().default("proposed"),
    mappingMethod: varchar("mapping_method", { length: 80 }).notNull(),
    rationale: text("rationale").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    sourceRecordId: uuid("source_record_id")
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("course_knowledge_component_mappings_unique")
      .on(table.courseContentVersionId, table.knowledgeComponentVersionId, table.mappingKind),
    index("course_knowledge_component_mappings_status_idx").on(table.status),
    check("course_knowledge_component_mappings_rationale_nonempty_check", sql.raw('length(btrim("course_knowledge_component_mappings"."rationale")) > 0')),
    check("course_knowledge_component_mappings_method_nonempty_check", sql.raw('length(btrim("course_knowledge_component_mappings"."mapping_method")) > 0')),
    check("course_knowledge_component_mappings_confidence_check", sql.raw('"course_knowledge_component_mappings"."confidence" is null or ("course_knowledge_component_mappings"."confidence" >= 0 and "course_knowledge_component_mappings"."confidence" <= 1)')),
    check("course_knowledge_component_mappings_accepted_evidence_check", sql.raw('"course_knowledge_component_mappings"."status" <> \'accepted\' or ("course_knowledge_component_mappings"."source_record_id" is not null and "course_knowledge_component_mappings"."reviewed_at" is not null)'))
  ]
);

export const entitySourceAssertions = pgTable(
  "entity_source_assertions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceRecordId: uuid("source_record_id").notNull()
      .references(() => catalogueSourceRecords.id, { onDelete: "restrict" }),
    countryId: uuid("country_id")
      .references(() => countries.id, { onDelete: "restrict" }),
    institutionId: uuid("institution_id")
      .references(() => institutions.id, { onDelete: "restrict" }),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => educationJurisdictions.id, { onDelete: "restrict" }),
    qualificationFrameworkId: uuid("qualification_framework_id")
      .references(() => qualificationFrameworks.id, { onDelete: "restrict" }),
    qualificationLevelId: uuid("qualification_level_id")
      .references(() => qualificationLevels.id, { onDelete: "restrict" }),
    institutionUnitId: uuid("institution_unit_id").references(() => institutionUnits.id, { onDelete: "restrict" }),
    recognitionAuthorityId: uuid("recognition_authority_id").references(() => recognitionAuthorities.id, { onDelete: "restrict" }),
    recognitionDecisionId: uuid("recognition_decision_id").references(() => recognitionDecisions.id, { onDelete: "restrict" }),
    academicProgrammeId: uuid("academic_programme_id").references(() => academicProgrammes.id, { onDelete: "restrict" }),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersions.id, { onDelete: "restrict" }),
    academicPeriodId: uuid("academic_period_id").references(() => academicPeriods.id, { onDelete: "restrict" }),
    creditSystemId: uuid("credit_system_id").references(() => creditSystems.id, { onDelete: "restrict" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "restrict" }),
    curriculumVersionId: uuid("curriculum_version_id").references(() => curriculumVersions.id, { onDelete: "restrict" }),
    courseContentVersionId: uuid("course_content_version_id").references(() => courseContentVersions.id, { onDelete: "restrict" }),
    knowledgeComponentId: uuid("knowledge_component_id").references(() => knowledgeComponents.id, { onDelete: "restrict" }),
    knowledgeComponentVersionId: uuid("knowledge_component_version_id").references(() => knowledgeComponentVersions.id, { onDelete: "restrict" }),
    claimKey: varchar("claim_key", { length: 120 }).notNull(),
    claimValue: jsonb("claim_value").$type<unknown>().notNull(),
    evidenceNote: text("evidence_note"),
    status: catalogueAssertionStatus("status").notNull().default("unreviewed"),
    validFrom: timestampWithTimezone("valid_from"),
    validTo: timestampWithTimezone("valid_to"),
    checkedAt: timestampWithTimezone("checked_at").notNull().defaultNow(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index("entity_source_assertions_source_status_idx").on(table.sourceRecordId, table.status),
    index("entity_source_assertions_country_idx").on(table.countryId),
    index("entity_source_assertions_institution_idx").on(table.institutionId),
    index("entity_source_assertions_jurisdiction_idx").on(table.jurisdictionId),
    check("entity_source_assertions_exactly_one_subject_check", sql.raw('num_nonnulls("entity_source_assertions"."country_id", "entity_source_assertions"."institution_id", "entity_source_assertions"."jurisdiction_id", "entity_source_assertions"."qualification_framework_id", "entity_source_assertions"."qualification_level_id", "entity_source_assertions"."institution_unit_id", "entity_source_assertions"."recognition_authority_id", "entity_source_assertions"."recognition_decision_id", "entity_source_assertions"."academic_programme_id", "entity_source_assertions"."programme_version_id", "entity_source_assertions"."academic_period_id", "entity_source_assertions"."credit_system_id", "entity_source_assertions"."course_id", "entity_source_assertions"."curriculum_version_id", "entity_source_assertions"."course_content_version_id", "entity_source_assertions"."knowledge_component_id", "entity_source_assertions"."knowledge_component_version_id") = 1')),
    check("entity_source_assertions_claim_key_nonempty_check", sql.raw('length(btrim("entity_source_assertions"."claim_key")) > 0')),
    check("entity_source_assertions_valid_period_check", sql.raw('"entity_source_assertions"."valid_to" is null or "entity_source_assertions"."valid_from" is null or "entity_source_assertions"."valid_to" > "entity_source_assertions"."valid_from"'))
  ]
);

export const catalogueReviewEvents = pgTable(
  "catalogue_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assertionId: uuid("assertion_id").notNull()
      .references(() => entitySourceAssertions.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    action: catalogueReviewAction("action").notNull(),
    previousStatus: catalogueAssertionStatus("previous_status"),
    newStatus: catalogueAssertionStatus("new_status"),
    rationale: text("rationale"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    index("catalogue_review_events_assertion_created_idx").on(table.assertionId, table.createdAt),
    index("catalogue_review_events_reviewer_created_idx").on(table.reviewerId, table.createdAt),
    check("catalogue_review_events_status_change_check", sql.raw('"catalogue_review_events"."previous_status" is null or "catalogue_review_events"."new_status" is null or "catalogue_review_events"."previous_status" <> "catalogue_review_events"."new_status"'))
  ]
);
