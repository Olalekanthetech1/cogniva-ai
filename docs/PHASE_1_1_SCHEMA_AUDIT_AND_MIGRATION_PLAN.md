# Cogniva — Phase 1.1 Schema Audit and Migration Plan

**Status:** Design baseline and additive schema slices 1.1a/1.1b merged to `main`; read-only Neon audit completed; production application of migrations 0007/0008 remains unverified and has not been performed in this workflow.  
**Scope:** Global academic interoperability. Migrations 0007 and 0008 define reference/provenance, institution/programme, credit/period, course-content, recognition, and Knowledge Component structures. Runtime adapters, ingestion, and learner-context backfill remain outstanding.  
**Safety:** The prior Neon audit was read-only. Migrations 0007 and 0008 are merged and CI-tested, but have not been applied to production in this workflow; no catalogue data or production writes have been performed.

## 1. Evidence boundary and current-state audit

Three different evidence sources must not be conflated:

1. **Repository schema** describes what the current code expects.
2. **CI PostgreSQL** proves that committed migrations can be applied to a disposable database. It does not prove what is installed in Neon.
3. **Production database** was inspected through a dedicated read-only transaction on 19 November 2026 before this implementation slice was designed.

### 1.1 Verified repository facts

The current Drizzle academic schema defines:

| Existing table | Current responsibility | Interoperability limitation |
|---|---|---|
| institutions | Institution UUID, slug, name, two-character country_code, website URL | No country/jurisdiction foreign key, provider identifier namespace, aliases, lifecycle state, or recognition evidence |
| faculties | Institution-scoped faculty name and slug | Assumes a fixed faculty layer |
| departments | Faculty-scoped department name and slug | Assumes every department belongs to a faculty |
| subjects | Global slug, name, description | Does not define an external classification scheme or a Cogniva KC |
| courses | Optional institution and department, required subject, local code/title, generic level, numeric credit_units | Credit value has no named credit system; generic level is ambiguous; course offering and syllabus version are not separated |
| topics | Subject-scoped topic with optional parent | Not explicitly versioned by an institution course syllabus |
| curriculum_versions | Course, version label, status, free-text source_reference, published_at | No explicit effective interval, academic period, source-record FK, review status, or programme-version context |
| course_topics | Ordered topic list for a curriculum version | No explicit source mapping or topic-to-KC mapping |
| student_profiles | Optional institution/faculty/department, programme text, numeric year_of_study, locale/time zone | Programme is free text; no qualification, jurisdiction, academic period, or preserved local stage label |

The current model is a useful initial catalogue, not a complete global academic model.

### 1.2 Repository and production migration history

The repository baseline at the time of the production audit contained Drizzle migrations 0000 through 0006:

- 0000 — identity, academic catalogue, and profile baseline.
- 0001 — self-reported institution and onboarding completion fields.
- 0002 — personal learning plans, revisions, units, concepts, tutor sessions, and messages.
- 0003 — Better Auth admin-role and session metadata.
- 0004 — AI task routes and administrative audit events.
- 0005 — AI benchmark runs, results, and reviews.
- 0006 — tutor attempt records and ownership/message constraints.

The read-only production report generated 19 November 2026 at 15:34:20 UTC confirmed all seven migrations were applied to Neon. It reported zero missing migrations, zero missing repository migration files, and zero unexpected applied migrations. The report identifies database `neondb` running PostgreSQL 18.7.

The implementation branch now adds migration 0007, `0007_global_academic_reference_foundation.sql`. This migration is repository code under review and is not included in the production audit's seven applied migrations. It has not been applied to Neon.

### 1.3 Production schema observation

The audited production database contained the nine current academic tables: institutions, faculties, departments, subjects, courses, topics, curriculum_versions, course_topics, and student_profiles. All nine were present. The audit also checked the original 27 planned Phase 1.1 target tables and found none present at that time.

The audit inspected metadata only. It did not inspect catalogue or learner rows, determine data quality, establish academic recognition, or verify the current Render application deployment.

### 1.4 Read-only production audit evidence

The manually triggered **Read-only Neon schema audit** workflow was run using the explicit AUDIT_READ_ONLY input and the DATABASE_MIGRATION_URL secret. Its script opened a PostgreSQL transaction and set it READ ONLY before querying the migration ledger and schema metadata. It did not query learner rows, credentials, email addresses, or personal data.

The workflow run and retained JSON artifact are available at:
https://github.com/Olalekanthetech1/cogniva-ai/actions/runs/44556239768

The same audit script runs in CI against disposable PostgreSQL with an assertion that every repository migration is applied. This verifies migration application in CI but is not evidence of production state.

## 2. Normative target-domain decisions

### 2.1 Country and education jurisdiction

Country and education jurisdiction are related but different concepts.

- Use ISO 3166-1 alpha-2 as the preferred external country code where applicable. Preserve alpha-3/numeric codes and historical aliases only where required by a source and a defined use case.
- Use an internal Cogniva identifier for a country record so code/name changes can be versioned without changing foreign keys.
- ISO 3166-2 subdivision identifiers may identify a location, but a province/state is not automatically an education jurisdiction.
- Model education jurisdictions independently. A jurisdiction may be national, sub-national, territorial, or another formally defined education authority boundary.
- Keep the country of study, country of residence, institution location, education jurisdiction, locale, language, and time zone separate.
- Attach qualification frameworks and competent authorities to their relevant jurisdiction and validity period.

No country or jurisdiction should be inferred from a learner's IP address, device locale, surname, or institution name.

### 2.2 Qualification frameworks and ISCED

Keep local qualifications first-class. Each local qualification/framework level retains its original code, label, descriptors, jurisdiction, version, source, and effective dates.

Maintain separate, versioned mappings for:

- ISCED-P: classification of education programmes.
- ISCED-A: classification of educational attainment.
- ISCED-F: field of education and training.

A mapping record must contain the scheme/version, code, mapping direction, rationale, evidence source, review state, confidence where a defensible method exists, reviewer, and review date. ISCED-P, ISCED-A, and ISCED-F must not share one ambiguous “level” or “subject” field.

A student's local progression index and local stage label are not an ISCED level. For example, a stage label such as “200 Level” and a numeric progression index of 2 may be preserved as local programme context; neither value alone proves the programme's ISCED level.

### 2.3 Institution identity and flexible organisational hierarchy

- Keep a stable internal institution UUID as Cogniva's record key.
- Store external identifiers in a namespaced identifier table, not in the institution primary key. Candidate namespaces include ROR and WHED Global WHED ID; additional schemes require explicit validation.
- Store aliases, transliterations, language tags, official names, and provider-specific names separately from the canonical display name.
- Replace the fixed faculty/department assumption with institution units that can represent campuses, schools, colleges, faculties, departments, institutes, centres, divisions, and institution-specific unit types.
- Each unit belongs to an institution and may have a parent unit. Validate that parent and child belong to the same institution and prevent hierarchy cycles.
- Preserve the source's original unit type/name even when Cogniva maps it to a normalized unit type.

ROR is a valuable open organisation identifier and hierarchy cross-reference, but it deliberately does not attempt to catalogue every university subdivision. It must not be treated as a complete faculty/department source or an accreditation authority.

### 2.4 Recognition, accreditation, and quality assurance

Recognition is not a boolean property of an institution.

Every recognition or accreditation decision is scoped to:

- a competent issuing authority and its jurisdiction;
- the subject of the decision: institution, campus/unit, programme, qualification, or delivery mode;
- a decision type and exact status;
- decision/reference identifier and evidence source;
- effective-from and effective-to dates, when stated;
- date Cogniva checked the evidence;
- reviewer/process and supporting rationale.

Use explicit states such as verified/current, conditional, suspended, withdrawn, expired, disputed, under review, not verified, and unknown only where they have well-defined semantics. Absence from a directory means “not found in this source”, not “unrecognised”. A negative recognition conclusion requires an explicit authoritative decision.

Use typed subject-link tables or another design that preserves database referential integrity; do not rely on an unvalidated polymorphic entity ID for recognition targets.

### 2.5 Programmes, awards, periods, courses, and syllabus versions

Separate these concepts:

- **Academic programme:** an institution-owned programme identity, with local name/code and responsible unit.
- **Programme qualification/award:** the award conferred on successful completion, with local name and jurisdiction/framework mapping.
- **Programme version:** a version of programme requirements valid for an intake/academic period.
- **Academic period:** institution-defined academic year, semester, term, trimester, block, or another named period, with local label and dates.
- **Course/module identity:** a locally issued course record. Course codes are not globally unique.
- **Programme-course requirement:** connects a programme version to a course and preserves local stage, period, order, requirement category, and credit information.
- **Course content/syllabus version:** an explicitly versioned outline with source, validity interval, topic/learning-outcome structure, and review state.

Credits require an identified credit system or unit definition. Do not compare or convert numerical credits across systems without a reviewed conversion rule and evidence.

### 2.6 Source registry and claim-level provenance

Before importing external data, register each source with:

- provider/authority identity and source type;
- authoritative domain and access method (official API, data dump, public search, licensed access, or manual evidence);
- terms URL, licence/rights basis, attribution requirement, and permitted operations;
- restrictions on retrieval, caching, storage, display, and redistribution;
- rate limits, update method, source release/version, and legal-review date.

Keep source records separate from canonical entities. Store provider record ID, source URL, observed/retrieved timestamp, publication/update date where available, source release/version, content hash, and processing state. Store full raw payloads only when the source terms permit it.

Represent factual claims as source assertions linked to a source record. An assertion should identify the subject, claim type, value, evidence, valid-time interval, retrieval time, and review/verification state. Conflicting source claims remain visible for review; the most recently fetched claim must not silently overwrite an earlier one.

### 2.7 Knowledge Components are not the academic catalogue

Cogniva's Knowledge Component (KC) graph is a separate learning-intelligence domain.

- KCs have stable Cogniva IDs and versioned definitions, objectives, scope, and subject/domain classification.
- KC relations are typed, versioned, and reviewed; prerequisite edges must be validated for cycles within a graph version.
- Course/syllabus-to-KC mappings are many-to-many and carry mapping method, evidence, provenance, confidence when supportable, and review status.
- A local subject, course code, or syllabus topic is not automatically a KC.
- ISCED-F is a programme field classification, not a KC taxonomy.
- KC mastery estimates belong to the later learning-intelligence phase and must be derived from recorded attempts/evidence, with uncertainty and model/version provenance.

The academic catalogue may be absent or incomplete while the KC graph and institution-independent learning remain usable.

## 3. Source-adapter policy and evidence roles

| Source | Allowed Phase 1.1 role | Usage boundary |
|---|---|---|
| ISO 3166-1/2 | Country and subdivision code reference | Use current code lists and maintain code lifecycle/aliases; do not equate subdivision codes with education jurisdiction |
| UNESCO UIS ISCED 2011 | Programme and attainment classification reference | Preserve the separate ISCED-P and ISCED-A mappings |
| UNESCO UIS ISCED-F 2013 | Programme field classification | Not a topic taxonomy, course catalogue, or KC hierarchy |
| UNESCO Global Inventory of National and Regional Qualifications Frameworks | Framework discovery and comparative research | Treat entries as research leads; validate a particular framework/version with its responsible authority |
| ROR | Open organisation identity, aliases, location and research-organisation hierarchy | CC0 data; research-organisation scope is not complete higher-education coverage and does not establish accreditation |
| OpenAlex | Research-oriented organisation discovery and matching | CC0 data and institution records grounded in ROR; includes non-university organisations, so classify before using |
| WHED / IAU | Higher-education reference and verification lead | IAU holds portal intellectual-property rights; copying all or substantial parts requires prior consent. No bulk copy/scrape/export without written permission or an applicable agreement |
| National/regional competent authorities | Recognition, legal status, and quality-assurance evidence | Record decision scope, status, authority, and validity; do not reduce to institution-only accreditation |
| Official institution source | Organisational units, programmes, course codes, credits, academic periods, and syllabi | Retain publication/validity dates and source provenance; an old page is not evidence of a current offering |

For Nigeria, the National Universities Commission documents programme and institutional accreditation responsibilities. Engineering programme status can also involve the relevant professional regulator, such as COREN. Cogniva must record the actual decision issuer and programme scope rather than assuming that one institution-level listing verifies every programme or professional outcome.

## 4. Repository-to-target migration map

| Existing schema | Target direction | Compatibility rule |
|---|---|---|
| institutions | Extend canonical institution identity; add identifier, alias, source assertion, location/jurisdiction links | Preserve existing UUIDs and slugs; never infer recognition from the old row |
| faculties / departments | Introduce institution_units and parent-child unit relations | Backfill only from rows actually present; retain legacy tables and IDs through compatibility period |
| subjects | Retain as a broad local subject/reference concept pending explicit semantics | Do not automatically convert subjects into KCs or ISCED-F records |
| courses | Retain as institution-scoped course identities | Preserve existing course IDs and codes; do not invent programme links or credit-system semantics |
| topics | Treat as source/local course content only when a real course/syllabus relationship exists | Do not promote topics to canonical KCs without reviewed mapping evidence |
| curriculum_versions | Evolve toward course_content_versions | Preserve version label/status; add source/validity/review metadata without overwriting legacy fields |
| course_topics | Preserve ordered syllabus-topic mappings | Add provenance/learning-outcome mappings only when supported by source |
| student_profiles.year_of_study | Add optional local stage label, progression index, period, programme and jurisdiction references | Preserve the legacy numeric value; do not infer a stage label or qualification level |
| student_profiles.programme | Migrate only when an exact catalogue programme match is verified | Keep unmatched legacy text as learner-supplied context, not a canonical programme record |

No current value should acquire a “verified” state merely because it existed in a previous Cogniva table. A legacy migration is provenance about the migration, not independent academic evidence.

## 5. Additive migration and rollback sequence

Migrations 0007 and 0008 are additive implementation slices on stacked review branches. Migration 0007 adds country/jurisdiction, qualification/classification reference, and source-provenance foundations. Migration 0008 adds institution identifiers/aliases/units, scoped recognition, programmes and versions, programme qualification links, credit systems, academic periods, versioned course content and requirements, and the initial canonical KC graph. Neither migration seeds records or rewrites existing academic/learner rows, and neither has been applied to production. The remaining migration sequence is:

1. **Baseline and backup:** save the read-only production audit report; create/confirm a recoverable Neon backup/branch according to the operator's recovery procedure.
2. **Reference foundations (migration 0007):** add countries and aliases, education jurisdictions and systems, qualification frameworks and versions, qualification levels, versioned classification schemes/codes, reviewed ISCED-P/ISCED-A mapping records, source registry/source records, typed source assertions for the initial entity kinds, and review events. The migration adds no source data.
3. **Identity and organisation (migration 0008):** add source-backed institution identifiers/aliases, a flexible same-institution unit tree, and scoped recognition authorities/decisions. Keep existing institution/faculty/department tables and IDs intact.
4. **Programme and curriculum (migration 0008):** add source-backed programmes and versions, qualification links, explicit credit systems, institution-scoped academic periods, versioned course content linked to legacy curriculum versions, and programme-course requirements. Credits are always paired with a named credit system; local stage labels/indices remain local and are not ISCED levels.
5. **Knowledge Components (migration 0008):** add stable Cogniva KC IDs, versioned definitions/objectives, typed prerequisite/part-of/related/progression/contrast relations, and evidence/review-aware course-content mappings. Accepted prerequisite cycles are rejected by a database trigger.
6. **Learner context (later migration):** add nullable jurisdiction, programme, qualification, local-stage label/index, and academic-period references. Do not require them at registration.
7. **Controlled backfill:** copy only values present in legacy records; preserve original values and map source provenance as legacy-Cogniva. Leave unsupported mappings unknown/unreviewed.
8. **Compatibility release:** dual-read or dual-write only where required; verify routes and student ownership. Keep old fields/tables available during the compatibility window.
9. **Cutover:** switch reads after reconciliation counts, constraints, and integration tests pass.
10. **Later cleanup:** remove legacy schema only in a separate reviewed change after evidence that no deployed code or retained data depends on it.

### Rollback principles

- Prefer forward-only additive migrations during the transition.
- Do not drop or rename current columns/tables in the initial interoperability migrations.
- Roll back application code to the compatibility read path if the new route fails.
- If a backfill is wrong, stop the cutover and repair/re-run it using stable IDs and an auditable mapping; do not delete original rows.
- Take and verify a backup before any production DDL.
- Test the forward migration and application rollback against a production-like PostgreSQL fixture before Neon application.
- Any destructive cleanup requires a separate plan, explicit review, and proof that the old path is no longer in use.

## 6. Required Phase 1.1 acceptance tests

Before the global catalogue is considered ready, integration tests must verify:

1. One institution can have multiple external identifiers, while an identifier value cannot be assigned to two canonical institutions under the same provider namespace without a reviewed merge/split decision.
2. The same institution name in different jurisdictions remains disambiguated by identity, not name matching alone.
3. A unit's parent belongs to the same institution; self-parenting and cycles are rejected.
4. A recognition record requires a valid authority, jurisdiction, evidence source, target scope, and valid time interval.
5. Expired, suspended, conditional, disputed, unknown, and not-found source results are not collapsed into a generic “accredited” badge.
6. ISCED-P, ISCED-A, and ISCED-F mappings cannot be substituted for one another.
7. Programme versions and syllabus versions preserve effective dates and source provenance.
8. Credit values with different or unknown systems are not silently compared or converted.
9. Cross-jurisdiction programme/course mappings retain the jurisdiction and source evidence on both sides.
10. Source assertions can coexist when sources conflict; no provider result silently overwrites a reviewed claim.
11. An absent catalogue record does not prevent an independent learner from starting a learning session.
12. Migration backfill preserves legacy IDs and values and marks unsubstantiated mappings unknown/unreviewed.

## 7. External references and legal/usage checks

- ISO 3166-1 country codes: https://www.iso.org/standard/72482.html
- ISO 3166-2 subdivision codes: https://www.iso.org/standard/72483.html
- ISO 3166 country-code maintenance and use: https://www.iso.org/iso-3166-country-codes.html
- UNESCO UIS ISCED overview and ISCED 2011: https://www.uis.unesco.org/en/methods-and-tools/isced
- UNESCO ISCED 2011 Operational Manual: https://uis.unesco.org/sites/default/files/documents/isced-2011-operational-manual-guidelines-for-classifying-national-education-programmes-and-related-qualifications-2015-en_1.pdf
- UNESCO ISCED-F 2013: https://uis.unesco.org/sites/default/files/documents/isced-fields-of-education-and-training-2013-en.pdf
- UNESCO Global Inventory of National and Regional Qualifications Frameworks: https://www.unesco.org/en/articles/latest-global-inventory-national-and-regional-qualifications-frameworks-published
- UNESCO Global Convention on recognition of higher-education qualifications: https://www.unesco.org/en/legal-affairs/global-convention-recognition-qualifications-concerning-higher-education
- ROR terms: https://ror.org/about/terms/
- ROR FAQ and scope: https://ror.org/about/faqs/
- OpenAlex institutions: https://help.openalex.org/data/institutions/
- OpenAlex API and data licensing information: https://help.openalex.org/api/
- WHED / IAU terms of use: https://whed.net/Terms_of_use.html
- WHED / IAU FAQ and access: https://whed.net/contact.html
- Nigerian Universities Commission accreditation remit: https://www.nuc.edu.ng/project/accreditation/
- COREN engineering programme accreditation reference: https://coren.gov.ng/accredited-universities/

**Implementation gate:** the production audit has been reviewed and migrations 0007/0008 are under separate, stacked PR review with isolated PostgreSQL integration coverage. Do not apply either migration to Neon until the PRs are reviewed and merged in order, a recoverable Neon backup/branch is confirmed, and explicit production migration approval is obtained. Do not enable a source adapter or import data until its terms, rights, attribution, rate limits, freshness, and failure semantics are reviewed.
