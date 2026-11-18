import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
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

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const learningIntent = pgEnum("learning_intent", [
  "learn_topic",
  "understand_concept",
  "solve_problem"
]);

export const learningPlanStatus = pgEnum("learning_plan_status", [
  "draft",
  "active",
  "completed",
  "archived"
]);

export const learningPlanGenerationStatus = pgEnum(
  "learning_plan_generation_status",
  ["pending", "running", "succeeded", "failed", "unavailable"]
);

export const learningPlanRevisionStatus = pgEnum(
  "learning_plan_revision_status",
  ["proposed", "approved", "rejected"]
);

export const learningPlanConceptKind = pgEnum(
  "learning_plan_concept_kind",
  ["concept", "skill"]
);

export const learningPlanRelationType = pgEnum(
  "learning_plan_relation_type",
  ["prerequisite", "related", "part_of"]
);

export const learningPlanRelationReviewStatus = pgEnum(
  "learning_plan_relation_review_status",
  ["proposed", "accepted", "rejected"]
);

export const tutorSessionState = pgEnum("tutor_session_state", [
  "created",
  "interpreting",
  "needs_confirmation",
  "ready",
  "guiding",
  "awaiting_attempt",
  "explaining_why",
  "evaluating_attempt",
  "correcting_misconception",
  "completed",
  "failed",
  "cancelled"
]);

export const tutorMessageRole = pgEnum("tutor_message_role", [
  "student",
  "tutor"
]);

export const tutorAttemptEvaluationStatus = pgEnum(
  "tutor_attempt_evaluation_status",
  ["not_evaluated", "pending", "evaluated", "unavailable", "failed"]
);

/**
 * Student-owned learning plan container. A plan is independent of the
 * institution catalogue; generated outlines are stored as numbered revisions.
 */
export const learningPlans = pgTable(
  "learning_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    intent: learningIntent("intent").notNull(),
    initialInput: text("initial_input").notNull(),
    status: learningPlanStatus("status").notNull().default("draft"),
    generationStatus: learningPlanGenerationStatus("generation_status")
      .notNull()
      .default("pending"),
    lastGenerationErrorCode: varchar("last_generation_error_code", {
      length: 80
    }),
    version: integer("version").notNull().default(1),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    index("learning_plans_student_status_updated_idx").on(
      table.studentId,
      table.status,
      table.updatedAt
    ),
    check(
      "learning_plans_initial_input_nonempty_check",
      sql`length(trim(${table.initialInput})) > 0`
    ),
    check("learning_plans_version_positive_check", sql`${table.version} > 0`)
  ]
);

/**
 * Every generation/edit cycle creates a revision. Approved history is kept
 * when another proposed revision is generated or rejected.
 */
export const learningPlanRevisions = pgTable(
  "learning_plan_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learningPlanId: uuid("learning_plan_id")
      .notNull()
      .references(() => learningPlans.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    sourceInput: text("source_input").notNull(),
    status: learningPlanRevisionStatus("status").notNull().default("proposed"),
    generationProvider: varchar("generation_provider", { length: 80 }),
    generationModel: varchar("generation_model", { length: 160 }),
    promptVersion: varchar("prompt_version", { length: 80 }),
    outputSchemaVersion: varchar("output_schema_version", { length: 80 }),
    generatedAt: timestampWithTimezone("generated_at"),
    reviewedAt: timestampWithTimezone("reviewed_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("learning_plan_revisions_plan_number_unique").on(
      table.learningPlanId,
      table.revisionNumber
    ),
    index("learning_plan_revisions_plan_status_idx").on(
      table.learningPlanId,
      table.status
    ),
    check(
      "learning_plan_revisions_number_positive_check",
      sql`${table.revisionNumber} > 0`
    ),
    check(
      "learning_plan_revisions_title_nonempty_check",
      sql`length(trim(${table.title})) > 0`
    ),
    check(
      "learning_plan_revisions_source_input_nonempty_check",
      sql`length(trim(${table.sourceInput})) > 0`
    )
  ]
);

export const learningPlanUnits = pgTable(
  "learning_plan_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => learningPlanRevisions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("learning_plan_units_revision_position_unique").on(
      table.revisionId,
      table.position
    ),
    uniqueIndex("learning_plan_units_revision_id_unique").on(
      table.revisionId,
      table.id
    ),
    index("learning_plan_units_revision_idx").on(table.revisionId),
    check(
      "learning_plan_units_position_positive_check",
      sql`${table.position} > 0`
    ),
    check(
      "learning_plan_units_title_nonempty_check",
      sql`length(trim(${table.title})) > 0`
    )
  ]
);

export const learningPlanObjectives = pgTable(
  "learning_plan_objectives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => learningPlanUnits.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    position: integer("position").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("learning_plan_objectives_unit_position_unique").on(
      table.unitId,
      table.position
    ),
    index("learning_plan_objectives_unit_idx").on(table.unitId),
    check(
      "learning_plan_objectives_position_positive_check",
      sql`${table.position} > 0`
    ),
    check(
      "learning_plan_objectives_statement_nonempty_check",
      sql`length(trim(${table.statement})) > 0`
    )
  ]
);

export const learningPlanConcepts = pgTable(
  "learning_plan_concepts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => learningPlanRevisions.id, { onDelete: "cascade" }),
    kind: learningPlanConceptKind("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("learning_plan_concepts_revision_position_unique").on(
      table.revisionId,
      table.position
    ),
    uniqueIndex("learning_plan_concepts_revision_id_unique").on(
      table.revisionId,
      table.id
    ),
    index("learning_plan_concepts_revision_idx").on(table.revisionId),
    check(
      "learning_plan_concepts_position_positive_check",
      sql`${table.position} > 0`
    ),
    check(
      "learning_plan_concepts_name_nonempty_check",
      sql`length(trim(${table.name})) > 0`
    )
  ]
);

/**
 * Join table keeps plan units and plan concepts many-to-many while the
 * composite foreign keys ensure both records belong to the same revision.
 */
export const learningPlanUnitConcepts = pgTable(
  "learning_plan_unit_concepts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id").notNull(),
    unitId: uuid("unit_id").notNull(),
    conceptId: uuid("concept_id").notNull(),
    position: integer("position").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      name: "learning_plan_unit_concepts_unit_revision_fk",
      columns: [table.revisionId, table.unitId],
      foreignColumns: [learningPlanUnits.revisionId, learningPlanUnits.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "learning_plan_unit_concepts_concept_revision_fk",
      columns: [table.revisionId, table.conceptId],
      foreignColumns: [learningPlanConcepts.revisionId, learningPlanConcepts.id]
    }).onDelete("cascade"),
    uniqueIndex("learning_plan_unit_concepts_unit_concept_unique").on(
      table.unitId,
      table.conceptId
    ),
    uniqueIndex("learning_plan_unit_concepts_unit_position_unique").on(
      table.unitId,
      table.position
    ),
    index("learning_plan_unit_concepts_concept_idx").on(table.conceptId),
    check(
      "learning_plan_unit_concepts_position_positive_check",
      sql`${table.position} > 0`
    )
  ]
);

export const learningPlanConceptRelations = pgTable(
  "learning_plan_concept_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id").notNull(),
    sourceConceptId: uuid("source_concept_id").notNull(),
    targetConceptId: uuid("target_concept_id").notNull(),
    relationType: learningPlanRelationType("relation_type").notNull(),
    reviewStatus: learningPlanRelationReviewStatus("review_status")
      .notNull()
      .default("proposed"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    reviewedAt: timestampWithTimezone("reviewed_at")
  },
  (table) => [
    foreignKey({
      name: "learning_plan_concept_relations_source_revision_fk",
      columns: [table.revisionId, table.sourceConceptId],
      foreignColumns: [learningPlanConcepts.revisionId, learningPlanConcepts.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "learning_plan_concept_relations_target_revision_fk",
      columns: [table.revisionId, table.targetConceptId],
      foreignColumns: [learningPlanConcepts.revisionId, learningPlanConcepts.id]
    }).onDelete("cascade"),
    uniqueIndex("learning_plan_concept_relations_unique").on(
      table.revisionId,
      table.sourceConceptId,
      table.targetConceptId,
      table.relationType
    ),
    index("learning_plan_concept_relations_revision_status_idx").on(
      table.revisionId,
      table.reviewStatus
    ),
    check(
      "learning_plan_concept_relations_not_self_check",
      sql`${table.sourceConceptId} <> ${table.targetConceptId}`
    )
  ]
);

export const tutorSessions = pgTable(
  "tutor_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learningPlanRevisionId: uuid("learning_plan_revision_id").references(
      () => learningPlanRevisions.id,
      { onDelete: "set null" }
    ),
    learningPlanUnitId: uuid("learning_plan_unit_id").references(
      () => learningPlanUnits.id,
      { onDelete: "set null" }
    ),
    intent: learningIntent("intent").notNull(),
    initialPrompt: text("initial_prompt").notNull(),
    state: tutorSessionState("state").notNull().default("created"),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestampWithTimezone("completed_at")
  },
  (table) => [
    index("tutor_sessions_student_state_updated_idx").on(
      table.studentId,
      table.state,
      table.updatedAt
    ),
    index("tutor_sessions_plan_revision_idx").on(table.learningPlanRevisionId),
    index("tutor_sessions_plan_unit_idx").on(table.learningPlanUnitId),
    check(
      "tutor_sessions_prompt_nonempty_check",
      sql`length(trim(${table.initialPrompt})) > 0`
    ),
    check(
      "tutor_sessions_step_index_nonnegative_check",
      sql`${table.currentStepIndex} >= 0`
    ),
    check("tutor_sessions_version_positive_check", sql`${table.version} > 0`)
  ]
);

export const tutorMessages = pgTable(
  "tutor_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    role: tutorMessageRole("role").notNull(),
    content: text("content").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    provider: varchar("provider", { length: 80 }),
    model: varchar("model", { length: 160 }),
    promptVersion: varchar("prompt_version", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("tutor_messages_session_sequence_unique").on(
      table.sessionId,
      table.sequenceNumber
    ),
    index("tutor_messages_session_created_idx").on(
      table.sessionId,
      table.createdAt
    ),
    check(
      "tutor_messages_content_nonempty_check",
      sql`length(trim(${table.content})) > 0`
    ),
    check(
      "tutor_messages_sequence_positive_check",
      sql`${table.sequenceNumber} > 0`
    ),
    check(
      "tutor_messages_tutor_provenance_check",
      sql`${table.role} <> 'tutor' or (${table.provider} is not null and ${table.model} is not null and ${table.promptVersion} is not null)`
    )
  ]
);


/**
 * A learner explicitly submits an existing student message as an attempt.
 * The message remains the source text; this row records its assessment
 * lifecycle without implying that an evaluation has taken place.
 */
export const tutorAttempts = pgTable(
  "tutor_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tutorSessions.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => tutorMessages.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    evaluationStatus: tutorAttemptEvaluationStatus("evaluation_status")
      .notNull()
      .default("not_evaluated"),
    submittedAt: timestampWithTimezone("submitted_at").notNull().defaultNow(),
    evaluatedAt: timestampWithTimezone("evaluated_at")
  },
  (table) => [
    uniqueIndex("tutor_attempts_message_unique").on(table.messageId),
    uniqueIndex("tutor_attempts_session_number_unique").on(
      table.sessionId,
      table.attemptNumber
    ),
    index("tutor_attempts_student_submitted_idx").on(
      table.studentId,
      table.submittedAt
    ),
    index("tutor_attempts_session_submitted_idx").on(
      table.sessionId,
      table.submittedAt
    ),
    check(
      "tutor_attempts_number_positive_check",
      sql`${table.attemptNumber} > 0`
    ),
    check(
      "tutor_attempts_evaluated_timestamp_check",
      sql`${table.evaluationStatus} <> 'evaluated' or ${table.evaluatedAt} is not null`
    )
  ]
);
