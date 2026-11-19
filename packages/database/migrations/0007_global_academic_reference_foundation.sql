CREATE TYPE "public"."education_jurisdiction_type" AS ENUM('national', 'subnational', 'territorial', 'regional', 'other');
--> statement-breakpoint
CREATE TYPE "public"."country_alias_type" AS ENUM('official', 'short', 'historical', 'transliteration', 'source_name', 'other');
--> statement-breakpoint
CREATE TYPE "public"."qualification_framework_version_status" AS ENUM('draft', 'active', 'superseded', 'withdrawn');
--> statement-breakpoint
CREATE TYPE "public"."classification_scheme_kind" AS ENUM('programme', 'attainment', 'field', 'other');
--> statement-breakpoint
CREATE TYPE "public"."catalogue_source_type" AS ENUM('official_authority', 'official_institution', 'intergovernmental', 'registry', 'licensed_directory', 'open_dataset', 'other');
--> statement-breakpoint
CREATE TYPE "public"."catalogue_access_method" AS ENUM('official_api', 'data_dump', 'public_search', 'licensed_access', 'manual_evidence');
--> statement-breakpoint
CREATE TYPE "public"."catalogue_source_status" AS ENUM('proposed', 'approved', 'restricted', 'disabled', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."catalogue_assertion_status" AS ENUM('unreviewed', 'under_review', 'accepted', 'disputed', 'rejected', 'superseded');
--> statement-breakpoint
CREATE TYPE "public"."catalogue_review_action" AS ENUM('submitted', 'reviewed', 'accepted', 'disputed', 'rejected', 'superseded');
--> statement-breakpoint
CREATE TYPE "public"."qualification_classification_mapping_kind" AS ENUM('isced_p', 'isced_a');
--> statement-breakpoint
CREATE TYPE "public"."qualification_classification_mapping_status" AS ENUM('proposed', 'under_review', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TABLE "catalogue_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_key" varchar(100) NOT NULL,
  "name" text NOT NULL,
  "source_type" "catalogue_source_type" NOT NULL,
  "access_method" "catalogue_access_method" NOT NULL,
  "base_url" text,
  "terms_url" text,
  "license_name" text,
  "license_url" text,
  "attribution_text" text,
  "may_cache" boolean,
  "may_store" boolean,
  "may_display" boolean,
  "may_redistribute" boolean,
  "status" "catalogue_source_status" DEFAULT 'proposed' NOT NULL,
  "rights_reviewed_at" timestamp with time zone,
  "rights_review_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "catalogue_sources_provider_key_nonempty_check" CHECK (length(btrim("provider_key")) > 0),
  CONSTRAINT "catalogue_sources_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "catalogue_sources_approved_rights_check" CHECK ("status" <> 'approved' OR ("rights_reviewed_at" IS NOT NULL AND "may_cache" IS NOT NULL AND "may_store" IS NOT NULL AND "may_display" IS NOT NULL AND "may_redistribute" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "catalogue_source_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL,
  "provider_record_id" varchar(240),
  "source_url" text NOT NULL,
  "source_release" varchar(120),
  "source_published_at" timestamp with time zone,
  "retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "content_hash" varchar(160),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "catalogue_source_records_url_nonempty_check" CHECK (length(btrim("source_url")) > 0),
  CONSTRAINT "catalogue_source_records_metadata_object_check" CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "catalogue_source_records_source_id_catalogue_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."catalogue_sources"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "countries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "iso_alpha_2" varchar(2),
  "iso_alpha_3" varchar(3),
  "iso_numeric" varchar(3),
  "name" text NOT NULL,
  "official_name" text,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "countries_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "countries_iso_alpha_2_format_check" CHECK ("iso_alpha_2" IS NULL OR "iso_alpha_2" ~ '^[A-Z]{2}$'),
  CONSTRAINT "countries_iso_alpha_3_format_check" CHECK ("iso_alpha_3" IS NULL OR "iso_alpha_3" ~ '^[A-Z]{3}$'),
  CONSTRAINT "countries_iso_numeric_format_check" CHECK ("iso_numeric" IS NULL OR "iso_numeric" ~ '^[0-9]{3}$'),
  CONSTRAINT "countries_valid_period_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from")
);
--> statement-breakpoint
CREATE TABLE "country_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "country_id" uuid NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "language_tag" varchar(35),
  "alias_type" "country_alias_type" DEFAULT 'other' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "country_aliases_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "country_aliases_normalized_name_nonempty_check" CHECK (length(btrim("normalized_name")) > 0),
  CONSTRAINT "country_aliases_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "education_jurisdictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "country_id" uuid,
  "parent_id" uuid,
  "code" varchar(120),
  "name" text NOT NULL,
  "jurisdiction_type" "education_jurisdiction_type" NOT NULL,
  "source_record_id" uuid,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "education_jurisdictions_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "education_jurisdictions_not_self_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
  CONSTRAINT "education_jurisdictions_valid_period_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from"),
  CONSTRAINT "education_jurisdictions_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "education_jurisdictions_parent_id_education_jurisdictions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "education_jurisdictions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "education_systems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jurisdiction_id" uuid NOT NULL,
  "code" varchar(120),
  "name" text NOT NULL,
  "description" text,
  "source_record_id" uuid,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "education_systems_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "education_systems_valid_period_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from"),
  CONSTRAINT "education_systems_jurisdiction_id_education_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "education_systems_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "qualification_frameworks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jurisdiction_id" uuid NOT NULL,
  "education_system_id" uuid,
  "code" varchar(120),
  "name" text NOT NULL,
  "description" text,
  "source_record_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qualification_frameworks_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "qualification_frameworks_jurisdiction_id_education_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "qualification_frameworks_education_system_id_education_systems_id_fk" FOREIGN KEY ("education_system_id") REFERENCES "public"."education_systems"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "qualification_frameworks_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "qualification_framework_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "framework_id" uuid NOT NULL,
  "version_code" varchar(120) NOT NULL,
  "status" "qualification_framework_version_status" DEFAULT 'draft' NOT NULL,
  "source_record_id" uuid,
  "published_at" timestamp with time zone,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qualification_framework_versions_code_nonempty_check" CHECK (length(btrim("version_code")) > 0),
  CONSTRAINT "qualification_framework_versions_effective_period_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "qualification_framework_versions_framework_id_qualification_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."qualification_frameworks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "qualification_framework_versions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "qualification_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "framework_version_id" uuid NOT NULL,
  "parent_level_id" uuid,
  "code" varchar(120) NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "sequence" smallint,
  "descriptors" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "qualification_levels_not_self_parent_check" CHECK ("parent_level_id" IS NULL OR "parent_level_id" <> "id"),
  CONSTRAINT "qualification_levels_sequence_positive_check" CHECK ("sequence" IS NULL OR "sequence" > 0),
  CONSTRAINT "qualification_levels_label_nonempty_check" CHECK (length(btrim("label")) > 0),
  CONSTRAINT "qualification_levels_descriptors_object_check" CHECK (jsonb_typeof("descriptors") = 'object'),
  CONSTRAINT "qualification_levels_framework_version_id_qualification_framework_versions_id_fk" FOREIGN KEY ("framework_version_id") REFERENCES "public"."qualification_framework_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
);
--> statement-breakpoint
CREATE TABLE "classification_schemes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheme_code" varchar(100) NOT NULL,
  "name" text NOT NULL,
  "kind" "classification_scheme_kind" NOT NULL,
  "publisher" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "classification_schemes_code_nonempty_check" CHECK (length(btrim("scheme_code")) > 0),
  CONSTRAINT "classification_schemes_name_nonempty_check" CHECK (length(btrim("name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "classification_scheme_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheme_id" uuid NOT NULL,
  "version_code" varchar(120) NOT NULL,
  "source_url" text,
  "published_at" timestamp with time zone,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "classification_scheme_versions_code_nonempty_check" CHECK (length(btrim("version_code")) > 0),
  CONSTRAINT "classification_scheme_versions_effective_period_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "classification_scheme_versions_scheme_id_classification_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."classification_schemes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "classification_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scheme_version_id" uuid NOT NULL,
  "parent_code_id" uuid,
  "code" varchar(120) NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "depth" smallint,
  CONSTRAINT "classification_codes_not_self_parent_check" CHECK ("parent_code_id" IS NULL OR "parent_code_id" <> "id"),
  CONSTRAINT "classification_codes_depth_positive_check" CHECK ("depth" IS NULL OR "depth" > 0),
  CONSTRAINT "classification_codes_label_nonempty_check" CHECK (length(btrim("label")) > 0),
  CONSTRAINT "classification_codes_scheme_version_id_classification_scheme_versions_id_fk" FOREIGN KEY ("scheme_version_id") REFERENCES "public"."classification_scheme_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
);
--> statement-breakpoint
CREATE TABLE "qualification_level_classification_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "qualification_level_id" uuid NOT NULL,
  "classification_code_id" uuid NOT NULL,
  "mapping_kind" "qualification_classification_mapping_kind" NOT NULL,
  "status" "qualification_classification_mapping_status" DEFAULT 'proposed' NOT NULL,
  "rationale" text NOT NULL,
  "confidence" numeric(5, 4),
  "source_record_id" uuid,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qual_level_map_rationale_nonempty_chk" CHECK (length(btrim("rationale")) > 0),
  CONSTRAINT "qual_level_map_confidence_chk" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "qual_level_map_accepted_evidence_chk" CHECK ("status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "qualification_level_classification_mappings_qualification_level_id_qualification_levels_id_fk" FOREIGN KEY ("qualification_level_id") REFERENCES "public"."qualification_levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "qualification_level_classification_mappings_classification_code_id_classification_codes_id_fk" FOREIGN KEY ("classification_code_id") REFERENCES "public"."classification_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "qualification_level_classification_mappings_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "qualification_level_classification_mappings_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
--> statement-breakpoint
CREATE FUNCTION "public"."validate_qualification_level_classification_mapping_kind"()
RETURNS trigger
LANGUAGE plpgsql
AS $
DECLARE
  target_kind "public"."classification_scheme_kind";
BEGIN
  SELECT scheme."kind"
    INTO target_kind
    FROM "public"."classification_codes" AS code
    JOIN "public"."classification_scheme_versions" AS version
      ON version."id" = code."scheme_version_id"
    JOIN "public"."classification_schemes" AS scheme
      ON scheme."id" = version."scheme_id"
    WHERE code."id" = NEW."classification_code_id";

  IF (NEW."mapping_kind" = 'isced_p' AND target_kind <> 'programme')
     OR (NEW."mapping_kind" = 'isced_a' AND target_kind <> 'attainment') THEN
    RAISE EXCEPTION 'Mapping kind % cannot target a % classification scheme',
      NEW."mapping_kind", target_kind
      USING ERRCODE = '23514',
        CONSTRAINT = 'qual_level_map_scheme_kind_chk';
  END IF;

  RETURN NEW;
END;
$;
--> statement-breakpoint
CREATE TRIGGER "qualification_level_classification_mapping_kind_guard"
BEFORE INSERT OR UPDATE OF "classification_code_id", "mapping_kind"
ON "public"."qualification_level_classification_mappings"
FOR EACH ROW
EXECUTE FUNCTION "public"."validate_qualification_level_classification_mapping_kind"();
--> statement-breakpoint
CREATE TABLE "entity_source_assertions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_record_id" uuid NOT NULL,
  "institution_id" uuid,
  "jurisdiction_id" uuid,
  "qualification_framework_id" uuid,
  "qualification_level_id" uuid,
  "claim_key" varchar(120) NOT NULL,
  "claim_value" jsonb NOT NULL,
  "evidence_note" text,
  "status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entity_source_assertions_exactly_one_subject_check" CHECK (num_nonnulls("institution_id", "jurisdiction_id", "qualification_framework_id", "qualification_level_id") = 1),
  CONSTRAINT "entity_source_assertions_claim_key_nonempty_check" CHECK (length(btrim("claim_key")) > 0),
  CONSTRAINT "entity_source_assertions_valid_period_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from"),
  CONSTRAINT "entity_source_assertions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "entity_source_assertions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "entity_source_assertions_jurisdiction_id_education_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "entity_source_assertions_qualification_framework_id_qualification_frameworks_id_fk" FOREIGN KEY ("qualification_framework_id") REFERENCES "public"."qualification_frameworks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "entity_source_assertions_qualification_level_id_qualification_levels_id_fk" FOREIGN KEY ("qualification_level_id") REFERENCES "public"."qualification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "catalogue_review_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assertion_id" uuid NOT NULL,
  "reviewer_id" text,
  "action" "catalogue_review_action" NOT NULL,
  "previous_status" "catalogue_assertion_status",
  "new_status" "catalogue_assertion_status",
  "rationale" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "catalogue_review_events_status_change_check" CHECK ("previous_status" IS NULL OR "new_status" IS NULL OR "previous_status" <> "new_status"),
  CONSTRAINT "catalogue_review_events_assertion_id_entity_source_assertions_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."entity_source_assertions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "catalogue_review_events_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_sources_provider_key_unique" ON "catalogue_sources" USING btree ("provider_key");
--> statement-breakpoint
CREATE INDEX "catalogue_sources_status_idx" ON "catalogue_sources" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_source_records_provider_record_unique" ON "catalogue_source_records" USING btree ("source_id", "provider_record_id");
--> statement-breakpoint
CREATE INDEX "catalogue_source_records_source_retrieved_idx" ON "catalogue_source_records" USING btree ("source_id", "retrieved_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso_alpha_2_unique" ON "countries" USING btree ("iso_alpha_2");
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso_alpha_3_unique" ON "countries" USING btree ("iso_alpha_3");
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso_numeric_unique" ON "countries" USING btree ("iso_numeric");
--> statement-breakpoint
CREATE UNIQUE INDEX "country_aliases_country_normalized_language_unique" ON "country_aliases" USING btree ("country_id", "normalized_name", "language_tag");
--> statement-breakpoint
CREATE INDEX "country_aliases_normalized_name_idx" ON "country_aliases" USING btree ("normalized_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_jurisdictions_country_code_unique" ON "education_jurisdictions" USING btree ("country_id", "code");
--> statement-breakpoint
CREATE INDEX "education_jurisdictions_parent_idx" ON "education_jurisdictions" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX "education_jurisdictions_country_idx" ON "education_jurisdictions" USING btree ("country_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_systems_jurisdiction_code_unique" ON "education_systems" USING btree ("jurisdiction_id", "code");
--> statement-breakpoint
CREATE INDEX "education_systems_jurisdiction_idx" ON "education_systems" USING btree ("jurisdiction_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_frameworks_jurisdiction_code_unique" ON "qualification_frameworks" USING btree ("jurisdiction_id", "code");
--> statement-breakpoint
CREATE INDEX "qualification_frameworks_education_system_idx" ON "qualification_frameworks" USING btree ("education_system_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_framework_versions_framework_code_unique" ON "qualification_framework_versions" USING btree ("framework_id", "version_code");
--> statement-breakpoint
CREATE INDEX "qualification_framework_versions_status_idx" ON "qualification_framework_versions" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_levels_version_code_unique" ON "qualification_levels" USING btree ("framework_version_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_levels_id_version_unique" ON "qualification_levels" USING btree ("id", "framework_version_id");
--> statement-breakpoint
CREATE INDEX "qualification_levels_parent_idx" ON "qualification_levels" USING btree ("parent_level_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "classification_schemes_code_unique" ON "classification_schemes" USING btree ("scheme_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "classification_scheme_versions_scheme_code_unique" ON "classification_scheme_versions" USING btree ("scheme_id", "version_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "classification_codes_version_code_unique" ON "classification_codes" USING btree ("scheme_version_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX "classification_codes_id_version_unique" ON "classification_codes" USING btree ("id", "scheme_version_id");
--> statement-breakpoint
CREATE INDEX "classification_codes_parent_idx" ON "classification_codes" USING btree ("parent_code_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "qual_level_map_unique" ON "qualification_level_classification_mappings" USING btree ("qualification_level_id", "classification_code_id", "mapping_kind");
--> statement-breakpoint
CREATE INDEX "qual_level_map_status_idx" ON "qualification_level_classification_mappings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "entity_source_assertions_source_status_idx" ON "entity_source_assertions" USING btree ("source_record_id", "status");
--> statement-breakpoint
CREATE INDEX "entity_source_assertions_institution_idx" ON "entity_source_assertions" USING btree ("institution_id");
--> statement-breakpoint
CREATE INDEX "entity_source_assertions_jurisdiction_idx" ON "entity_source_assertions" USING btree ("jurisdiction_id");
--> statement-breakpoint
CREATE INDEX "catalogue_review_events_assertion_created_idx" ON "catalogue_review_events" USING btree ("assertion_id", "created_at");
--> statement-breakpoint
CREATE INDEX "catalogue_review_events_reviewer_created_idx" ON "catalogue_review_events" USING btree ("reviewer_id", "created_at");
--> statement-breakpoint
ALTER TABLE "qualification_levels"
  ADD CONSTRAINT "qualification_levels_parent_same_version_fk"
  FOREIGN KEY ("parent_level_id", "framework_version_id")
  REFERENCES "public"."qualification_levels"("id", "framework_version_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "classification_codes"
  ADD CONSTRAINT "classification_codes_parent_same_version_fk"
  FOREIGN KEY ("parent_code_id", "scheme_version_id")
  REFERENCES "public"."classification_codes"("id", "scheme_version_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
