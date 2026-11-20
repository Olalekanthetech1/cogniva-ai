"use client";

import { useState } from "react";
import type { AiTaskKey } from "@/lib/admin-ai-config";

type TaskRoutingMode = "pinned" | "adaptive";

type TaskRoutingReadiness = {
  ready: boolean;
  eligibleCandidateCount: number;
  totalCandidateCount: number;
  exclusionCounts: Record<string, number>;
  selectedCandidate: {
    provider: "gemini" | "groq" | "mistral";
    modelId: string;
    priority: number;
    lastTestLatencyMs: number | null;
  } | null;
  message: string;
};

type RoutingSnapshot = {
  tasks: Array<{
    id: AiTaskKey;
    label: string;
    mode: TaskRoutingMode;
    updatedAt: string;
    readiness: TaskRoutingReadiness;
  }>;
};

type Feedback = { task: AiTaskKey; kind: "success" | "error"; message: string } | null;

export function AiTaskRoutingSettingsEditor({
  initialSettings
}: {
  initialSettings: RoutingSnapshot;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingTask, setSavingTask] = useState<AiTaskKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function setMode(task: AiTaskKey, mode: TaskRoutingMode) {
    const current = settings.tasks.find((item) => item.id === task);
    if (!current || current.mode === mode) return;
    if (mode === "adaptive" && !current.readiness.ready) return;

    setSavingTask(task);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, mode })
      });
      const payload = await response.json().catch(() => null) as
        | { data?: RoutingSnapshot; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "The task routing mode could not be saved.");
      }

      setSettings(payload.data);
      setFeedback({
        task,
        kind: "success",
        message: mode === "adaptive"
          ? "Adaptive mode is saved. Every learner request will be rechecked against its actual prompt and current candidate readiness."
          : "Pinned mode is restored. New requests use the saved legacy provider/model route."
      });
    } catch (error) {
      setFeedback({
        task,
        kind: "error",
        message: error instanceof Error ? error.message : "The task routing mode could not be saved."
      });
    } finally {
      setSavingTask(null);
    }
  }

  return (
    <section className="admin-section" aria-labelledby="adaptive-routing-controls-title">
      <div className="admin-section-heading">
        <h2 id="adaptive-routing-controls-title">Adaptive routing rollout</h2>
        <span>Persisted per task · administrator controlled</span>
      </div>

      <div className="admin-notice admin-routing-boundary">
        <strong>Adaptive mode is never enabled by model registration alone</strong>
        <span>
          Enabling a task requires at least one model that is enabled, assigned to this task,
          successfully tested using its exact model ID, backed by reviewed HTTPS capability
          evidence, large enough for the task readiness budget, and backed by a configured
          server credential. Actual prompts are checked again at request time. There is no
          silent provider switch or pinned-route fallback after adaptive selection.
        </span>
      </div>

      <div className="admin-routing-task-grid">
        {settings.tasks.map((task) => {
          const isSaving = savingTask === task.id;
          const readiness = task.readiness;
          const selected = readiness.selectedCandidate;

          return (
            <article className="admin-task-card admin-routing-task-card" key={task.id}>
              <div className="admin-task-heading">
                <div>
                  <h3>{task.label}</h3>
                  <p>
                    {task.mode === "adaptive"
                      ? "Learner requests use the verified task candidate pool."
                      : "Learner requests continue to use the saved legacy provider/model route."}
                  </p>
                </div>
                <span className={task.mode === "adaptive" ? "admin-routing-state is-adaptive" : "admin-runtime-state"}>
                  {task.mode === "adaptive" ? "Adaptive enabled" : "Pinned route"}
                </span>
              </div>

              <div className="admin-routing-readiness">
                <div>
                  <span>Eligible candidates</span>
                  <strong>{readiness.eligibleCandidateCount} / {readiness.totalCandidateCount}</strong>
                </div>
                <p>{readiness.message}</p>
                {selected ? (
                  <p className="admin-routing-candidate">
                    Highest-priority ready candidate: <strong>{selected.provider} / {selected.modelId}</strong>
                    {" "}· priority {selected.priority}
                    {selected.lastTestLatencyMs !== null
                      ? " · last exact-model test " + selected.lastTestLatencyMs + " ms"
                      : ""}
                  </p>
                ) : null}
              </div>

              <div className="admin-task-actions">
                <span>Last setting update: {new Date(task.updatedAt).toLocaleString()}</span>
                <div className="admin-task-action-buttons">
                  <button
                    className="is-secondary"
                    type="button"
                    disabled={isSaving || savingTask !== null || task.mode === "pinned"}
                    onClick={() => void setMode(task.id, "pinned")}
                  >
                    {isSaving && task.mode === "adaptive" ? "Saving…" : "Return to pinned"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || savingTask !== null || task.mode === "adaptive" || !readiness.ready}
                    title={
                      task.mode === "adaptive"
                        ? "Adaptive mode is already enabled."
                        : readiness.ready
                          ? "Enable adaptive selection for this task."
                          : "At least one fully eligible model is required."
                    }
                    onClick={() => void setMode(task.id, "adaptive")}
                  >
                    {isSaving && task.mode === "pinned" ? "Saving…" : "Enable adaptive"}
                  </button>
                </div>
              </div>

              {feedback?.task === task.id ? (
                <p className={"admin-form-feedback is-" + feedback.kind} role="status">
                  {feedback.message}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
