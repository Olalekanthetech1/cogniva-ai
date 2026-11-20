CREATE TYPE "public"."ai_model_status" AS ENUM ('pending', 'enabled', 'disabled');
--> statement-breakpoint
CREATE TYPE "public"."ai_model_connection_status" AS ENUM ('connected', 'failed');
--> statement-breakpoint
CREATE TABLE "ai_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" "ai_provider" NOT NULL,
  "model_id" varchar(160) NOT NULL,
  "display_name" varchar(160) NOT NULL,
  "status" "ai_model_status" DEFAULT 'pending' NOT NULL,
  "capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "capability_evidence_url" text,
  "capabilities_verified_at" timestamp with time zone,
  "capabilities_verified_by" text,
  "last_test_status" "ai_model_connection_status",
  "last_tested_at" timestamp with time zone,
  "last_test_latency_ms" integer,
  "last_test_error_code" varchar(80),
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_model_id_unique" ON "ai_models" USING btree ("provider", "model_id");
--> statement-breakpoint
CREATE INDEX "ai_models_provider_status_idx" ON "ai_models" USING btree ("provider", "status");
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_capabilities_verified_by_user_id_fk" FOREIGN KEY ("capabilities_verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_model_id_nonempty_check" CHECK (length(trim("model_id")) between 1 and 160);
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_display_name_nonempty_check" CHECK (length(trim("display_name")) between 1 and 160);
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_capabilities_object_check" CHECK (jsonb_typeof("capabilities") = 'object');
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_test_latency_nonnegative_check" CHECK ("last_test_latency_ms" is null or "last_test_latency_ms" >= 0);
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_enabled_requires_test_and_capability_evidence" CHECK ("status" <> 'enabled' or ("capability_evidence_url" is not null and "capabilities_verified_at" is not null and "last_test_status" is not distinct from 'connected'));
--> statement-breakpoint
CREATE TABLE "ai_task_model_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task" "ai_task_key" NOT NULL,
  "model_id" uuid NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_task_model_candidates_task_model_unique" ON "ai_task_model_candidates" USING btree ("task", "model_id");
--> statement-breakpoint
CREATE INDEX "ai_task_model_candidates_task_enabled_priority_idx" ON "ai_task_model_candidates" USING btree ("task", "is_enabled", "priority");
--> statement-breakpoint
ALTER TABLE "ai_task_model_candidates" ADD CONSTRAINT "ai_task_model_candidates_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_task_model_candidates" ADD CONSTRAINT "ai_task_model_candidates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_task_model_candidates" ADD CONSTRAINT "ai_task_model_candidates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_task_model_candidates" ADD CONSTRAINT "ai_task_model_candidates_priority_range_check" CHECK ("priority" between 0 and 10000);
--> statement-breakpoint
INSERT INTO "ai_models" ("provider", "model_id", "display_name", "status", "capabilities")
SELECT DISTINCT "provider", "model", "model", 'pending'::"public"."ai_model_status", '{}'::jsonb
FROM "ai_task_routes"
ON CONFLICT ("provider", "model_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_task_model_candidates" ("task", "model_id", "is_enabled", "priority")
SELECT routes."task", models."id", false, 100
FROM "ai_task_routes" AS routes
JOIN "ai_models" AS models
  ON models."provider" = routes."provider"
 AND models."model_id" = routes."model"
ON CONFLICT ("task", "model_id") DO NOTHING;
