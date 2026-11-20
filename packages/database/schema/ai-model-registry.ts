import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { aiProvider, aiTaskKey } from "./admin";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const aiModelStatusValues = ["pending", "enabled", "disabled"] as const;
export const aiModelConnectionStatusValues = ["connected", "failed"] as const;

export const aiModelStatus = pgEnum("ai_model_status", aiModelStatusValues);
export const aiModelConnectionStatus = pgEnum(
  "ai_model_connection_status",
  aiModelConnectionStatusValues
);

export type AiModelCapabilities = {
  inputModalities?: Array<"text" | "image">;
  outputModalities?: Array<"text">;
  structuredOutput?: "unknown" | "unsupported" | "json_object" | "json_schema";
  contextWindowTokens?: number | null;
  maxOutputTokens?: number | null;
  reasoning?: {
    kind: "unknown" | "none" | "fixed" | "configurable";
    parameter: "thinking_level" | "reasoning_effort" | null;
    levels: string[];
    supported?: boolean | null;
  };
  temperature?: "unknown" | "supported" | "unsupported";
};

/**
 * Administrator-managed model catalogue. Capability claims are explicitly
 * sourced and reviewed; a successful connection test alone does not verify
 * model capabilities or teaching quality.
 */
export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: aiProvider("provider").notNull(),
    modelId: varchar("model_id", { length: 160 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: aiModelStatus("status").notNull().default("pending"),
    capabilities: jsonb("capabilities")
      .$type<AiModelCapabilities>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    capabilityEvidenceUrl: text("capability_evidence_url"),
    capabilitiesVerifiedAt: timestampWithTimezone("capabilities_verified_at"),
    capabilitiesVerifiedBy: text("capabilities_verified_by").references(
      () => user.id,
      { onDelete: "set null" }
    ),
    lastTestStatus: aiModelConnectionStatus("last_test_status"),
    lastTestedAt: timestampWithTimezone("last_tested_at"),
    lastTestLatencyMs: integer("last_test_latency_ms"),
    lastTestErrorCode: varchar("last_test_error_code", { length: 80 }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null"
    }),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null"
    }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("ai_models_provider_model_id_unique").on(
      table.provider,
      table.modelId
    ),
    index("ai_models_provider_status_idx").on(table.provider, table.status),
    check(
      "ai_models_model_id_nonempty_check",
      sql`length(trim(${table.modelId})) between 1 and 160`
    ),
    check(
      "ai_models_display_name_nonempty_check",
      sql`length(trim(${table.displayName})) between 1 and 160`
    ),
    check(
      "ai_models_capabilities_object_check",
      sql`jsonb_typeof(${table.capabilities}) = 'object'`
    ),
    check(
      "ai_models_test_latency_nonnegative_check",
      sql`${table.lastTestLatencyMs} is null or ${table.lastTestLatencyMs} >= 0`
    ),
    check(
      "ai_models_enabled_requires_test_and_capability_evidence",
      sql`${table.status} <> 'enabled' or (
        ${table.capabilityEvidenceUrl} is not null and
        ${table.capabilitiesVerifiedAt} is not null and
        ${table.lastTestStatus} is not distinct from 'connected'
      )`
    )
  ]
);

/**
 * Explicit task eligibility. Newly registered models start disabled for every
 * task; enabling a model or a task candidate never changes the legacy active
 * route. The adaptive router consumes this table in the next implementation
 * slice after its own selection and regression gates pass.
 */
export const aiTaskModelCandidates = pgTable(
  "ai_task_model_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    task: aiTaskKey("task").notNull(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => aiModels.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").notNull().default(false),
    priority: integer("priority").notNull().default(100),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null"
    }),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null"
    }),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("ai_task_model_candidates_task_model_unique").on(
      table.task,
      table.modelId
    ),
    index("ai_task_model_candidates_task_enabled_priority_idx").on(
      table.task,
      table.isEnabled,
      table.priority
    ),
    check(
      "ai_task_model_candidates_priority_range_check",
      sql`${table.priority} between 0 and 10000`
    )
  ]
);
