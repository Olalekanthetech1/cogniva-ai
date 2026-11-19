# Phase 1.1b — Programme, curriculum, institutional identity and recognition implementation plan

## Scope

Implement the next additive academic-catalogue layer after the 0007 reference/provenance foundation. This is a planning/contract change only; no tables or migration are introduced by this document.

### Proposed tables and semantics

1. **Institution identifiers and aliases**
   - Stable institution UUID remains the Cogniva key.
   - Namespaced identifiers (namespace + identifier) are unique only within their namespace and retain source evidence and validity.
   - Names and aliases preserve language/script and provenance; matching never silently merges institutions.

2. **Flexible institution units**
   - Units include campus, school, college, faculty, department, institute, centre, division, or other local type.
   - Parent relationships are scoped to the same institution; hierarchy cycle validation must be enforced by service validation (and/or a database trigger with demonstrated tests).
   - Existing faculty/department rows remain intact. The new hierarchy must not silently re-parent legacy rows.

3. **Recognition and accreditation**
   - Records carry issuing authority, jurisdiction, scope (institution, unit, programme, award, delivery mode), status, effective/expiry dates, source evidence and review state.
   - Evidence and scope are mandatory for any accepted/verified presentation.
   - Missing evidence is “not found in source”/unknown—not a negative recognition decision.
   - Directory membership, institution existence, or source confidence cannot be treated as accreditation.

4. **Programme identity and versioning**
   - Programme identity is separate from programme version and award/qualification.
   - Versions preserve local names, stage labels, delivery mode, validity periods and source assertions.
   - ISCED-P/ISCED-F mapping remains a separate reviewed relationship, not inferred from programme titles.

5. **Academic periods and programme requirements**
   - Academic period definitions and actual periods are distinct; preserve local period names and sequence.
   - Requirements reference stable courses and programme versions, with requirement type (mandatory, elective, option-group), ordering and local conditions.
   - Course requirements are version-scoped and cannot be treated as universal course prerequisites.

6. **Credit systems**
   - Credit-system identity (jurisdiction/institution, name, unit/definition and source) is separate from numeric credit value.
   - Course credits retain their credit system. Conversions require a reviewed, explicit conversion rule and source; no implicit conversion.

7. **Syllabus/content versions**
   - Course identity remains stable; syllabus versions retain local content, validity, source, review and publication state.
   - Existing course topics/curriculum versions remain compatible; any migration must preserve current course and curriculum IDs and avoid auto-inference.

## Sequencing

- **1.1b-1:** Institution identifiers/aliases, flexible units, scoped recognition records.
- **1.1b-2:** Programme identity/versions, academic periods and course requirements.
- **1.1b-3:** Credit systems and course syllabus versions.
- **1.1c:** Canonical Knowledge Components, graph relations and evidence-backed mappings.

Each sub-slice must be additive, test migrations on ephemeral PostgreSQL, test source provenance and scoping constraints, update the Drizzle schema/snapshot/journal and docs in the same PR, and pass lint, typecheck and build. No live catalogue data ingestion is part of schema work.

## Production boundary

Phase 1.1a migration 0007 is still awaiting review and has not been applied to Neon. This document introduces no DDL, seed data, source adapter, deployment or production write. The subsequent schema PRs must reconcile the Neon migration state before any apply workflow is run.
