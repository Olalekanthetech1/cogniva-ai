import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  uuid
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const aiProviderValues = ["gemini", "groq", "mistral"] as const;
export const aiTaskKeyValues = [
  "learning_plan_generation",
  "socratic_tutor_response"
] as const;

export const aiProvider = pgEnum("ai_provider", aiProviderValues);
export const aiTaskKey = pgEnum("ai_task_key", aiTaskKeyValues);

export const aiTaskRoutingModeValues = ["pinned", "adaptive"] as const;
export const aiTaskRoutingMode = pgEnum("ai_task_routing_mode", aiTaskRoutingModeValues);

/**
 * Stores administrator-selected routing preferences. These preferences do
 * not activate inference; provider adapters must consume them in a later,
 * separately tested implementation.
 */
export const aiTaskRoutes = pgTable(
  "ai_task_routes",
  {
    task: aiTaskKey("task").primaryKey(),
    provider: aiProvider("provider").notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null"
    }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("ai_task_routes_provider_idx").on(table.provider),
    check(
      "ai_task_routes_model_nonempty_check",
      sql`length(trim(${table.model})) between 1 and 160`
    )
  ]
);

/**
 * Per-task rollout mode for the adaptive model selector.
 * Every task starts pinned. Adaptive mode is changed only by an administrator
 * after the server confirms that at least one candidate is currently eligible.
 */
export const aiTaskRoutingSettings = pgTable(
  "ai_task_routing_settings",
  {
    task: aiTaskKey("task").primaryKey(),
    mode: aiTaskRoutingMode("mode").notNull().default("pinned"),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null"
    }),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow()
  }
);

/**
 * Application-level append-only audit history for administrative changes.
 * No update/delete API is exposed for this table.
 */
export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null"
    }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: varchar("resource_id", { length: 160 }).notNull(),
    metadata: jsonb("metadata").$type<
      Record<string, string | number | boolean | null>
    >(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    index("admin_audit_events_created_at_idx").on(table.createdAt),
    index("admin_audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt
    ),
    check(
      "admin_audit_events_action_nonempty_check",
      sql`length(trim(${table.action})) > 0`
    ),
    check(
      "admin_audit_events_resource_type_nonempty_check",
      sql`length(trim(${table.resourceType})) > 0`
    ),
    check(
      "admin_audit_events_resource_id_nonempty_check",
      sql`length(trim(${table.resourceId})) > 0`
    )
  ]
);
