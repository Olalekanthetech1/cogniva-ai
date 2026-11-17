CREATE TYPE "public"."curriculum_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "course_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_version_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_topics_position_positive_check" CHECK ("course_topics"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"department_id" uuid,
	"subject_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"level" smallint,
	"credit_units" numeric(4, 1),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_level_positive_check" CHECK ("courses"."level" is null or ("courses"."level" >= 1 and "courses"."level" <= 12))
);
--> statement-breakpoint
CREATE TABLE "curriculum_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"version_label" varchar(60) NOT NULL,
	"status" "curriculum_version_status" DEFAULT 'draft' NOT NULL,
	"source_reference" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faculty_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"country_code" varchar(2),
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"institution_id" uuid,
	"faculty_id" uuid,
	"department_id" uuid,
	"programme" text,
	"year_of_study" smallint,
	"locale" varchar(20) DEFAULT 'en' NOT NULL,
	"time_zone" varchar(80),
	"learning_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_year_of_study_check" CHECK ("student_profiles"."year_of_study" is null or ("student_profiles"."year_of_study" >= 1 and "student_profiles"."year_of_study" <= 12))
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"parent_topic_id" uuid,
	"slug" varchar(140) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_curriculum_version_id_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_versions" ADD CONSTRAINT "curriculum_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_topics_id_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_topics_version_topic_unique" ON "course_topics" USING btree ("curriculum_version_id","topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_topics_version_position_unique" ON "course_topics" USING btree ("curriculum_version_id","position");--> statement-breakpoint
CREATE INDEX "course_topics_topic_id_idx" ON "course_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_institution_code_unique" ON "courses" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX "courses_department_id_idx" ON "courses" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "courses_subject_id_idx" ON "courses" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "courses_active_idx" ON "courses" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_versions_course_label_unique" ON "curriculum_versions" USING btree ("course_id","version_label");--> statement-breakpoint
CREATE INDEX "curriculum_versions_course_status_idx" ON "curriculum_versions" USING btree ("course_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_faculty_slug_unique" ON "departments" USING btree ("faculty_id","slug");--> statement-breakpoint
CREATE INDEX "departments_faculty_id_idx" ON "departments" USING btree ("faculty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faculties_institution_slug_unique" ON "faculties" USING btree ("institution_id","slug");--> statement-breakpoint
CREATE INDEX "faculties_institution_id_idx" ON "faculties" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_slug_unique" ON "institutions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "institutions_country_code_idx" ON "institutions" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_user_id_unique" ON "student_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profiles_institution_id_idx" ON "student_profiles" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "student_profiles_department_id_idx" ON "student_profiles" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_slug_unique" ON "subjects" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_slug_unique" ON "topics" USING btree ("subject_id","slug");--> statement-breakpoint
CREATE INDEX "topics_subject_id_idx" ON "topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "topics_parent_topic_id_idx" ON "topics" USING btree ("parent_topic_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");