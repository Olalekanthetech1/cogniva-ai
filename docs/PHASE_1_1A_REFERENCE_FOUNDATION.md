# Cogniva — Phase 1.1a Reference and Provenance Foundation

**Status:** Implemented on the feature branch; awaiting review and CI.  
**Migration:** `0007_global_academic_reference_foundation.sql`.  
**Production:** Not applied.  
**Scope:** Additive reference and provenance schema only. No catalogue seed data, external fetches, source adapters, API routes, or production writes.

## 1. Migration contents

The migration adds 15 tables:

| Table | Purpose |
|---|---|
| `countries` | Stable Cogniva country IDs with optional ISO alpha-2, alpha-3, and numeric identifiers plus validity dates |
| `country_aliases` | Language-tagged and typed alternate country names |
| `education_jurisdictions` | National, subnational, territorial, regional, or other education authorities, separate from country/location |
| `education_systems` | Jurisdiction-scoped education systems |
| `qualification_frameworks` | Jurisdiction/system-scoped local frameworks |
| `qualification_framework_versions` | Versioned framework validity and source reference |
| `qualification_levels` | Local level codes, labels, descriptors, ordering, and same-version parent relationships |
| `classification_schemes` | Typed classification schemes: programme, attainment, field, or other |
| `classification_scheme_versions` | Explicit classification scheme versions and validity |
| `classification_codes` | Version-scoped classification codes and same-version hierarchy |
| `qualification_level_classification_mappings` | Evidence/review-aware ISCED-P and ISCED-A mappings; the mapping kind is separate |
| `catalogue_sources` | Source identity, type/access method, terms/licence/attribution, nullable permission flags, and rights-review state |
| `catalogue_source_records` | Provider record ID, source URL/release/publication date, retrieval time, content hash, and metadata |
| `entity_source_assertions` | Claim-level assertions tied to a source record and exactly one typed subject in this slice |
| `catalogue_review_events` | Append-only review history for source assertions |

## 2. Integrity and evidence boundaries

- ISO identifiers are optional external references; internal Cogniva UUIDs remain stable. Code format and uniqueness are constrained, but no ISO list is seeded.
- A country is not an education jurisdiction. A jurisdiction may be attached to a country or remain unassigned until its source is known.
- Qualification frameworks and classification schemes carry explicit versions and validity intervals.
- Qualification-level parents and classification-code parents are constrained to the same version. Self-parenting is rejected. Multi-node cycle validation still belongs in the service layer before any future write API is enabled.
- ISCED-P and ISCED-A are separate mapping kinds. A database trigger verifies that an ISCED-P mapping points to a programme-kind classification scheme and an ISCED-A mapping points to an attainment-kind scheme. ISCED-F is a field classification, not a qualification-level mapping.
- An accepted qualification mapping requires a source record and review timestamp. Confidence, when supplied, is bounded from 0 to 1.
- Sources default to `proposed`. Permission flags are nullable so unknown rights are not treated as permission. A source cannot be marked `approved` until its rights-review timestamp and all four cache/store/display/redistribute decisions are explicitly recorded.
- Source records preserve retrieval time separately from source publication time. This migration does not persist full raw source payloads.
- Every source assertion includes a source-record FK and has exactly one typed subject: institution, education jurisdiction, qualification framework, or qualification level. Future entity types are added as explicit FK columns in later migrations rather than relying on an unconstrained polymorphic ID.
- Assertion status starts `unreviewed`. Source presence alone is not accreditation or official recognition.
- No ISO, UNESCO, regulator, institution, ROR, OpenAlex, or WHED/IAU records are inserted. No external source is enabled by this migration.

## 3. Compatibility and rollback

The migration does not alter or remove any existing table, column, index, FK, enum, or learner record. Existing institution UUIDs, faculty/department records, courses, curricula, and student-profile values remain untouched.

The migration is forward-only additive. If application code later depends on these tables and a release fails, roll back to the previous application code while retaining the new empty tables. Do not drop these tables as an automatic rollback. Any destructive cleanup requires a separate approved migration after confirming no retained or deployed code uses them.

## 4. Validation

CI applies all repository migrations (0000–0007) to an isolated PostgreSQL service, runs the read-only schema-audit assertion, runs dedicated integration tests for this foundation, then runs authentication/tutor tests, lint, typecheck, and production build.

The integration tests cover:
- ISO code format checks and nullable/unverified source rights;
- source approval only after rights fields are explicitly reviewed;
- country, jurisdiction, system, framework, and framework-version references;
- qualification-level parent scope within a framework version;
- classification-code parent scope within a classification version;
- distinct ISCED-P and ISCED-A mapping kinds, including a database-trigger rejection of cross-kind mappings;
- accepted mappings requiring source evidence and review time;
- exactly one typed entity per source assertion;
- review-event persistence.

This validates repository/CI behaviour, not a production migration or catalogue data correctness.
