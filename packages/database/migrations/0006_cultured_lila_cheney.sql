CREATE TYPE "public"."tutor_attempt_evaluation_status" AS ENUM('not_evaluated', 'pending', 'evaluated', 'unavailable', 'failed');--> statement-breakpoint
CREATE TABLE "tutor_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"evaluation_status" "tutor_attempt_evaluation_status" DEFAULT 'not_evaluated' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluated_at" timestamp with time zone,
	CONSTRAINT "tutor_attempts_number_positive_check" CHECK ("tutor_attempts"."attempt_number" > 0),
	CONSTRAINT "tutor_attempts_evaluated_timestamp_check" CHECK ("tutor_attempts"."evaluation_status" <> 'evaluated' or "tutor_attempts"."evaluated_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_messages_session_id_unique" ON "tutor_messages" USING btree ("session_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_sessions_id_student_unique" ON "tutor_sessions" USING btree ("id","student_id");
--> statement-breakpoint
ALTER TABLE "tutor_attempts" ADD CONSTRAINT "tutor_attempts_session_student_fk" FOREIGN KEY ("session_id","student_id") REFERENCES "public"."tutor_sessions"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_attempts" ADD CONSTRAINT "tutor_attempts_session_message_fk" FOREIGN KEY ("session_id","message_id") REFERENCES "public"."tutor_messages"("session_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_attempts_message_unique" ON "tutor_attempts" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_attempts_session_number_unique" ON "tutor_attempts" USING btree ("session_id","attempt_number");--> statement-breakpoint
CREATE INDEX "tutor_attempts_student_submitted_idx" ON "tutor_attempts" USING btree ("student_id","submitted_at");--> statement-breakpoint
CREATE INDEX "tutor_attempts_session_submitted_idx" ON "tutor_attempts" USING btree ("session_id","submitted_at");
