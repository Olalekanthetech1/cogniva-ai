CREATE TYPE "public"."ai_benchmark_result_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_benchmark_run_status" AS ENUM('running', 'completed', 'completed_with_failures');--> statement-breakpoint
CREATE TABLE "ai_benchmark_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"candidate_id" varchar(80) NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(160) NOT NULL,
	"resolved_model" varchar(160),
	"blind_label" varchar(8) NOT NULL,
	"task" "ai_task_key" NOT NULL,
	"case_id" varchar(100) NOT NULL,
	"case_title" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt" text NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"input_usd_per_million" numeric(12, 6) NOT NULL,
	"output_usd_per_million" numeric(12, 6) NOT NULL,
	"pricing_reviewed_at" varchar(10) NOT NULL,
	"pricing_effective_through" varchar(10),
	"pricing_source" text NOT NULL,
	"status" "ai_benchmark_result_status" DEFAULT 'pending' NOT NULL,
	"output_text" text,
	"usage_input_tokens" integer,
	"usage_output_tokens" integer,
	"usage_total_tokens" integer,
	"estimated_cost_usd" numeric(18, 10),
	"latency_ms" integer,
	"finish_reason" varchar(120),
	"mechanical_check" jsonb,
	"failure_code" varchar(80),
	"failure_message" text,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_benchmark_results_position_positive_check" CHECK ("ai_benchmark_results"."position" > 0 and "ai_benchmark_results"."max_output_tokens" > 0),
	CONSTRAINT "ai_benchmark_results_model_nonempty_check" CHECK (length(trim("ai_benchmark_results"."model")) > 0 and length(trim("ai_benchmark_results"."case_title")) > 0),
	CONSTRAINT "ai_benchmark_results_usage_nonnegative_check" CHECK (("ai_benchmark_results"."usage_input_tokens" is null or "ai_benchmark_results"."usage_input_tokens" >= 0) and ("ai_benchmark_results"."usage_output_tokens" is null or "ai_benchmark_results"."usage_output_tokens" >= 0) and ("ai_benchmark_results"."usage_total_tokens" is null or "ai_benchmark_results"."usage_total_tokens" >= 0)),
	CONSTRAINT "ai_benchmark_results_latency_nonnegative_check" CHECK ("ai_benchmark_results"."latency_ms" is null or "ai_benchmark_results"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_benchmark_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"scores" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_benchmark_reviews_scores_object_check" CHECK (jsonb_typeof("ai_benchmark_reviews"."scores") = 'object')
);
--> statement-breakpoint
CREATE TABLE "ai_benchmark_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_by" text NOT NULL,
	"suite_version" varchar(80) NOT NULL,
	"pricing_snapshot_id" varchar(80) NOT NULL,
	"status" "ai_benchmark_run_status" DEFAULT 'running' NOT NULL,
	"total_results" integer NOT NULL,
	"completed_results" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_benchmark_runs_total_results_positive_check" CHECK ("ai_benchmark_runs"."total_results" > 0),
	CONSTRAINT "ai_benchmark_runs_completed_results_nonnegative_check" CHECK ("ai_benchmark_runs"."completed_results" >= 0 and "ai_benchmark_runs"."completed_results" <= "ai_benchmark_runs"."total_results"),
	CONSTRAINT "ai_benchmark_runs_versions_nonempty_check" CHECK (length(trim("ai_benchmark_runs"."suite_version")) > 0 and length(trim("ai_benchmark_runs"."pricing_snapshot_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "ai_benchmark_results" ADD CONSTRAINT "ai_benchmark_results_run_id_ai_benchmark_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_benchmark_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_benchmark_reviews" ADD CONSTRAINT "ai_benchmark_reviews_result_id_ai_benchmark_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."ai_benchmark_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_benchmark_reviews" ADD CONSTRAINT "ai_benchmark_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_benchmark_runs" ADD CONSTRAINT "ai_benchmark_runs_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_benchmark_results_run_candidate_case_unique" ON "ai_benchmark_results" USING btree ("run_id","candidate_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_benchmark_results_run_position_unique" ON "ai_benchmark_results" USING btree ("run_id","position");--> statement-breakpoint
CREATE INDEX "ai_benchmark_results_run_status_position_idx" ON "ai_benchmark_results" USING btree ("run_id","status","position");--> statement-breakpoint
CREATE INDEX "ai_benchmark_results_blind_label_idx" ON "ai_benchmark_results" USING btree ("run_id","blind_label");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_benchmark_reviews_result_reviewer_unique" ON "ai_benchmark_reviews" USING btree ("result_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "ai_benchmark_reviews_reviewer_created_idx" ON "ai_benchmark_reviews" USING btree ("reviewer_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_benchmark_runs_created_idx" ON "ai_benchmark_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_benchmark_runs_status_idx" ON "ai_benchmark_runs" USING btree ("status");