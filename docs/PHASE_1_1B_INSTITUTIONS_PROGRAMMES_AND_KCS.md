# Cogniva — Phase 1.1b Institutions, Programmes, and Knowledge Components

**Status:** Merged to `main` via PR #41; PR CI #44597076607 and post-merge CI #44598472862 passed.  
**Migration:** `0008_global_academic_interoperability.sql`.  
**Production:** Migration 0008 was applied after migration 0007 on 19 November 2026 by [production migration run #44615863935](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44615863935) and verified by the subsequent [read-only audit, run #44610442501 attempt 2](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44610442501). The audit found all 31 Phase 1.1 target tables, including the 16 added by this migration, present.  
**Dependency:** Migration 0008 depends on migration 0007 from PR #39. Merge/apply order is 0007, then 0008.  
**Scope:** Additive academic interoperability schema. No catalogue seeds, ingestion, APIs, runtime adapters, or production writes.

## 1. Tables added

| Table | Responsibility |
|---|---|
| `institution_identifiers` | Namespaced external IDs such as a registry/provider identifier; an external identifier does not replace the stable Cogniva institution UUID |
| `institution_aliases` | Sourced, language-tagged former/local/transliterated/abbreviated names |
| `institution_units` | Flexible institution-owned hierarchy for campus, school, college, faculty, department, institute, centre, division, research centre, or other |
| `recognition_authorities` | Jurisdiction-scoped regulator/recognition authority records |
| `recognition_decisions` | Evidence-backed, time-scoped decisions for an institution, unit, programme version, qualification, or delivery mode |
| `academic_programmes` | Stable programme identity within an institution and optional institution unit |
| `programme_versions` | Institution-bound programme versions, awards, duration and publication validity |
| `programme_qualifications` | Evidence-backed link from a programme version to a local qualification-framework level |
| `credit_systems` | Jurisdiction-scoped or institution-specific credit-unit definitions |
| `academic_periods` | Institution-scoped academic year, semester, trimester, quarter, term or session date ranges and parent periods |
| `course_content_versions` | Course syllabus/content versions with source/provenance and optional link to its legacy curriculum version |
| `programme_course_requirements` | Programme-version course requirements, local stage labels/indices, optional academic period and explicit credit-system reference |
| `knowledge_components` | Stable Cogniva-owned concept/skill/procedure/principle/strategy/model/misconception identifiers independent of catalogue IDs |
| `knowledge_component_versions` | Versioned names, definitions and learning objectives for each Knowledge Component |
| `knowledge_component_relations` | Typed prerequisite, part-of, related-to, progression or contrast relations between KC versions |
| `course_knowledge_component_mappings` | Evidence/review-aware mappings from a course-content version to a Knowledge Component version |

## 2. Integrity rules

- Existing institution, faculty, department, course, curriculum-version and student-profile rows are not rewritten or deleted.
- Institution identifiers are unique within a provider namespace. Aliases never create a new canonical institution. New external identifiers, aliases, units and programme identities carry source records; acceptance requires a review timestamp.
- Unit-parent, programme-unit, programme-version and programme-course-period relationships are constrained to preserve institutional ownership. A programme requirement cannot attach a course already assigned to another institution; institution-independent legacy courses remain eligible.
- A recognition decision must have exactly one typed subject and its scope kind must match that subject. It requires an authority and source record, retains validity dates, and only becomes accepted with a review timestamp. A missing decision is not treated as a negative recognition result.
- Programme versions are explicitly versioned. Programme-to-qualification links are separate from programme identity and are evidence/review-aware.
- Credit values are paired with an explicit `credit_system_id`; the schema never assumes that identically named numeric credits from different systems are equivalent or convertible.
- Programme stage labels/indices are institution-local. They are not ISCED levels and are not inferred from a year-of-study value.
- Academic periods use calendar dates and same-institution parent relationships. Cross-institution parent periods are rejected.
- A course-content version can link to a legacy `curriculum_versions` row only when that legacy version belongs to the same course. No old curriculum version is copied or changed.
- Active KC versions require source provenance and review time. Accepted KC relations and course-to-KC mappings require evidence and review time.
- The database trigger rejects accepted prerequisite cycles, including cycles created by inserting the reverse edge. It does not make other relation kinds acyclic. This slice adds no KC write API; a future writer must serialize accepted prerequisite-graph mutations so concurrent writes cannot race the cycle check.
- Source assertions expand their typed subject set while retaining the exactly-one-subject invariant and source-record FK.

## 3. Compatibility boundaries

- `courses.credit_units` remains as-is. It is not bulk-copied into a global credit system because its unit semantics are not established by the legacy field.
- Legacy `student_profiles.programme` and `year_of_study` remain untouched. No automatic programme/qualification/academic-period backfill is performed.
- Existing `faculties` and `departments` are not automatically migrated into `institution_units`; that mapping requires explicit, attributable backfill rules.
- Existing `curriculum_versions` remain intact. `course_content_versions` may link to them, but no generated or placeholder syllabus content is introduced.
- KC records and mappings are not seeded from course topics. A source-backed or explicitly reviewed mapping must be authored and accepted.

## 4. Validation

The CI workflow applies migrations 0000–0008 to an isolated PostgreSQL database, verifies the repository migration ledger, runs the existing 0007 foundation tests and the new 0008 integration suite, then runs all existing Tutor/learning-plan regressions, lint, typecheck and production build.

The new integration suite covers:
- namespaced identifier provenance and review-state requirements;
- same-institution unit, programme and period hierarchy/ownership;
- programme-version institution consistency and publication evidence;
- recognition-decision subject/scope and acceptance checks;
- explicit credit-value/system pairing and local stage persistence;
- legacy curriculum-to-course and course-content-to-course matching;
- programme-course course-content/academic-period ownership and legacy course institution matching;
- KC active-version evidence, accepted relation provenance and prerequisite-cycle rejection;
- accepted course-content-to-KC mapping provenance;
- expanded one-subject source assertions;
- unchanged legacy course credit units.

CI run [44596303084](https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44596303084) passed for the reviewed branch head. It applies migrations 0000–0008, verifies the migration ledger, runs both academic integration suites and all existing regression suites, lint, typecheck and production build. CI proves repository/migration behaviour against disposable PostgreSQL. It does not prove that any external catalogue record is accurate or recognized.

## 5. Rollback

Migration 0008 is additive. If the application release is rolled back, keep the new tables and constraints in place. Do not automatically drop reference, recognition, programme, course-content, or KC tables. Any destructive cleanup requires a separate reviewed migration after proving that no deployed code or retained data uses them.
