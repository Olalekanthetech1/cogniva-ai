CREATE TYPE "public"."ai_provider" AS ENUM('gemini', 'groq', 'mistral');--> statement-breakpoint
CREATE TYPE "public"."ai_task_key" AS ENUM('learning_plan_generation', 'socratic_tutor_response');--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" varchar(160) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_events_action_nonempty_check" CHECK (length(trim("admin_audit_events"."action")) > 0),
	CONSTRAINT "admin_audit_events_resource_type_nonempty_check" CHECK (length(trim("admin_audit_events"."resource_type")) > 0),
	CONSTRAINT "admin_audit_events_resource_id_nonempty_check" CHECK (length(trim("admin_audit_events"."resource_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_task_routes" (
	"task" "ai_task_key" PRIMARY KEY NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(160) NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_task_routes_model_nonempty_check" CHECK (length(trim("ai_task_routes"."model")) between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_task_routes" ADD CONSTRAINT "ai_task_routes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_at_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_created_idx" ON "admin_audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_task_routes_provider_idx" ON "ai_task_routes" USING btree ("provider");