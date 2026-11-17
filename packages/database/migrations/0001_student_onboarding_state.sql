ALTER TABLE "student_profiles" ADD COLUMN "self_reported_institution" varchar(200);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_institution_choice_check" CHECK ("student_profiles"."institution_id" is null or "student_profiles"."self_reported_institution" is null);
