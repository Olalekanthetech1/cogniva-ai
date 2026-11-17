# Cogniva — Global Academic Architecture

**Status:** Proposed architecture for review; this document is not a claim that global catalogue ingestion or the target schema has been implemented.  
**Decision:** Cogniva is a global learning platform from its first production release. Nigeria is an initial user context, not the product's data model.

## 1. Product and architecture decision

Cogniva must support learners across countries, education systems, institution types, qualification frameworks, languages, and academic calendars without assuming that any one country's terminology or course structure is universal.

The architecture separates three concerns:

1. **Student academic context** — the student's current learning situation, which can be incomplete or institution-independent.
2. **Academic reference catalogue** — sourced, versioned information about jurisdictions, institutions, organisational units, programmes, courses, and curricula.
3. **Cogniva learning intelligence** — knowledge components, prerequisites, practice, attempts, evidence, and mastery. This layer must work even when catalogue data is missing.

The academic catalogue provides context to the learning engine; it must not be a gate that prevents a student from using Cogniva.

## 2. Global classification standards

Use international standards as interoperability references, not as replacements for local academic language.

### 2.1 Countries and territories

- Use ISO 3166-1 alpha-2 country codes as the canonical country identifier where applicable.
- Keep the student's country of study, the institution's country, locale, language, and time zone as distinct concepts. Do not infer one from another.
- Keep a country/jurisdiction reference versioned and maintain aliases where needed.
- Do not model the world as only the set of current sovereign states; education jurisdictions and territories may need separate representation.

ISO 3166-1 is the relevant country-code reference. The ISO catalogue currently identifies the 2020 edition as confirmed following its 2025 review.

### 2.2 Education programme level and field

Use UNESCO's:
- **ISCED 2011** to map formal education programmes and related qualifications to internationally comparable education levels.
- **ISCED-F 2013** to classify fields of education and training.

Important distinctions:
- ISCED-P classifies education programmes.
- ISCED-A classifies educational attainment.
- ISCED level is not the same thing as a student's current year of study.
- ISCED-F subject fields classify the broad/narrow/detailed field of a programme; they are not a knowledge-component or prerequisite taxonomy.

Store the local qualification name and local stage alongside any ISCED mapping. Mappings should be versioned and retain their source and review status. A mapping must be marked unknown or under review when evidence is insufficient; do not infer it solely from a programme title.

### 2.3 Local academic structures remain first-class

Cogniva must preserve what a student and institution actually call an academic stage, term, credit or qualification.

Examples of local stage labels include:
- Nigeria: 100 Level, 200 Level, 300 Level.
- United Kingdom: Year 1, Year 2, Year 3.
- United States: Freshman, Sophomore, Junior, Senior.

These are display examples, not a claim that every institution in those countries follows the same pattern. A university can use a different duration or terminology.

Keep at least these values separate:
- numeric progression within a programme (for example, year index 2);
- original local label (for example, `200 Level`);
- qualification/programme level (for example, bachelor's or equivalent);
- academic period (year, semester, term, trimester, block, or institution-defined period).

Never store "200 Level" as the international qualification level.

## 3. Global catalogue: source strategy

There is no single global source that can be treated as a complete and current catalogue of every recognised university, every programme, every course, and every syllabus. Cogniva should use source adapters and keep the authority of each source explicit.

### 3.1 Institution discovery and identity

**Research Organization Registry (ROR)**
- Use ROR as an open source of persistent identifiers and organisation metadata.
- It is useful for name disambiguation, country/location metadata, aliases, and organisational relationships.
- ROR data is CC0 and available through its API and data dump.
- ROR's scope is organisations involved in scholarly research. Absence from ROR does not mean that an institution is invalid, and presence in ROR does not prove that the organisation is authorised to award a particular qualification.

**OpenAlex**
- Use OpenAlex as an optional discovery and matching source, especially for research-active institutions.
- OpenAlex institution metadata is grounded in ROR and includes organisation types and hierarchy.
- OpenAlex includes companies, hospitals, government bodies and other research organisations as well as education organisations. Filter and classify carefully.
- Do not use OpenAlex presence as proof of educational accreditation or degree-awarding authority.

**World Higher Education Database (WHED / IAU)**
- Use WHED as a higher-education reference and verification lead.
- The public portal supports basic institution search and country education-system information. Advanced access is presented through MyWHED / IAU access.
- Before bulk import or redistribution, confirm IAU access terms, data licensing, update arrangements, and permitted use. Do not scrape or assume a public API/bulk export exists.

### 3.2 Recognition and accreditation

For recognition claims, prioritise the responsible official national or regional quality-assurance/accreditation authority and the institution's official records.

A recognition record must identify:
- issuing authority/regulator;
- jurisdiction;
- subject of the decision (institution, campus, programme, qualification, or delivery mode);
- status and scope;
- source URL or document reference;
- effective date and expiry/review date, where available;
- date Cogniva checked the evidence;
- reviewer or verification process.

Keep **institution identity** separate from **recognition status**. Recognition is time-, jurisdiction-, programme- and sometimes campus-specific. A directory entry or research registry record is not accreditation evidence.

Use controlled states such as `verified`, `not_verified`, `under_review`, `expired`, and `disputed`. Never display a verification badge when evidence is absent or stale.

### 3.3 Programmes, courses and curricula

The preferred source is the institution's official programme page, handbook, course catalogue, approved syllabus, or published curriculum document. National qualification-framework and regulator documents can provide context, but they do not automatically establish a specific university's current course offering.

For every imported or curated record, retain its provenance and academic validity period. Course titles, codes, credit systems, levels, semesters, and prerequisites vary across institutions and may change each academic year.

Credit units must include their system/meaning (for example, institution-defined units or ECTS). Do not compare or convert credit totals unless an explicit, defensible conversion rule exists.

### 3.4 Source priority and provenance

Recommended source priority depends on the claim being made:

| Claim | Preferred evidence |
|---|---|
| Institution identity and name | Institution's official record; ROR/WHED as cross-reference |
| Legal recognition/accreditation | Responsible official regulator or quality-assurance body |
| Faculty/department/unit structure | Institution's official website or handbook |
| Programme and award | Official programme specification and regulator/framework evidence where relevant |
| Course code, title, units, semester | Official current course catalogue/handbook/syllabus |
| Subject-field classification | UNESCO ISCED-F mapping with documented rationale |
| Programme level | Official qualification evidence mapped to ISCED-P with review |
| Research organisation disambiguation | ROR; OpenAlex as a discovery aid |

Every record imported from an external source should capture, where available:
- source name and source record ID;
- original source URL;
- retrieval timestamp;
- source publication/update date;
- evidence type;
- verification status and verifier/reviewer;
- validity period;
- mapping confidence and review notes;
- last verification date and next review date.

Do not overwrite original provider values silently. Preserve the local canonical record and its source assertions separately. Resolve conflicts through a review workflow, not by choosing whichever provider responded last.

## 4. Proposed domain model

The current production schema is an initial foundation. It is not yet the final global model. The following is the target conceptual model; names may change after schema and migration review.

### 4.1 Jurisdictions and education systems

- `countries` — ISO alpha-2 code, names, aliases, and lifecycle metadata.
- `education_jurisdictions` — the jurisdiction responsible for an education system or qualification framework. It may be a country, sub-national authority, or other recognised jurisdiction.
- `education_systems` — named national/regional systems and their source references.
- `qualification_frameworks` — national/regional frameworks, version and source.
- `qualification_levels` — local level names and their mapping to ISCED-P/ISCED-A where evidence supports it.
- `classification_schemes` and `classification_codes` — versioned schemes such as ISCED 2011 and ISCED-F 2013.

A country can have multiple systems/frameworks, and a student can study in a jurisdiction different from their residence. Avoid a single global `country -> university -> four-year degree` assumption.

### 4.2 Institutions and organisational units

- `institutions` — canonical identity, country/jurisdiction, official website, institution type, lifecycle status.
- `institution_identifiers` — external identifiers such as ROR and WHED Global WHED ID, namespaced by provider.
- `institution_aliases` — alternate names, abbreviations, transliterations and language.
- `institution_units` — flexible tree of campuses, schools, colleges, faculties, departments, divisions and other units. Parent-child relationships are institution-specific; not every institution uses a faculty/department hierarchy.
- `recognition_records` — separate evidence-backed recognition/accreditation claims at the institution, campus, programme or qualification scope.

Do not treat a ROR record as an institution accreditation record.

### 4.3 Programmes, qualifications and curriculum versions

- `academic_programmes` — a named programme offered by an institution, linked to an award/qualification, owning unit, local code, field classification and official source.
- `programme_qualifications` — qualification/award name and jurisdiction/framework mapping.
- `programme_versions` — the programme requirements and structure valid for an academic period.
- `academic_periods` — institution-defined academic year, semester, term, trimester, block or other period.
- `courses` — reusable institution-scoped course/module identity, with local code and title.
- `programme_course_requirements` — connects a programme version to courses, with year/stage, period, ordering, credits and requirement type.
- `course_content_versions` — versioned course outline/syllabus and its topic/learning-objective mapping.

A course code is not globally unique. Uniqueness should be scoped to the issuing institution and relevant catalogue/version context. Programme curriculum structure must not be confused with an individual course's topic outline.

### 4.4 Student academic context

Student academic details should remain optional and progressively completable.

The profile should distinguish:
- institution and selected campus/unit, if known;
- country/jurisdiction of study;
- programme and qualification;
- numeric year/progression index;
- original local stage label;
- academic period;
- preferred language/locale and time zone;
- institution-independent learning context.

A student must be able to:
- select a verified catalogue record;
- report an institution that is not yet listed, clearly marked as unverified/pending review;
- continue without an institution;
- define a self-directed learning goal;
- add a syllabus/course outline for a learning task.

An unverified institution entered by a student must not be inserted automatically into the verified public catalogue.

### 4.5 Source and import model

Introduce a source registry and record-level source assertions before enabling bulk ingestion:
- `catalogue_sources` — provider/authority identity, source type, terms/usage notes, update mechanism, and active status.
- `catalogue_source_records` — external record ID, source URL, retrieved timestamp, provider payload version/hash and processing state.
- `entity_source_assertions` — the individual facts a source asserts about an institution/programme/course, their provenance and verification status.
- `catalogue_review_events` — human review, corrections, merge/split decisions and rationale.

The implementation must review the provider's licence and terms before storing or redistributing source data. Publicly searchable information is not automatically free to bulk copy or redistribute.

## 5. Student-facing onboarding and learning entry

The current multi-field onboarding form is an interim implementation, not the intended first-run experience. Cogniva should minimise registration friction and let students begin learning before asking for a complete academic profile.

### 5.1 One optional institution question

After account creation and required email verification, show one optional question:

**Which institution do you attend?**

- Provide a searchable global institution selector.
- Display the institution's country beside each result to disambiguate similar names.
- Search only against records actually available from the catalogue; an empty or unavailable catalogue must be shown honestly.
- Allow the student to say **My institution isn't listed** and optionally enter its name as self-reported information.
- Allow **I'm an independent learner** or **Skip for now**.
- Do not require a separate country form at this stage. Do not infer the student's country from IP address, device locale or institution name.
- Do not request faculty, department, programme, qualification, academic stage, semester or credit system during first-run onboarding.

A catalogue match may be shown as verified only when the institution identity and the relevant verification evidence support that status. A user-entered institution name is self-reported and unverified; it must not be inserted into the verified catalogue automatically.

The institution question is for personalisation, not access control. All paths lead to the same learning home. An independent learner or a student whose institution is absent must have the same ability to start a learning session.

### 5.2 Progressive academic context

Ask for additional academic details only when they materially improve a task. For example, a student may later attach a course outline, choose a programme, or add a local year-of-study label in Profile or while organising a course.

Keep the underlying global data model capable of representing country/jurisdiction, programme, qualification, local academic stage, academic period, language and time zone. These are optional context fields, not mandatory registration steps. Preserve the distinction between a local label such as 200 Level and an internationally mapped qualification level.

### 5.3 Move directly into learning

Immediately after the optional institution question is completed or skipped, direct the learner to the Home experience defined in [PRODUCT_EXPERIENCE.md](PRODUCT_EXPERIENCE.md). The primary entry point is:

**What would you like to learn?**

A learner should be able to start with a question, a problem, or a topic. Upload and subject-exploration actions should appear only when their corresponding capability and data source are implemented and available.

Course outlines and Knowledge Components may be proposed from actual student-provided content or a verified source. Proposals must be labelled as proposals and remain reviewable and editable by the learner. Never present a generated outline as an official institution curriculum without supporting evidence.

## 6. Cogniva Knowledge Components and adaptive learning

The CampusLearn/Sizzle-inspired capability is a core Cogniva feature, but it must be implemented as Cogniva's own learning engine, not as an external dependency or copied proprietary implementation.

Keep the learning model separate from the institution catalogue:

- `knowledge_components` — canonical learnable concepts/skills with stable Cogniva IDs, definitions, learning objectives and subject/domain labels.
- `knowledge_component_relations` — prerequisite, part-of, related-to and progression edges; relationships are versioned and reviewed.
- `course_knowledge_component_mappings` — connects an institution's course/content version to one or more Cogniva KCs, with source, confidence, mapping method and review status.
- `learning_activities` — practice, explanation, worked example, retrieval exercise or assessment targeting one or more KCs.
- `student_attempts` and `assessment_evidence` — timestamped evidence of what the learner attempted and how it was evaluated.
- `student_knowledge_estimates` — derived mastery estimate, uncertainty, evidence window and model/version. Never store a naked percentage without evidence context.

A single KC may map to multiple courses and different local curricula. Local course topics should not create duplicate KCs merely because their labels differ. Conversely, similarly named topics must not be merged without confirming that their learning objectives are equivalent.

ISCED-F is a programme subject-field classification, not the KC hierarchy. Cogniva's KC taxonomy must be purpose-built and independently versioned.

The adaptive loop should be:

1. Resolve the learner's goal/course context and available evidence.
2. Identify relevant KCs and prerequisite relationships.
3. Diagnose existing understanding using a suitable question or activity.
4. Teach one concept or step at a time through the Socratic tutor.
5. Capture the learner's actual attempt before evaluation.
6. Update estimates only from recorded evidence, with uncertainty.
7. Recommend advancement, reinforcement or prerequisite review.
8. Explain why the next activity is recommended.

The tutor and adaptive engine share KC IDs and evidence contracts. The tutor remains responsible for explanations and dialogue; the adaptive engine selects and sequences learning activities. A language model's claim that a student has mastered a concept is not sufficient evidence by itself.

## 7. Global catalogue and ZeroMock operating rules

- No invented institutions, faculties, departments, programmes, course codes, course units, accreditation states or curriculum versions.
- External provider search results are candidates until identity and source claims are reconciled.
- An empty catalogue is a valid state. Offer an institution-independent learning path rather than populating it with samples.
- Do not display "verified" without evidence, scope and a current verification timestamp.
- Distinguish `unknown`, `not listed`, `not verified`, `under review`, `expired` and `not recognised`; these states are not interchangeable.
- Do not infer accreditation from inclusion in ROR, OpenAlex or a general directory.
- Keep source URL, capture time and review history for material academic claims.
- Do not assert a programme's curriculum is current without a source-validity date.
- External retrieval failures must be visible as unavailable/error states, not replaced by canned catalogue results.
- Catalogue ingestion must be idempotent, rate-limited and auditable.
- Merging institutions requires identifier and hierarchy review; names alone are insufficient.
- Students may use uploaded course material without treating it as a verified institutional curriculum.

## 8. Source connector strategy

Implement providers as replaceable adapters, not direct dependencies inside student-facing pages.

Recommended initial connector roles:

| Provider/source | Intended role | Must not be used as |
|---|---|---|
| ISO 3166 | Country-code reference | Education-system or accreditation source |
| UNESCO ISCED 2011 / ISCED-F 2013 | Cross-country programme-level and subject-field mappings | Student year-of-study or KC taxonomy |
| ROR | Open organisation identity and hierarchy cross-reference | Complete university directory or accreditation authority |
| OpenAlex | Institution discovery and research metadata matching | Accreditation or full programme/course catalogue |
| WHED / IAU | Higher-education reference and recognition leads | Assumed unrestricted bulk data/API without confirming terms |
| National/regional regulators | Recognition and quality-assurance evidence | Complete course/syllabus source |
| Official institution websites and handbooks | Programme, course, credit and curriculum evidence | Automatically current after their stated validity period |

Each adapter should have explicit capabilities, rate limits, attribution/terms, fields returned, freshness policy and failure semantics. Bulk import is a separate job from user search and should be introduced only after legal/terms review, schema validation, deduplication and a rollback plan.

## 9. Migration strategy from the current schema

The current schema includes `institutions`, `faculties`, `departments`, `subjects`, `courses`, `topics`, `curriculum_versions`, `course_topics` and `student_profiles`. The initial deployed catalogue is empty.

Do not perform an immediate destructive rewrite. Before migrations:

1. Inspect the applied migration and production table state.
2. Define stable semantics and keys for the target entities.
3. Determine which current tables can be extended and which need successor tables.
4. Preserve a compatibility path for the deployed student profile and existing routes.
5. Generate and review additive migrations first; avoid dropping columns/tables until the data migration and rollback strategy are tested.
6. Add integration tests for foreign-key scope, student ownership, invalid cross-institution references and source provenance.
7. Test with isolated fixtures in CI; never seed fabricated catalogue data into production.

Potential changes to evaluate:
- extend institution metadata with jurisdiction, canonical URL, lifecycle state and provider identifiers;
- replace rigid faculty/department-only organisation hierarchy with institution units;
- add programmes, programme versions, academic periods and programme-course requirements;
- distinguish a course's institutional identity from its versioned syllabus;
- add source/provenance/recognition tables;
- add student local-stage label and country/jurisdiction fields without confusing them with numeric progression;
- introduce KCs and course-to-KC mappings as their own domain.

Exact SQL, migration order and compatibility views are intentionally deferred until the design review and schema audit are complete.

## 10. Delivery sequence and exit criteria

### 1. Global academic model
- Approve entity semantics, identifiers, relationships, source trust and local label handling.
- Review current schema and produce a migration map.
- Exit: no ambiguity between organisation identity, recognition, programme, course, course syllabus, local stage, ISCED mapping and KC.

### 2. Source and verification foundation
- Implement source registry, provider adapters and evidence review states.
- Pilot institution search and verify source attribution and freshness.
- Exit: a candidate result can be traced to source; unverified data cannot be presented as verified.

### 3. Student academic context
- Update onboarding to global progressive disclosure.
- Support listed, not-listed and independent-learning paths.
- Exit: students can complete setup without an institution; country-specific labels are not applied without an identified education system.

### 4. Global catalogue and programme curricula
- Add institution units, programmes, programme versions, courses and curriculum source evidence.
- Begin country-by-country/source-by-source coverage based on data rights and quality, not a Nigeria-only seed.
- Exit: every active catalogue item has provenance and explicit verification state.

### 5. Knowledge Components and adaptive learning
- Implement the KC graph and mappings to course/syllabus versions.
- Capture attempts and assessment evidence.
- Add uncertain mastery estimates and explainable recommendations.
- Exit: adaptive decisions can be traced to learning evidence and KC mappings.

## 11. External references

- UNESCO Institute for Statistics, ISCED 2011: https://uis.unesco.org/sites/default/files/documents/international-standard-classification-of-education-isced-2011-en.pdf
- UNESCO Institute for Statistics, ISCED Fields of Education and Training 2013: https://uis.unesco.org/sites/default/files/documents/isced-fields-of-education-and-training-2013-en.pdf
- ISO 3166-1: https://www.iso.org/standard/72482.html
- Research Organization Registry (scope, data and access): https://ror.org/registry
- ROR FAQ and API information: https://ror.org/about/faqs/
- OpenAlex Institutions: https://help.openalex.org/data/institutions/
- OpenAlex API reference: https://help.openalex.org/api/
- IAU World Higher Education Database: https://whed.net/home.php
- WHED portal access/FAQ: https://whed.net/Contact.html

**Architecture rule:** Global support is a property of Cogniva's data model and learning engine, not a claim that every country's catalogue has already been populated.
