import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
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
import { institutions } from "./academic";
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
    check("entity_source_assertions_exactly_one_subject_check", sql.raw('num_nonnulls("entity_source_assertions"."country_id", "entity_source_assertions"."institution_id", "entity_source_assertions"."jurisdiction_id", "entity_source_assertions"."qualification_framework_id", "entity_source_assertions"."qualification_level_id") = 1')),
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
