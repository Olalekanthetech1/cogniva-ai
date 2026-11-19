"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GenerationStatus = "pending" | "running" | "succeeded" | "failed" | "unavailable";

type PlanConcept = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  position: number;
};

type PlanObjective = {
  id: string;
  statement: string;
  position: number;
};

type PlanUnit = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  objectives: PlanObjective[];
  concepts: PlanConcept[];
};

type PlanRelationship = {
  id: string;
  sourceConcept: string | null;
  targetConcept: string | null;
  type: string;
  reviewStatus: string;
};

type PlanRevision = {
  id: string;
  revisionNumber: number;
  title: string;
  summary: string | null;
  status: string;
  generatedAt: string | null;
  concepts: PlanConcept[];
  relationships: PlanRelationship[];
  units: PlanUnit[];
};

type PlanDetail = {
  id: string;
  intent: string;
  initialInput: string;
  status: string;
  generationStatus: GenerationStatus;
  selectedRevision: PlanRevision | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error("Cogniva returned an incomplete " + label + ".");
  }
  return value;
}

function parseConcept(value: unknown): PlanConcept {
  if (!isRecord(value) || typeof value.position !== "number") {
    throw new Error("Cogniva returned an invalid concept in this plan.");
  }

  return {
    id: requiredString(value.id, "concept"),
    name: requiredString(value.name, "concept name"),
    kind: requiredString(value.kind, "concept kind"),
    description: value.description === null || typeof value.description === "string"
      ? value.description
      : null,
    position: value.position
  };
}

function parseRevision(value: unknown): PlanRevision {
  if (
    !isRecord(value) ||
    typeof value.revisionNumber !== "number" ||
    !Array.isArray(value.concepts) ||
    !Array.isArray(value.relationships) ||
    !Array.isArray(value.units)
  ) {
    throw new Error("Cogniva returned an incomplete learning-plan revision.");
  }

  const relationships = value.relationships.map((item): PlanRelationship => {
    if (!isRecord(item)) {
      throw new Error("Cogniva returned an invalid proposed relationship.");
    }

    return {
      id: requiredString(item.id, "relationship"),
      sourceConcept: item.sourceConcept === null || typeof item.sourceConcept === "string"
        ? item.sourceConcept
        : null,
      targetConcept: item.targetConcept === null || typeof item.targetConcept === "string"
        ? item.targetConcept
        : null,
      type: requiredString(item.type, "relationship type"),
      reviewStatus: requiredString(item.reviewStatus, "relationship review state")
    };
  });

  const units = value.units.map((item): PlanUnit => {
    if (
      !isRecord(item) ||
      typeof item.position !== "number" ||
      !Array.isArray(item.objectives) ||
      !Array.isArray(item.concepts)
    ) {
      throw new Error("Cogniva returned an invalid learning unit.");
    }

    const objectives = item.objectives.map((objective): PlanObjective => {
      if (!isRecord(objective) || typeof objective.position !== "number") {
        throw new Error("Cogniva returned an invalid learning objective.");
      }

      return {
        id: requiredString(objective.id, "objective"),
        statement: requiredString(objective.statement, "objective statement"),
        position: objective.position
      };
    });

    return {
      id: requiredString(item.id, "learning unit"),
      title: requiredString(item.title, "unit title"),
      description: item.description === null || typeof item.description === "string"
        ? item.description
        : null,
      position: item.position,
      objectives,
      concepts: item.concepts.map(parseConcept)
    };
  });

  return {
    id: requiredString(value.id, "revision"),
    revisionNumber: value.revisionNumber,
    title: requiredString(value.title, "plan title"),
    summary: value.summary === null || typeof value.summary === "string"
      ? value.summary
      : null,
    status: requiredString(value.status, "revision status"),
    generatedAt: value.generatedAt === null || typeof value.generatedAt === "string"
      ? value.generatedAt
      : null,
    concepts: value.concepts.map(parseConcept),
    relationships,
    units
  };
}

function parsePlanDetail(value: unknown): PlanDetail {
  if (
    !isRecord(value) ||
    !(
      value.generationStatus === "pending" ||
      value.generationStatus === "running" ||
      value.generationStatus === "succeeded" ||
      value.generationStatus === "failed" ||
      value.generationStatus === "unavailable"
    )
  ) {
    throw new Error("Cogniva returned an invalid learning plan.");
  }

  return {
    id: requiredString(value.id, "learning plan"),
    intent: requiredString(value.intent, "learning intent"),
    initialInput: requiredString(value.initialInput, "saved topic"),
    status: requiredString(value.status, "plan status"),
    generationStatus: value.generationStatus,
    selectedRevision: value.selectedRevision === null
      ? null
      : parseRevision(value.selectedRevision)
  };
}

function readApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || !isRecord(payload.error)) return fallback;
  return typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

function stateLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

export function LearningPlanDetail({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const loadPlan = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(
        "/api/v1/learning-plans/" + encodeURIComponent(planId),
        { cache: "no-store", signal }
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "This learning plan is unavailable right now.")
        );
      }

      if (!isRecord(payload) || !isRecord(payload.data)) {
        throw new Error("Cogniva returned an unexpected learning-plan response.");
      }

      const nextPlan = parsePlanDetail(payload.data);
      if (!signal?.aborted) {
        setPlan(nextPlan);
        setLoadError("");
      }
    } catch (cause) {
      if (signal?.aborted) return;
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "This learning plan is unavailable right now."
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPlan(controller.signal);
    return () => controller.abort();
  }, [loadPlan]);

  async function refreshPlan() {
    setIsLoading(true);
    setLoadError("");
    await loadPlan();
  }

  async function handleRetry() {
    if (!plan || isRetrying) return;
    setIsRetrying(true);
    setRetryError("");

    try {
      const response = await fetch(
        "/api/v1/learning-plans/" + encodeURIComponent(plan.id) + "/generate",
        { method: "POST" }
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "Cogniva could not retry plan generation.")
        );
      }

      await refreshPlan();
    } catch (cause) {
      setRetryError(
        cause instanceof Error
          ? cause.message
          : "Cogniva could not confirm the retry result. Refresh the plan state."
      );
      await refreshPlan();
    } finally {
      setIsRetrying(false);
    }
  }

  if (isLoading && !plan) {
    return (
      <p className="learning-plan-muted-state" role="status">
        Loading your saved learning plan...
      </p>
    );
  }

  if (loadError && !plan) {
    return (
      <div className="learning-plan-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => void refreshPlan()}>
          Try loading again
        </button>
      </div>
    );
  }

  if (!plan) return null;

  const revision = plan.selectedRevision;
  const canRetry =
    plan.generationStatus === "pending" ||
    plan.generationStatus === "failed" ||
    plan.generationStatus === "unavailable";

  return (
    <div className="learning-plan-detail">
      <div className="learning-plan-detail-meta">
        <span className="learning-plan-status">
          Generation: {stateLabel(plan.generationStatus)}
        </span>
        <span className="learning-plan-status learning-plan-status-neutral">
          Plan: {stateLabel(plan.status)}
        </span>
      </div>

      {loadError && (
        <p className="learning-plan-error" role="alert">{loadError}</p>
      )}

      {!revision ? (
        <section className="learning-plan-retry-card">
          <p className="learning-plan-kicker">SAVED LEARNING TOPIC</p>
          <h2>{plan.initialInput}</h2>
          <p>
            {plan.generationStatus === "running"
              ? "A generation request is currently in progress. Refresh this page to check its state."
              : plan.generationStatus === "pending"
                ? "Your topic is saved, but a generated study outline is not available yet."
                : plan.generationStatus === "succeeded"
                  ? "The plan is marked as generated, but no revision was returned for display. Refresh the plan or contact support if this continues."
                  : "Cogniva could not produce a study outline. Your original topic remains saved; no sample plan was substituted."}
          </p>
          {retryError && (
            <p className="learning-plan-error" role="alert">{retryError}</p>
          )}
          <div className="learning-plan-action-row">
            {canRetry ? (
              <button
                className="learning-plan-primary-button"
                type="button"
                onClick={() => void handleRetry()}
                disabled={isRetrying}
              >
                {isRetrying ? "Retrying generation..." : "Retry generation"}
              </button>
            ) : (
              <button
                className="learning-plan-secondary-button"
                type="button"
                onClick={() => void refreshPlan()}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh status"}
              </button>
            )}
            <Link className="learning-plan-text-link" href="/learn">
              Back to your library
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="learning-plan-proposal-header">
            <p className="learning-plan-kicker">
              PROPOSED PERSONAL LEARNING PLAN · REVISION {revision.revisionNumber}
            </p>
            <h2>{revision.title}</h2>
            {revision.summary && <p>{revision.summary}</p>}
            <div className="learning-plan-detail-meta">
              <span className="learning-plan-status">
                Revision: {stateLabel(revision.status)}
              </span>
              <span className="learning-plan-detail-date">
                Generated {formatDate(revision.generatedAt)}
              </span>
            </div>
            {revision.status === "proposed" && (
              <p className="learning-plan-note">
                This is a generated proposal, not an approved study plan or an
                official university syllabus. Editing, relationship review and
                approval controls are not available in this release.
              </p>
            )}
          </section>

          <section className="learning-plan-units-section" aria-labelledby="learning-plan-units-title">
            <div className="workspace-section-heading">
              <div>
                <p className="workspace-section-kicker">SUGGESTED STUDY ORDER</p>
                <h2 id="learning-plan-units-title">Learning units</h2>
              </div>
            </div>

            {revision.units.length > 0 ? (
              <ol className="learning-plan-unit-list">
                {revision.units.map((unit) => (
                  <li className="learning-plan-unit-card" key={unit.id}>
                    <span className="learning-plan-unit-number">
                      {unit.position.toString().padStart(2, "0")}
                    </span>
                    <div className="learning-plan-unit-content">
                      <h3>{unit.title}</h3>
                      {unit.description && <p>{unit.description}</p>}

                      {unit.objectives.length > 0 && (
                        <div className="learning-plan-subsection">
                          <h4>Learning objectives</h4>
                          <ul>
                            {unit.objectives.map((objective) => (
                              <li key={objective.id}>{objective.statement}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {unit.concepts.length > 0 && (
                        <div className="learning-plan-concept-tags" aria-label="Concepts in this unit">
                          {unit.concepts.map((concept) => (
                            <span key={concept.id}>{concept.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="workspace-empty-card">
                <div>
                  <h3>No units were returned for this revision.</h3>
                  <p>The saved revision does not contain any learning units to display.</p>
                </div>
              </div>
            )}
          </section>

          {revision.concepts.length > 0 && (
            <section className="learning-plan-concepts-section" aria-labelledby="learning-plan-concepts-title">
              <div className="workspace-section-heading">
                <div>
                  <p className="workspace-section-kicker">PLAN-SCOPED CONTENT</p>
                  <h2 id="learning-plan-concepts-title">Concepts and skills</h2>
                </div>
              </div>
              <div className="learning-plan-concept-grid">
                {revision.concepts.map((concept) => (
                  <article className="learning-plan-concept-card" key={concept.id}>
                    <span>{stateLabel(concept.kind)}</span>
                    <h3>{concept.name}</h3>
                    {concept.description && <p>{concept.description}</p>}
                  </article>
                ))}
              </div>
              <p className="learning-plan-note">
                These labels belong to this generated plan. They are not yet
                canonical Cogniva Knowledge Components or verified syllabus
                mappings.
              </p>
            </section>
          )}

          {revision.relationships.length > 0 && (
            <section className="learning-plan-relations-section" aria-labelledby="learning-plan-relations-title">
              <div className="workspace-section-heading">
                <div>
                  <p className="workspace-section-kicker">SUGGESTED CONNECTIONS</p>
                  <h2 id="learning-plan-relations-title">Concept relationships</h2>
                </div>
              </div>
              <ul className="learning-plan-relation-list">
                {revision.relationships.map((relationship) => (
                  <li key={relationship.id}>
                    <span>
                      {relationship.sourceConcept ?? "Unresolved concept"}
                    </span>
                    <span aria-hidden="true">→</span>
                    <span>
                      {relationship.targetConcept ?? "Unresolved concept"}
                    </span>
                    <small>
                      {stateLabel(relationship.type)} · {stateLabel(relationship.reviewStatus)}
                    </small>
                  </li>
                ))}
              </ul>
              <p className="learning-plan-note">
                Relationship suggestions are generated content. They have not
                been independently verified or approved.
              </p>
            </section>
          )}
        </>
      )}

      <div className="learning-plan-detail-footer">
        <Link className="learning-plan-text-link" href="/learn">
          ← Back to your learning plans
        </Link>
        <Link className="learning-plan-text-link" href="/tutor">
          Open Tutor for a direct question
        </Link>
      </div>
    </div>
  );
}
