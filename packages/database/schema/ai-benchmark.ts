import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
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

export const aiBenchmarkRunStatusValues = [
  "running",
  "completed",
  "completed_with_failures"
] as const;

export const aiBenchmarkResultStatusValues = [
  "pending",
  "running",
  "succeeded",
  "failed"
] as const;

export const aiBenchmarkRunStatus = pgEnum(
  "ai_benchmark_run_status",
  aiBenchmarkRunStatusValues
);

export const aiBenchmarkResultStatus = pgEnum(
  "ai_benchmark_result_status",
  aiBenchmarkResultStatusValues
);

/**
 * One administrator-triggered, versioned provider comparison. A run is
 * isolated from learner data and records the suite/pricing snapshot used.
 */
export const aiBenchmarkRuns = pgTable(
  "ai_benchmark_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedBy: text("started_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    suiteVersion: varchar("suite_version", { length: 80 }).notNull(),
    pricingSnapshotId: varchar("pricing_snapshot_id", { length: 80 }).notNull(),
    status: aiBenchmarkRunStatus("status").notNull().default("running"),
    totalResults: integer("total_results").notNull(),
    completedResults: integer("completed_results").notNull().default(0),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    startedAt: timestampWithTimezone("started_at").notNull().defaultNow(),
    completedAt: timestampWithTimezone("completed_at")
  },
  (table) => [
    index("ai_benchmark_runs_created_idx").on(table.createdAt),
    index("ai_benchmark_runs_status_idx").on(table.status),
    check(
      "ai_benchmark_runs_total_results_positive_check",
      sql`${table.totalResults} > 0`
    ),
    check(
      "ai_benchmark_runs_completed_results_nonnegative_check",
      sql`${table.completedResults} >= 0 and ${table.completedResults} <= ${table.totalResults}`
    ),
    check(
      "ai_benchmark_runs_versions_nonempty_check",
      sql`length(trim(${table.suiteVersion})) > 0 and length(trim(${table.pricingSnapshotId})) > 0`
    )
  ]
);

/**
 * One immutable model/case attempt. Provider identity is kept server-side;
 * administrator read APIs expose only the random blind label until scoring
 * is complete for that reviewer.
 */
export const aiBenchmarkResults = pgTable(
  "ai_benchmark_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiBenchmarkRuns.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    candidateId: varchar("candidate_id", { length: 80 }).notNull(),
    provider: aiProvider("provider").notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    resolvedModel: varchar("resolved_model", { length: 160 }),
    blindLabel: varchar("blind_label", { length: 8 }).notNull(),
    task: aiTaskKey("task").notNull(),
    caseId: varchar("case_id", { length: 100 }).notNull(),
    caseTitle: text("case_title").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPrompt: text("user_prompt").notNull(),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    inputUsdPerMillion: numeric("input_usd_per_million", {
      precision: 12,
      scale: 6
    }).notNull(),
    outputUsdPerMillion: numeric("output_usd_per_million", {
      precision: 12,
      scale: 6
    }).notNull(),
    pricingReviewedAt: varchar("pricing_reviewed_at", { length: 10 }).notNull(),
    pricingEffectiveThrough: varchar("pricing_effective_through", { length: 10 }),
    pricingSource: text("pricing_source").notNull(),
    status: aiBenchmarkResultStatus("status").notNull().default("pending"),
    outputText: text("output_text"),
    usageInputTokens: integer("usage_input_tokens"),
    usageOutputTokens: integer("usage_output_tokens"),
    usageTotalTokens: integer("usage_total_tokens"),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 18,
      scale: 10
    }),
    latencyMs: integer("latency_ms"),
    finishReason: varchar("finish_reason", { length: 120 }),
    mechanicalCheck: jsonb("mechanical_check").$type<{
      valid: boolean;
      issues: string[];
      wordCount?: number;
    }>(),
    failureCode: varchar("failure_code", { length: 80 }),
    failureMessage: text("failure_message"),
    claimedAt: timestampWithTimezone("claimed_at"),
    completedAt: timestampWithTimezone("completed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("ai_benchmark_results_run_candidate_case_unique").on(
      table.runId,
      table.candidateId,
      table.caseId
    ),
    uniqueIndex("ai_benchmark_results_run_position_unique").on(
      table.runId,
      table.position
    ),
    index("ai_benchmark_results_run_status_position_idx").on(
      table.runId,
      table.status,
      table.position
    ),
    index("ai_benchmark_results_blind_label_idx").on(
      table.runId,
      table.blindLabel
    ),
    check(
      "ai_benchmark_results_position_positive_check",
      sql`${table.position} > 0 and ${table.maxOutputTokens} > 0`
    ),
    check(
      "ai_benchmark_results_model_nonempty_check",
      sql`length(trim(${table.model})) > 0 and length(trim(${table.caseTitle})) > 0`
    ),
    check(
      "ai_benchmark_results_usage_nonnegative_check",
      sql`(${table.usageInputTokens} is null or ${table.usageInputTokens} >= 0) and (${table.usageOutputTokens} is null or ${table.usageOutputTokens} >= 0) and (${table.usageTotalTokens} is null or ${table.usageTotalTokens} >= 0)`
    ),
    check(
      "ai_benchmark_results_latency_nonnegative_check",
      sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`
    )
  ]
);

export const aiBenchmarkReviews = pgTable(
  "ai_benchmark_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => aiBenchmarkResults.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    notes: text("notes"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("ai_benchmark_reviews_result_reviewer_unique").on(
      table.resultId,
      table.reviewerId
    ),
    index("ai_benchmark_reviews_reviewer_created_idx").on(
      table.reviewerId,
      table.createdAt
    ),
    check(
      "ai_benchmark_reviews_scores_object_check",
      sql`jsonb_typeof(${table.scores}) = 'object'`
    )
  ]
);
