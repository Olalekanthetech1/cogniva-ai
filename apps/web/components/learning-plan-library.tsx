"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type GenerationStatus = "pending" | "running" | "succeeded" | "failed" | "unavailable";

type RevisionSummary = {
  id: string;
  revisionNumber: number;
  title: string;
  summary: string | null;
  status: string;
  generatedAt: string | null;
};

type LearningPlanSummary = {
  id: string;
  initialInput: string;
  status: string;
  generationStatus: GenerationStatus;
  updatedAt: string;
  latestRevision: RevisionSummary | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGenerationStatus(value: unknown): value is GenerationStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "unavailable"
  );
}

function parseRevisionSummary(value: unknown): RevisionSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.revisionNumber !== "number" ||
    typeof value.title !== "string" ||
    typeof value.status !== "string" ||
    !(value.summary === null || typeof value.summary === "string") ||
    !(value.generatedAt === null || typeof value.generatedAt === "string")
  ) {
    throw new Error("Cogniva returned an unexpected learning-plan revision.");
  }

  return {
    id: value.id,
    revisionNumber: value.revisionNumber,
    title: value.title,
    summary: value.summary,
    status: value.status,
    generatedAt: value.generatedAt
  };
}

function parsePlanSummary(value: unknown): LearningPlanSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.initialInput !== "string" ||
    typeof value.status !== "string" ||
    !isGenerationStatus(value.generationStatus) ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Cogniva returned an unexpected learning-plan record.");
  }

  const latestRevision =
    value.latestRevision === null
      ? null
      : parseRevisionSummary(value.latestRevision);

  return {
    id: value.id,
    initialInput: value.initialInput,
    status: value.status,
    generationStatus: value.generationStatus,
    updatedAt: value.updatedAt,
    latestRevision
  };
}

function readApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || !isRecord(payload.error)) return fallback;
  return typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
}

function generationLabel(plan: LearningPlanSummary): string {
  if (plan.generationStatus === "succeeded") {
    if (plan.latestRevision?.status === "approved") return "Learner-approved";
    if (plan.latestRevision?.status === "rejected") return "Revision rejected";
    return plan.latestRevision ? "Proposal ready" : "Revision unavailable";
  }

  switch (plan.generationStatus) {
    case "pending":
      return "Waiting to generate";
    case "running":
      return "Generating";
    case "failed":
      return "Generation failed";
    case "unavailable":
      return "Provider unavailable";
    default:
      return "Status unavailable";
  }
}

export function LearningPlanLibrary() {
  const router = useRouter();
  const [plans, setPlans] = useState<LearningPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPlans = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/learning-plans", {
      cache: "no-store",
      signal
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        readApiError(payload, "Your learning plans are unavailable right now.")
      );
    }

    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error("Cogniva returned an unexpected learning-plan list.");
    }

    return payload.data.map(parsePlanSummary);
  }, []);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      setPlans(await fetchPlans());
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Your learning plans are unavailable right now."
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchPlans]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPlans(controller.signal)
      .then((nextPlans) => {
        if (controller.signal.aborted) return;
        setPlans(nextPlans);
        setLoadError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Your learning plans are unavailable right now."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [fetchPlans]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTopic = topic.trim();
    if (!normalizedTopic || isCreating) return;

    setIsCreating(true);
    setCreateError("");

    try {
      let response: Response;
      try {
        response = await fetch("/api/v1/learning-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: normalizedTopic })
        });
      } catch {
        throw new Error(
          "Cogniva could not confirm the result. Your request may have reached the server. Refresh your library before submitting again to avoid creating a duplicate."
        );
      }

      const payload: unknown = await response.json().catch(() => null);
      const data = isRecord(payload) && isRecord(payload.data)
        ? payload.data
        : null;
      const savedPlanId = data && typeof data.id === "string"
        ? data.id
        : null;

      // Provider failures may still return the ID of the saved learner topic.
      if (savedPlanId) {
        router.push("/learn/plans/" + encodeURIComponent(savedPlanId));
        return;
      }

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "Cogniva could not create this learning plan.")
        );
      }

      throw new Error(
        "Cogniva did not return the saved plan ID. Refresh your library before trying again."
      );
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : "Cogniva could not create this learning plan. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="learning-plan-library" aria-labelledby="personal-learning-title">
      <div className="workspace-section-heading">
        <div>
          <p className="workspace-section-kicker">YOUR PERSONAL LEARNING SPACE</p>
          <h2 id="personal-learning-title">Your learning plans</h2>
        </div>
        <button
          className="learning-plan-refresh"
          type="button"
          onClick={() => void loadPlans()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="learning-plan-create-card">
        <div>
          <p className="learning-plan-kicker">START WITH A TOPIC</p>
          <h3>What would you like to learn?</h3>
          <p>
            Describe a topic. Cogniva will save it and request a structured study
            plan from the provider configured for this task.
          </p>
        </div>

        <form className="learning-plan-create-form" onSubmit={handleCreate}>
          <label className="learning-plan-field" htmlFor="learning-plan-topic">
            <span>Topic or subject area</span>
            <textarea
              id="learning-plan-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="For example: introductory fluid mechanics"
              maxLength={4000}
              rows={3}
              required
              disabled={isCreating}
            />
            <small>{topic.trim().length.toLocaleString()} / 4,000 characters</small>
          </label>

          {createError && (
            <p className="learning-plan-error" role="alert">{createError}</p>
          )}

          <button
            className="learning-plan-primary-button"
            type="submit"
            disabled={isCreating || !topic.trim()}
          >
            {isCreating ? "Saving topic and generating..." : "Create learning plan"}
          </button>
        </form>

        <p className="learning-plan-note">
          Generated content remains a proposal until you review it. If the
          configured provider is unavailable, your saved topic can still be
          retried; Cogniva does not substitute sample content.
        </p>
      </div>

      {loadError && (
        <div className="learning-plan-error" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadPlans()}>
            Try loading again
          </button>
        </div>
      )}

      {isLoading && plans.length === 0 ? (
        <p className="learning-plan-muted-state" role="status">
          Loading your saved learning plans...
        </p>
      ) : !loadError && plans.length === 0 ? (
        <div className="workspace-empty-card learning-plan-empty">
          <span className="workspace-empty-icon" aria-hidden="true">▤</span>
          <div>
            <h3>Your personal learning library is empty.</h3>
            <p>
              Plans you create will appear here with their actual generation and
              review state. No sample plans or progress are inserted.
            </p>
          </div>
        </div>
      ) : (
        <div className="learning-plan-grid">
          {plans.map((plan) => (
            <Link
              className="learning-plan-card"
              href={"/learn/plans/" + encodeURIComponent(plan.id)}
              key={plan.id}
            >
              <div className="learning-plan-card-topline">
                <span className="learning-plan-card-icon" aria-hidden="true">▤</span>
                <span className="learning-plan-status">
                  {generationLabel(plan)}
                </span>
              </div>
              <h3>{plan.latestRevision?.title ?? plan.initialInput}</h3>
              <p>
                {plan.latestRevision?.summary ??
                  (plan.generationStatus === "failed" ||
                  plan.generationStatus === "unavailable"
                    ? "Your topic is saved. A generated revision is not available yet."
                    : "Your saved topic is waiting for a generated study outline.")}
              </p>
              <span className="learning-plan-card-meta">
                {plan.latestRevision
                  ? "Revision " + plan.latestRevision.revisionNumber
                  : "Plan " + plan.status.replaceAll("_", " ")}
                {" · Updated "}{formatDate(plan.updatedAt)}
              </span>
              <span className="learning-plan-card-link">
                View plan <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
