import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/**
 * Academic catalogue tables intentionally contain no seeded institution,
 * course, subject, or topic records. Catalogue content must be sourced and
 * managed as real data.
 */
export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: text("name").notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    websiteUrl: text("website_url"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("institutions_slug_unique").on(table.slug),
    index("institutions_country_code_idx").on(table.countryCode)
  ]
);

export const faculties = pgTable(
  "faculties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: text("name").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("faculties_institution_slug_unique").on(
      table.institutionId,
      table.slug
    ),
    index("faculties_institution_id_idx").on(table.institutionId)
  ]
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facultyId: uuid("faculty_id")
      .notNull()
      .references(() => faculties.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: text("name").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("departments_faculty_slug_unique").on(
      table.facultyId,
      table.slug
    ),
    index("departments_faculty_id_idx").on(table.facultyId)
  ]
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [uniqueIndex("subjects_slug_unique").on(table.slug)]
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id").references(() => institutions.id, {
      onDelete: "set null"
    }),
    selfReportedInstitution: varchar("self_reported_institution", { length: 200 }),
    onboardingCompletedAt: timestampWithTimezone("onboarding_completed_at"),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null"
    }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 40 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    level: smallint("level"),
    creditUnits: numeric("credit_units", { precision: 4, scale: 1 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("courses_institution_code_unique").on(
      table.institutionId,
      table.code
    ),
    index("courses_department_id_idx").on(table.departmentId),
    index("courses_subject_id_idx").on(table.subjectId),
    index("courses_active_idx").on(table.isActive),
    check(
      "courses_level_positive_check",
      sql`${table.level} is null or (${table.level} >= 1 and ${table.level} <= 12)`
    )
  ]
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    parentTopicId: uuid("parent_topic_id").references(
      (): AnyPgColumn => topics.id,
      { onDelete: "set null" }
    ),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("topics_subject_slug_unique").on(table.subjectId, table.slug),
    index("topics_subject_id_idx").on(table.subjectId),
    index("topics_parent_topic_id_idx").on(table.parentTopicId)
  ]
);

export const curriculumVersionStatus = pgEnum("curriculum_version_status", [
  "draft",
  "published",
  "archived"
]);

export const curriculumVersions = pgTable(
  "curriculum_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    versionLabel: varchar("version_label", { length: 60 }).notNull(),
    status: curriculumVersionStatus("status").notNull().default("draft"),
    sourceReference: text("source_reference"),
    publishedAt: timestampWithTimezone("published_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("curriculum_versions_course_label_unique").on(
      table.courseId,
      table.versionLabel
    ),
    index("curriculum_versions_course_status_idx").on(
      table.courseId,
      table.status
    )
  ]
);

export const courseTopics = pgTable(
  "course_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    curriculumVersionId: uuid("curriculum_version_id")
      .notNull()
      .references(() => curriculumVersions.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("course_topics_version_topic_unique").on(
      table.curriculumVersionId,
      table.topicId
    ),
    uniqueIndex("course_topics_version_position_unique").on(
      table.curriculumVersionId,
      table.position
    ),
    index("course_topics_topic_id_idx").on(table.topicId),
    check("course_topics_position_positive_check", sql`${table.position} > 0`)
  ]
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id").references(() => institutions.id, {
      onDelete: "set null"
    }),
    facultyId: uuid("faculty_id").references(() => faculties.id, {
      onDelete: "set null"
    }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null"
    }),
    programme: text("programme"),
    yearOfStudy: smallint("year_of_study"),
    locale: varchar("locale", { length: 20 }).notNull().default("en"),
    timeZone: varchar("time_zone", { length: 80 }),
    learningPreferences: jsonb("learning_preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("student_profiles_user_id_unique").on(table.userId),
    index("student_profiles_institution_id_idx").on(table.institutionId),
    index("student_profiles_department_id_idx").on(table.departmentId),
    check(
      "student_profiles_year_of_study_check",
      sql`${table.yearOfStudy} is null or (${table.yearOfStudy} >= 1 and ${table.yearOfStudy} <= 12)`
    ),
    check(
      "student_profiles_institution_choice_check",
      sql`${table.institutionId} is null or ${table.selfReportedInstitution} is null`
    )
  ]
);
