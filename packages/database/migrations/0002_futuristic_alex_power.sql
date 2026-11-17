CREATE TYPE "public"."learning_intent" AS ENUM('learn_topic', 'understand_concept', 'solve_problem');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_concept_kind" AS ENUM('concept', 'skill');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_generation_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_relation_review_status" AS ENUM('proposed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_relation_type" AS ENUM('prerequisite', 'related', 'part_of');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_revision_status" AS ENUM('proposed', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_status" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tutor_message_role" AS ENUM('student', 'tutor');--> statement-breakpoint
CREATE TYPE "public"."tutor_session_state" AS ENUM('created', 'interpreting', 'needs_confirmation', 'ready', 'guiding', 'awaiting_attempt', 'explaining_why', 'evaluating_attempt', 'correcting_misconception', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "learning_plan_concept_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"source_concept_id" uuid NOT NULL,
	"target_concept_id" uuid NOT NULL,
	"relation_type" "learning_plan_relation_type" NOT NULL,
	"review_status" "learning_plan_relation_review_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "learning_plan_concept_relations_not_self_check" CHECK ("learning_plan_concept_relations"."source_concept_id" <> "learning_plan_concept_relations"."target_concept_id")
);
--> statement-breakpoint
CREATE TABLE "learning_plan_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"kind" "learning_plan_concept_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plan_concepts_position_positive_check" CHECK ("learning_plan_concepts"."position" > 0),
	CONSTRAINT "learning_plan_concepts_name_nonempty_check" CHECK (length(trim("learning_plan_concepts"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_plan_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plan_objectives_position_positive_check" CHECK ("learning_plan_objectives"."position" > 0),
	CONSTRAINT "learning_plan_objectives_statement_nonempty_check" CHECK (length(trim("learning_plan_objectives"."statement")) > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_plan_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source_input" text NOT NULL,
	"status" "learning_plan_revision_status" DEFAULT 'proposed' NOT NULL,
	"generation_provider" varchar(80),
	"generation_model" varchar(160),
	"prompt_version" varchar(80),
	"output_schema_version" varchar(80),
	"generated_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plan_revisions_number_positive_check" CHECK ("learning_plan_revisions"."revision_number" > 0),
	CONSTRAINT "learning_plan_revisions_title_nonempty_check" CHECK (length(trim("learning_plan_revisions"."title")) > 0),
	CONSTRAINT "learning_plan_revisions_source_input_nonempty_check" CHECK (length(trim("learning_plan_revisions"."source_input")) > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_plan_unit_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plan_unit_concepts_position_positive_check" CHECK ("learning_plan_unit_concepts"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_plan_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plan_units_position_positive_check" CHECK ("learning_plan_units"."position" > 0),
	CONSTRAINT "learning_plan_units_title_nonempty_check" CHECK (length(trim("learning_plan_units"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "learning_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"intent" "learning_intent" NOT NULL,
	"initial_input" text NOT NULL,
	"status" "learning_plan_status" DEFAULT 'draft' NOT NULL,
	"generation_status" "learning_plan_generation_status" DEFAULT 'pending' NOT NULL,
	"last_generation_error_code" varchar(80),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_plans_initial_input_nonempty_check" CHECK (length(trim("learning_plans"."initial_input")) > 0),
	CONSTRAINT "learning_plans_version_positive_check" CHECK ("learning_plans"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "tutor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "tutor_message_role" NOT NULL,
	"content" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"provider" varchar(80),
	"model" varchar(160),
	"prompt_version" varchar(80),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_messages_content_nonempty_check" CHECK (length(trim("tutor_messages"."content")) > 0),
	CONSTRAINT "tutor_messages_sequence_positive_check" CHECK ("tutor_messages"."sequence_number" > 0),
	CONSTRAINT "tutor_messages_tutor_provenance_check" CHECK ("tutor_messages"."role" <> 'tutor' or ("tutor_messages"."provider" is not null and "tutor_messages"."model" is not null and "tutor_messages"."prompt_version" is not null))
);
--> statement-breakpoint
CREATE TABLE "tutor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"learning_plan_revision_id" uuid,
	"learning_plan_unit_id" uuid,
	"intent" "learning_intent" NOT NULL,
	"initial_prompt" text NOT NULL,
	"state" "tutor_session_state" DEFAULT 'created' NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tutor_sessions_prompt_nonempty_check" CHECK (length(trim("tutor_sessions"."initial_prompt")) > 0),
	CONSTRAINT "tutor_sessions_step_index_nonnegative_check" CHECK ("tutor_sessions"."current_step_index" >= 0),
	CONSTRAINT "tutor_sessions_version_positive_check" CHECK ("tutor_sessions"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_concepts_revision_id_unique" ON "learning_plan_concepts" USING btree ("revision_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_units_revision_id_unique" ON "learning_plan_units" USING btree ("revision_id","id");--> statement-breakpoint
ALTER TABLE "learning_plan_concept_relations" ADD CONSTRAINT "learning_plan_concept_relations_source_revision_fk" FOREIGN KEY ("revision_id","source_concept_id") REFERENCES "public"."learning_plan_concepts"("revision_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_concept_relations" ADD CONSTRAINT "learning_plan_concept_relations_target_revision_fk" FOREIGN KEY ("revision_id","target_concept_id") REFERENCES "public"."learning_plan_concepts"("revision_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_concepts" ADD CONSTRAINT "learning_plan_concepts_revision_id_learning_plan_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."learning_plan_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_objectives" ADD CONSTRAINT "learning_plan_objectives_unit_id_learning_plan_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."learning_plan_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_revisions" ADD CONSTRAINT "learning_plan_revisions_learning_plan_id_learning_plans_id_fk" FOREIGN KEY ("learning_plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_unit_concepts" ADD CONSTRAINT "learning_plan_unit_concepts_unit_revision_fk" FOREIGN KEY ("revision_id","unit_id") REFERENCES "public"."learning_plan_units"("revision_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_unit_concepts" ADD CONSTRAINT "learning_plan_unit_concepts_concept_revision_fk" FOREIGN KEY ("revision_id","concept_id") REFERENCES "public"."learning_plan_concepts"("revision_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_units" ADD CONSTRAINT "learning_plan_units_revision_id_learning_plan_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."learning_plan_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_messages" ADD CONSTRAINT "tutor_messages_session_id_tutor_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutor_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_learning_plan_revision_id_learning_plan_revisions_id_fk" FOREIGN KEY ("learning_plan_revision_id") REFERENCES "public"."learning_plan_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_learning_plan_unit_id_learning_plan_units_id_fk" FOREIGN KEY ("learning_plan_unit_id") REFERENCES "public"."learning_plan_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_concept_relations_unique" ON "learning_plan_concept_relations" USING btree ("revision_id","source_concept_id","target_concept_id","relation_type");--> statement-breakpoint
CREATE INDEX "learning_plan_concept_relations_revision_status_idx" ON "learning_plan_concept_relations" USING btree ("revision_id","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_concepts_revision_position_unique" ON "learning_plan_concepts" USING btree ("revision_id","position");--> statement-breakpoint
CREATE INDEX "learning_plan_concepts_revision_idx" ON "learning_plan_concepts" USING btree ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_objectives_unit_position_unique" ON "learning_plan_objectives" USING btree ("unit_id","position");--> statement-breakpoint
CREATE INDEX "learning_plan_objectives_unit_idx" ON "learning_plan_objectives" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_revisions_plan_number_unique" ON "learning_plan_revisions" USING btree ("learning_plan_id","revision_number");--> statement-breakpoint
CREATE INDEX "learning_plan_revisions_plan_status_idx" ON "learning_plan_revisions" USING btree ("learning_plan_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_unit_concepts_unit_concept_unique" ON "learning_plan_unit_concepts" USING btree ("unit_id","concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_unit_concepts_unit_position_unique" ON "learning_plan_unit_concepts" USING btree ("unit_id","position");--> statement-breakpoint
CREATE INDEX "learning_plan_unit_concepts_concept_idx" ON "learning_plan_unit_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plan_units_revision_position_unique" ON "learning_plan_units" USING btree ("revision_id","position");--> statement-breakpoint
CREATE INDEX "learning_plan_units_revision_idx" ON "learning_plan_units" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "learning_plans_student_status_updated_idx" ON "learning_plans" USING btree ("student_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_messages_session_sequence_unique" ON "tutor_messages" USING btree ("session_id","sequence_number");--> statement-breakpoint
CREATE INDEX "tutor_messages_session_created_idx" ON "tutor_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "tutor_sessions_student_state_updated_idx" ON "tutor_sessions" USING btree ("student_id","state","updated_at");--> statement-breakpoint
CREATE INDEX "tutor_sessions_plan_revision_idx" ON "tutor_sessions" USING btree ("learning_plan_revision_id");--> statement-breakpoint
CREATE INDEX "tutor_sessions_plan_unit_idx" ON "tutor_sessions" USING btree ("learning_plan_unit_id");