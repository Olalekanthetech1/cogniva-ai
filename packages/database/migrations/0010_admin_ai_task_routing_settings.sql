CREATE TYPE "public"."ai_task_routing_mode" AS ENUM ('pinned', 'adaptive');
--> statement-breakpoint
CREATE TABLE "ai_task_routing_settings" (
  "task" "ai_task_key" PRIMARY KEY NOT NULL,
  "mode" "ai_task_routing_mode" DEFAULT 'pinned' NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_task_routing_settings"
  ADD CONSTRAINT "ai_task_routing_settings_updated_by_user_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "ai_task_routing_settings" ("task", "mode")
VALUES
  ('learning_plan_generation', 'pinned'),
  ('socratic_tutor_response', 'pinned');
