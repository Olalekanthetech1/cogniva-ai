CREATE TYPE "public"."institution_identifier_kind" AS ENUM('registry', 'official', 'provider', 'legacy', 'other');
--> statement-breakpoint
CREATE TYPE "public"."institution_alias_kind" AS ENUM('official', 'former', 'local', 'transliteration', 'abbreviation', 'source_name', 'other');
--> statement-breakpoint
CREATE TYPE "public"."institution_unit_type" AS ENUM('campus', 'school', 'college', 'faculty', 'department', 'institute', 'centre', 'division', 'research_centre', 'other');
--> statement-breakpoint
CREATE TYPE "public"."recognition_scope_kind" AS ENUM('institution', 'institution_unit', 'programme', 'qualification', 'delivery_mode');
--> statement-breakpoint
CREATE TYPE "public"."recognition_decision_status" AS ENUM('recognised', 'accredited', 'provisionally_recognised', 'not_recognised', 'suspended', 'withdrawn');
--> statement-breakpoint
CREATE TYPE "public"."recognition_review_status" AS ENUM('unreviewed', 'under_review', 'accepted', 'disputed', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."academic_programme_type" AS ENUM('degree', 'diploma', 'certificate', 'professional', 'vocational', 'foundation', 'other');
--> statement-breakpoint
CREATE TYPE "public"."programme_version_status" AS ENUM('draft', 'published', 'superseded', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."academic_period_kind" AS ENUM('academic_year', 'semester', 'trimester', 'quarter', 'term', 'session', 'other');
--> statement-breakpoint
CREATE TYPE "public"."credit_system_status" AS ENUM('active', 'inactive', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."programme_course_requirement_kind" AS ENUM('core', 'elective', 'optional', 'capstone', 'prerequisite', 'other');
--> statement-breakpoint
CREATE TYPE "public"."course_content_version_status" AS ENUM('draft', 'published', 'superseded', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."knowledge_component_kind" AS ENUM('concept', 'skill', 'procedure', 'principle', 'strategy', 'model', 'misconception', 'other');
--> statement-breakpoint
CREATE TYPE "public"."knowledge_component_status" AS ENUM('draft', 'active', 'deprecated');
--> statement-breakpoint
CREATE TYPE "public"."knowledge_component_version_status" AS ENUM('draft', 'active', 'superseded', 'withdrawn');
--> statement-breakpoint
CREATE TYPE "public"."knowledge_component_relation_kind" AS ENUM('prerequisite', 'part_of', 'related_to', 'progression', 'contrasts_with');
--> statement-breakpoint
CREATE TYPE "public"."knowledge_component_relation_review_status" AS ENUM('proposed', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."course_knowledge_mapping_kind" AS ENUM('taught', 'practised', 'assessed', 'required', 'learning_outcome');
--> statement-breakpoint
CREATE TYPE "public"."course_knowledge_mapping_status" AS ENUM('proposed', 'under_review', 'accepted', 'rejected');
--> statement-breakpoint
CREATE TABLE "institution_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "provider_namespace" varchar(120) NOT NULL,
  "identifier" varchar(240) NOT NULL,
  "identifier_kind" "institution_identifier_kind" DEFAULT 'provider' NOT NULL,
  "identifier_uri" text,
  "source_record_id" uuid NOT NULL,
  "review_status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_identifiers_namespace_nonempty_check" CHECK (length(btrim("provider_namespace")) > 0),
  CONSTRAINT "institution_identifiers_value_nonempty_check" CHECK (length(btrim("identifier")) > 0),
  CONSTRAINT "institution_identifiers_review_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "institution_identifiers_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "institution_identifiers_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "institution_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "language_tag" varchar(35) DEFAULT 'und' NOT NULL,
  "alias_kind" "institution_alias_kind" DEFAULT 'other' NOT NULL,
  "source_record_id" uuid NOT NULL,
  "review_status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_aliases_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "institution_aliases_normalized_name_nonempty_check" CHECK (length(btrim("normalized_name")) > 0),
  CONSTRAINT "institution_aliases_review_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "institution_aliases_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "institution_aliases_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "institution_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "parent_unit_id" uuid,
  "unit_type" "institution_unit_type" NOT NULL,
  "code" varchar(120),
  "slug" varchar(140),
  "name" text NOT NULL,
  "source_record_id" uuid NOT NULL,
  "review_status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_units_not_self_parent_check" CHECK ("parent_unit_id" IS NULL OR "parent_unit_id" <> "id"),
  CONSTRAINT "institution_units_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "institution_units_valid_period_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" > "valid_from"),
  CONSTRAINT "institution_units_review_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "institution_units_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "institution_units_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "recognition_authorities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jurisdiction_id" uuid NOT NULL,
  "authority_code" varchar(120),
  "name" text NOT NULL,
  "authority_type" varchar(80) NOT NULL,
  "website_url" text,
  "source_record_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recognition_authorities_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "recognition_authorities_type_nonempty_check" CHECK (length(btrim("authority_type")) > 0),
  CONSTRAINT "recognition_authorities_jurisdiction_id_education_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_authorities_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "academic_programmes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "institution_unit_id" uuid,
  "programme_code" varchar(120),
  "slug" varchar(160) NOT NULL,
  "name" text NOT NULL,
  "programme_type" "academic_programme_type" DEFAULT 'other' NOT NULL,
  "description" text,
  "source_record_id" uuid NOT NULL,
  "review_status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "academic_programmes_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "academic_programmes_slug_nonempty_check" CHECK (length(btrim("slug")) > 0),
  CONSTRAINT "academic_programmes_review_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "academic_programmes_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "academic_programmes_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "programme_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "programme_id" uuid NOT NULL,
  "institution_id" uuid NOT NULL,
  "version_code" varchar(120) NOT NULL,
  "title" text NOT NULL,
  "award_title" text,
  "status" "programme_version_status" DEFAULT 'draft' NOT NULL,
  "minimum_duration_months" smallint,
  "maximum_duration_months" smallint,
  "source_record_id" uuid,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "programme_versions_title_nonempty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "programme_versions_duration_check" CHECK ("minimum_duration_months" IS NULL OR "maximum_duration_months" IS NULL OR "maximum_duration_months" >= "minimum_duration_months"),
  CONSTRAINT "programme_versions_effective_period_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "programme_versions_published_evidence_check" CHECK ("status" <> 'published' OR ("source_record_id" IS NOT NULL AND "published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "programme_versions"
  ADD CONSTRAINT "programme_versions_source_record_id_catalogue_source_records_id_fk"
  FOREIGN KEY ("source_record_id")
  REFERENCES "public"."catalogue_source_records"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE TABLE "programme_qualifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "programme_version_id" uuid NOT NULL,
  "qualification_level_id" uuid NOT NULL,
  "award_title" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "source_record_id" uuid NOT NULL,
  "review_status" "catalogue_assertion_status" DEFAULT 'unreviewed' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "rationale" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "programme_qualifications_rationale_nonempty_check" CHECK (length(btrim("rationale")) > 0),
  CONSTRAINT "programme_qualifications_review_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "programme_qualifications_programme_version_id_programme_versions_id_fk" FOREIGN KEY ("programme_version_id") REFERENCES "public"."programme_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "programme_qualifications_qualification_level_id_qualification_levels_id_fk" FOREIGN KEY ("qualification_level_id") REFERENCES "public"."qualification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "programme_qualifications_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "recognition_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "authority_id" uuid NOT NULL,
  "scope_kind" "recognition_scope_kind" NOT NULL,
  "decision_status" "recognition_decision_status" NOT NULL,
  "review_status" "recognition_review_status" DEFAULT 'unreviewed' NOT NULL,
  "institution_id" uuid,
  "institution_unit_id" uuid,
  "programme_version_id" uuid,
  "qualification_level_id" uuid,
  "delivery_mode" varchar(80),
  "decision_reference" varchar(160),
  "source_record_id" uuid NOT NULL,
  "rationale" text,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recognition_decisions_exactly_one_subject_check" CHECK (num_nonnulls("institution_id", "institution_unit_id", "programme_version_id", "qualification_level_id") = 1),
  CONSTRAINT "recognition_decisions_scope_subject_check" CHECK (("scope_kind" = 'institution' AND "institution_id" IS NOT NULL AND "delivery_mode" IS NULL) OR ("scope_kind" = 'institution_unit' AND "institution_unit_id" IS NOT NULL AND "delivery_mode" IS NULL) OR ("scope_kind" = 'programme' AND "programme_version_id" IS NOT NULL AND "delivery_mode" IS NULL) OR ("scope_kind" = 'qualification' AND "qualification_level_id" IS NOT NULL AND "delivery_mode" IS NULL) OR ("scope_kind" = 'delivery_mode' AND "programme_version_id" IS NOT NULL AND length(btrim(coalesce("delivery_mode", ''))) > 0)),
  CONSTRAINT "recognition_decisions_accepted_review_check" CHECK ("review_status" <> 'accepted' OR "reviewed_at" IS NOT NULL),
  CONSTRAINT "recognition_decisions_validity_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "recognition_decisions_authority_id_recognition_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."recognition_authorities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_decisions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_decisions_institution_unit_id_institution_units_id_fk" FOREIGN KEY ("institution_unit_id") REFERENCES "public"."institution_units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_decisions_programme_version_id_programme_versions_id_fk" FOREIGN KEY ("programme_version_id") REFERENCES "public"."programme_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_decisions_qualification_level_id_qualification_levels_id_fk" FOREIGN KEY ("qualification_level_id") REFERENCES "public"."qualification_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "recognition_decisions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "credit_systems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jurisdiction_id" uuid NOT NULL,
  "institution_id" uuid,
  "code" varchar(120) NOT NULL,
  "name" text NOT NULL,
  "unit_name" text NOT NULL,
  "symbol" varchar(24),
  "decimal_places" smallint DEFAULT 2 NOT NULL,
  "description" text,
  "status" "credit_system_status" DEFAULT 'active' NOT NULL,
  "source_record_id" uuid NOT NULL,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "credit_systems_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "credit_systems_unit_name_nonempty_check" CHECK (length(btrim("unit_name")) > 0),
  CONSTRAINT "credit_systems_decimal_places_check" CHECK ("decimal_places" BETWEEN 0 AND 6),
  CONSTRAINT "credit_systems_validity_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "credit_systems_jurisdiction_id_education_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."education_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "credit_systems_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "credit_systems_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "academic_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "parent_period_id" uuid,
  "code" varchar(120),
  "name" text NOT NULL,
  "period_kind" "academic_period_kind" NOT NULL,
  "starts_on" date,
  "ends_on" date,
  "source_record_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "academic_periods_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "academic_periods_validity_check" CHECK ("ends_on" IS NULL OR "starts_on" IS NULL OR "ends_on" > "starts_on"),
  CONSTRAINT "academic_periods_not_self_parent_check" CHECK ("parent_period_id" IS NULL OR "parent_period_id" <> "id"),
  CONSTRAINT "academic_periods_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "academic_periods_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "course_content_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "legacy_curriculum_version_id" uuid,
  "version_code" varchar(120) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "source_url" text,
  "content_hash" varchar(160),
  "source_record_id" uuid,
  "status" "course_content_version_status" DEFAULT 'draft' NOT NULL,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "course_content_versions_title_nonempty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "course_content_versions_validity_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "course_content_versions_published_evidence_check" CHECK ("status" <> 'published' OR ("source_record_id" IS NOT NULL AND "published_at" IS NOT NULL)),
  CONSTRAINT "course_content_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "course_content_versions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "programme_course_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "programme_version_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "course_content_version_id" uuid,
  "academic_period_id" uuid,
  "requirement_kind" "programme_course_requirement_kind" NOT NULL,
  "local_stage_label" varchar(120),
  "local_stage_index" smallint,
  "credit_value" numeric(8, 3),
  "credit_system_id" uuid,
  "position" integer NOT NULL,
  "requirement_group" varchar(120),
  "description" text,
  "source_record_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "programme_course_requirements_position_positive_check" CHECK ("position" > 0),
  CONSTRAINT "programme_course_requirements_stage_positive_check" CHECK ("local_stage_index" IS NULL OR "local_stage_index" > 0),
  CONSTRAINT "programme_course_requirements_credit_pair_check" CHECK (("credit_value" IS NULL AND "credit_system_id" IS NULL) OR ("credit_value" IS NOT NULL AND "credit_system_id" IS NOT NULL AND "credit_value" >= 0)),
  CONSTRAINT "programme_course_requirements_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "programme_course_requirements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "programme_course_requirements_credit_system_id_credit_systems_id_fk" FOREIGN KEY ("credit_system_id") REFERENCES "public"."credit_systems"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "programme_course_requirements_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "knowledge_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(160) NOT NULL,
  "kind" "knowledge_component_kind" NOT NULL,
  "status" "knowledge_component_status" DEFAULT 'draft' NOT NULL,
  "domain_key" varchar(120),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_components_slug_nonempty_check" CHECK (length(btrim("slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "knowledge_component_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "knowledge_component_id" uuid NOT NULL,
  "version_code" varchar(80) NOT NULL,
  "name" text NOT NULL,
  "definition" text NOT NULL,
  "learning_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_record_id" uuid,
  "reviewed_at" timestamp with time zone,
  "status" "knowledge_component_version_status" DEFAULT 'draft' NOT NULL,
  "effective_from" timestamp with time zone,
  "effective_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_component_versions_name_nonempty_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "knowledge_component_versions_definition_nonempty_check" CHECK (length(btrim("definition")) > 0),
  CONSTRAINT "knowledge_component_versions_objectives_array_check" CHECK (jsonb_typeof("learning_objectives") = 'array'),
  CONSTRAINT "knowledge_component_versions_validity_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "knowledge_component_versions_active_evidence_check" CHECK ("status" <> 'active' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "knowledge_component_versions_knowledge_component_id_knowledge_components_id_fk" FOREIGN KEY ("knowledge_component_id") REFERENCES "public"."knowledge_components"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "knowledge_component_versions_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "knowledge_component_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_version_id" uuid NOT NULL,
  "target_version_id" uuid NOT NULL,
  "relation_kind" "knowledge_component_relation_kind" NOT NULL,
  "review_status" "knowledge_component_relation_review_status" DEFAULT 'proposed' NOT NULL,
  "rationale" text NOT NULL,
  "confidence" numeric(5, 4),
  "source_record_id" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_component_relations_not_self_check" CHECK ("source_version_id" <> "target_version_id"),
  CONSTRAINT "knowledge_component_relations_rationale_nonempty_check" CHECK (length(btrim("rationale")) > 0),
  CONSTRAINT "knowledge_component_relations_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "knowledge_component_relations_accepted_evidence_check" CHECK ("review_status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "knowledge_component_relations_source_version_id_knowledge_component_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."knowledge_component_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "knowledge_component_relations_target_version_id_knowledge_component_versions_id_fk" FOREIGN KEY ("target_version_id") REFERENCES "public"."knowledge_component_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "knowledge_component_relations_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "course_knowledge_component_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_content_version_id" uuid NOT NULL,
  "knowledge_component_version_id" uuid NOT NULL,
  "mapping_kind" "course_knowledge_mapping_kind" NOT NULL,
  "status" "course_knowledge_mapping_status" DEFAULT 'proposed' NOT NULL,
  "mapping_method" varchar(80) NOT NULL,
  "rationale" text NOT NULL,
  "confidence" numeric(5, 4),
  "source_record_id" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "course_knowledge_component_mappings_rationale_nonempty_check" CHECK (length(btrim("rationale")) > 0),
  CONSTRAINT "course_knowledge_component_mappings_method_nonempty_check" CHECK (length(btrim("mapping_method")) > 0),
  CONSTRAINT "course_knowledge_component_mappings_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "course_knowledge_component_mappings_accepted_evidence_check" CHECK ("status" <> 'accepted' OR ("source_record_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "course_knowledge_component_mappings_course_content_version_id_course_content_versions_id_fk" FOREIGN KEY ("course_content_version_id") REFERENCES "public"."course_content_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "course_knowledge_component_mappings_knowledge_component_version_id_knowledge_component_versions_id_fk" FOREIGN KEY ("knowledge_component_version_id") REFERENCES "public"."knowledge_component_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "course_knowledge_component_mappings_source_record_id_catalogue_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."catalogue_source_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_identifiers_namespace_identifier_unique" ON "institution_identifiers" USING btree ("provider_namespace", "identifier");
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_identifiers_institution_namespace_unique" ON "institution_identifiers" USING btree ("institution_id", "provider_namespace", "identifier");
--> statement-breakpoint
CREATE INDEX "institution_identifiers_institution_idx" ON "institution_identifiers" USING btree ("institution_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_aliases_institution_name_language_unique" ON "institution_aliases" USING btree ("institution_id", "normalized_name", "language_tag");
--> statement-breakpoint
CREATE INDEX "institution_aliases_normalized_name_idx" ON "institution_aliases" USING btree ("normalized_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_units_id_institution_unique" ON "institution_units" USING btree ("id", "institution_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "institution_units_institution_slug_unique" ON "institution_units" USING btree ("institution_id", "slug");
--> statement-breakpoint
CREATE INDEX "institution_units_parent_idx" ON "institution_units" USING btree ("parent_unit_id");
--> statement-breakpoint
CREATE INDEX "institution_units_institution_type_idx" ON "institution_units" USING btree ("institution_id", "unit_type");
--> statement-breakpoint
ALTER TABLE "institution_units" ADD CONSTRAINT "institution_units_parent_same_institution_fk" FOREIGN KEY ("parent_unit_id", "institution_id") REFERENCES "public"."institution_units"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "recognition_authorities_jurisdiction_code_unique" ON "recognition_authorities" USING btree ("jurisdiction_id", "authority_code");
--> statement-breakpoint
CREATE INDEX "recognition_authorities_jurisdiction_idx" ON "recognition_authorities" USING btree ("jurisdiction_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_programmes_id_institution_unique" ON "academic_programmes" USING btree ("id", "institution_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_programmes_institution_slug_unique" ON "academic_programmes" USING btree ("institution_id", "slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_programmes_institution_code_unique" ON "academic_programmes" USING btree ("institution_id", "programme_code");
--> statement-breakpoint
CREATE INDEX "academic_programmes_institution_idx" ON "academic_programmes" USING btree ("institution_id");
--> statement-breakpoint
CREATE INDEX "academic_programmes_unit_idx" ON "academic_programmes" USING btree ("institution_unit_id");
--> statement-breakpoint
ALTER TABLE "academic_programmes" ADD CONSTRAINT "academic_programmes_unit_same_institution_fk" FOREIGN KEY ("institution_unit_id", "institution_id") REFERENCES "public"."institution_units"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "programme_versions_programme_code_unique" ON "programme_versions" USING btree ("programme_id", "version_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "programme_versions_id_programme_unique" ON "programme_versions" USING btree ("id", "programme_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "programme_versions_id_institution_unique" ON "programme_versions" USING btree ("id", "institution_id");
--> statement-breakpoint
CREATE INDEX "programme_versions_programme_status_idx" ON "programme_versions" USING btree ("programme_id", "status");
--> statement-breakpoint
ALTER TABLE "programme_versions" ADD CONSTRAINT "programme_versions_programme_same_institution_fk" FOREIGN KEY ("programme_id", "institution_id") REFERENCES "public"."academic_programmes"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "programme_qualifications_version_level_unique" ON "programme_qualifications" USING btree ("programme_version_id", "qualification_level_id");
--> statement-breakpoint
CREATE INDEX "programme_qualifications_level_idx" ON "programme_qualifications" USING btree ("qualification_level_id");
--> statement-breakpoint
CREATE INDEX "recognition_decisions_authority_status_idx" ON "recognition_decisions" USING btree ("authority_id", "review_status");
--> statement-breakpoint
CREATE INDEX "recognition_decisions_institution_idx" ON "recognition_decisions" USING btree ("institution_id");
--> statement-breakpoint
CREATE INDEX "recognition_decisions_programme_idx" ON "recognition_decisions" USING btree ("programme_version_id");
--> statement-breakpoint
CREATE INDEX "recognition_decisions_validity_idx" ON "recognition_decisions" USING btree ("effective_from", "effective_to");
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_systems_jurisdiction_code_unique" ON "credit_systems" USING btree ("jurisdiction_id", "code");
--> statement-breakpoint
CREATE INDEX "credit_systems_institution_idx" ON "credit_systems" USING btree ("institution_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_periods_id_institution_unique" ON "academic_periods" USING btree ("id", "institution_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_periods_institution_code_unique" ON "academic_periods" USING btree ("institution_id", "code");
--> statement-breakpoint
CREATE INDEX "academic_periods_institution_dates_idx" ON "academic_periods" USING btree ("institution_id", "starts_on", "ends_on");
--> statement-breakpoint
ALTER TABLE "academic_periods" ADD CONSTRAINT "academic_periods_parent_same_institution_fk" FOREIGN KEY ("parent_period_id", "institution_id") REFERENCES "public"."academic_periods"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "course_content_versions_course_code_unique" ON "course_content_versions" USING btree ("course_id", "version_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_content_versions_id_course_unique" ON "course_content_versions" USING btree ("id", "course_id");
--> statement-breakpoint
CREATE INDEX "course_content_versions_course_status_idx" ON "course_content_versions" USING btree ("course_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX "programme_course_requirements_unique" ON "programme_course_requirements" USING btree ("programme_version_id", "course_id", "requirement_kind", "local_stage_index");
--> statement-breakpoint
CREATE INDEX "programme_course_requirements_course_idx" ON "programme_course_requirements" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "programme_course_requirements_period_idx" ON "programme_course_requirements" USING btree ("academic_period_id");
--> statement-breakpoint
ALTER TABLE "programme_course_requirements" ADD CONSTRAINT "programme_course_requirements_programme_same_institution_fk" FOREIGN KEY ("programme_version_id", "institution_id") REFERENCES "public"."programme_versions"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "programme_course_requirements" ADD CONSTRAINT "programme_course_requirements_period_same_institution_fk" FOREIGN KEY ("academic_period_id", "institution_id") REFERENCES "public"."academic_periods"("id", "institution_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "programme_course_requirements" ADD CONSTRAINT "programme_course_requirements_content_course_fk" FOREIGN KEY ("course_content_version_id", "course_id") REFERENCES "public"."course_content_versions"("id", "course_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_components_slug_unique" ON "knowledge_components" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_component_versions_component_code_unique" ON "knowledge_component_versions" USING btree ("knowledge_component_id", "version_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_component_versions_id_component_unique" ON "knowledge_component_versions" USING btree ("id", "knowledge_component_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_component_relations_unique" ON "knowledge_component_relations" USING btree ("source_version_id", "target_version_id", "relation_kind");
--> statement-breakpoint
CREATE INDEX "knowledge_component_relations_source_status_idx" ON "knowledge_component_relations" USING btree ("source_version_id", "review_status");
--> statement-breakpoint
CREATE INDEX "knowledge_component_relations_target_idx" ON "knowledge_component_relations" USING btree ("target_version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_knowledge_component_mappings_unique" ON "course_knowledge_component_mappings" USING btree ("course_content_version_id", "knowledge_component_version_id", "mapping_kind");
--> statement-breakpoint
CREATE INDEX "course_knowledge_component_mappings_status_idx" ON "course_knowledge_component_mappings" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_versions_id_course_unique" ON "curriculum_versions" USING btree ("id", "course_id");
--> statement-breakpoint
ALTER TABLE "course_content_versions" ADD CONSTRAINT "course_content_versions_legacy_curriculum_course_fk" FOREIGN KEY ("legacy_curriculum_version_id", "course_id") REFERENCES "public"."curriculum_versions"("id", "course_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions"
  ADD COLUMN "institution_unit_id" uuid,
  ADD COLUMN "recognition_authority_id" uuid,
  ADD COLUMN "recognition_decision_id" uuid,
  ADD COLUMN "academic_programme_id" uuid,
  ADD COLUMN "programme_version_id" uuid,
  ADD COLUMN "academic_period_id" uuid,
  ADD COLUMN "credit_system_id" uuid,
  ADD COLUMN "course_id" uuid,
  ADD COLUMN "curriculum_version_id" uuid,
  ADD COLUMN "course_content_version_id" uuid,
  ADD COLUMN "knowledge_component_id" uuid,
  ADD COLUMN "knowledge_component_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" DROP CONSTRAINT "entity_source_assertions_exactly_one_subject_check";
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_exactly_one_subject_check" CHECK (
  num_nonnulls(
    "country_id", "institution_id", "jurisdiction_id", "qualification_framework_id", "qualification_level_id",
    "institution_unit_id", "recognition_authority_id", "recognition_decision_id", "academic_programme_id", "programme_version_id",
    "academic_period_id", "credit_system_id", "course_id", "curriculum_version_id", "course_content_version_id",
    "knowledge_component_id", "knowledge_component_version_id"
  ) = 1
);
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_institution_unit_fk" FOREIGN KEY ("institution_unit_id") REFERENCES "public"."institution_units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_recognition_authority_fk" FOREIGN KEY ("recognition_authority_id") REFERENCES "public"."recognition_authorities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_recognition_decision_fk" FOREIGN KEY ("recognition_decision_id") REFERENCES "public"."recognition_decisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_academic_programme_fk" FOREIGN KEY ("academic_programme_id") REFERENCES "public"."academic_programmes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_programme_version_fk" FOREIGN KEY ("programme_version_id") REFERENCES "public"."programme_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_academic_period_fk" FOREIGN KEY ("academic_period_id") REFERENCES "public"."academic_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_credit_system_fk" FOREIGN KEY ("credit_system_id") REFERENCES "public"."credit_systems"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_course_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_curriculum_version_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_course_content_version_fk" FOREIGN KEY ("course_content_version_id") REFERENCES "public"."course_content_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_knowledge_component_fk" FOREIGN KEY ("knowledge_component_id") REFERENCES "public"."knowledge_components"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "entity_source_assertions" ADD CONSTRAINT "entity_source_assertions_knowledge_component_version_fk" FOREIGN KEY ("knowledge_component_version_id") REFERENCES "public"."knowledge_component_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE FUNCTION "public"."guard_knowledge_component_prerequisite_cycle"()
RETURNS trigger
LANGUAGE plpgsql
AS '
DECLARE
  source_component uuid;
  target_component uuid;
BEGIN
  IF NEW."relation_kind" = ''prerequisite'' AND NEW."review_status" = ''accepted'' THEN
    SELECT "knowledge_component_id" INTO source_component
      FROM "public"."knowledge_component_versions" WHERE "id" = NEW."source_version_id";
    SELECT "knowledge_component_id" INTO target_component
      FROM "public"."knowledge_component_versions" WHERE "id" = NEW."target_version_id";

    IF source_component = target_component THEN
      RAISE EXCEPTION ''A Knowledge Component cannot be its own prerequisite''
        USING ERRCODE = ''23514'', CONSTRAINT = ''knowledge_component_prerequisite_cycle_check'';
    END IF;

    IF EXISTS (
      WITH RECURSIVE reachable(version_id) AS (
        SELECT "target_version_id"
        FROM "public"."knowledge_component_relations"
        WHERE "source_version_id" = NEW."target_version_id"
          AND "relation_kind" = ''prerequisite''
          AND "review_status" = ''accepted''
          AND ("id" IS DISTINCT FROM NEW."id")
        UNION
        SELECT relation."target_version_id"
        FROM "public"."knowledge_component_relations" AS relation
        JOIN reachable ON relation."source_version_id" = reachable.version_id
        WHERE relation."relation_kind" = ''prerequisite''
          AND relation."review_status" = ''accepted''
          AND relation."id" IS DISTINCT FROM NEW."id"
      )
      SELECT 1 FROM reachable WHERE version_id = NEW."source_version_id"
    ) THEN
      RAISE EXCEPTION ''Accepted prerequisite relationships must remain acyclic''
        USING ERRCODE = ''23514'', CONSTRAINT = ''knowledge_component_prerequisite_cycle_check'';
    END IF;
  END IF;
  RETURN NEW;
END;
';
--> statement-breakpoint
CREATE TRIGGER "knowledge_component_prerequisite_cycle_guard"
BEFORE INSERT OR UPDATE OF "source_version_id", "target_version_id", "relation_kind", "review_status"
ON "public"."knowledge_component_relations"
FOR EACH ROW
EXECUTE FUNCTION "public"."guard_knowledge_component_prerequisite_cycle"();
--> statement-breakpoint
CREATE FUNCTION "public"."guard_programme_course_requirement_institution"()
RETURNS trigger
LANGUAGE plpgsql
AS '
DECLARE
  course_institution uuid;
BEGIN
  SELECT "institution_id"
    INTO course_institution
    FROM "public"."courses"
    WHERE "id" = NEW."course_id";

  IF course_institution IS NOT NULL AND course_institution <> NEW."institution_id" THEN
    RAISE EXCEPTION ''A programme requirement course must belong to the programme institution when the course has an institution assignment''
      USING ERRCODE = ''23514'', CONSTRAINT = ''programme_course_requirement_course_institution_check'';
  END IF;

  RETURN NEW;
END;
';
--> statement-breakpoint
CREATE TRIGGER "programme_course_requirement_institution_guard"
BEFORE INSERT OR UPDATE OF "institution_id", "course_id"
ON "public"."programme_course_requirements"
FOR EACH ROW
EXECUTE FUNCTION "public"."guard_programme_course_requirement_institution"();
