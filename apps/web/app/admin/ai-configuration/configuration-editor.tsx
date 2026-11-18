"use client";

import { useState } from "react";
import type {
  AiConfigurationSnapshot,
  AiProviderId,
  AiTaskKey
} from "@/lib/admin-ai-config";

type RouteDraft = {
  provider: AiProviderId | "";
  model: string;
};

function createDrafts(configuration: AiConfigurationSnapshot) {
  return Object.fromEntries(
    configuration.tasks.map((task) => [
      task.id,
      {
        provider: task.route?.provider ?? "",
        model: task.route?.model ?? ""
      }
    ])
  ) as Record<AiTaskKey, RouteDraft>;
}

export function AiConfigurationEditor({
  initialConfiguration
}: {
  initialConfiguration: AiConfigurationSnapshot;
}) {
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [drafts, setDrafts] = useState(() => createDrafts(initialConfiguration));
  const [savingTask, setSavingTask] = useState<AiTaskKey | null>(null);
  const [feedback, setFeedback] = useState<
    Partial<Record<AiTaskKey, { kind: "success" | "error"; message: string }>>
  >({});

  function updateDraft(task: AiTaskKey, patch: Partial<RouteDraft>) {
    setDrafts((current) => ({
      ...current,
      [task]: { ...current[task], ...patch }
    }));
    setFeedback((current) => ({ ...current, [task]: undefined }));
  }

  async function saveRoute(task: AiTaskKey) {
    const draft = drafts[task];
    if (!draft.provider || !draft.model.trim()) return;

    setSavingTask(task);
    setFeedback((current) => ({ ...current, [task]: undefined }));

    try {
      const response = await fetch("/api/v1/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          provider: draft.provider,
          model: draft.model.trim()
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: AiConfigurationSnapshot; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? "The routing preference could not be saved."
        );
      }

      setConfiguration(payload.data);
      setDrafts(createDrafts(payload.data));
      setFeedback((current) => ({
        ...current,
        [task]: {
          kind: "success",
          message: "Routing preference saved. It is not active until the provider runtime is integrated."
        }
      }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [task]: {
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "The routing preference could not be saved."
        }
      }));
    } finally {
      setSavingTask(null);
    }
  }

  return (
    <>
      <section className="admin-section" aria-labelledby="provider-credentials-title">
        <div className="admin-section-heading">
          <h2 id="provider-credentials-title">Provider credentials</h2>
          <span>Server-side environment status only</span>
        </div>
        <div className="admin-provider-grid">
          {configuration.providers.map((provider) => (
            <article className="admin-provider-card" key={provider.id}>
              <div>
                <h3>{provider.label}</h3>
                <span
                  className={
                    provider.credentialConfigured
                      ? "admin-config-status is-configured"
                      : "admin-config-status is-missing"
                  }
                >
                  {provider.credentialConfigured ? "Credential detected" : "Credential missing"}
                </span>
              </div>
              <code>{provider.credentialVariable}</code>
              <p>
                {provider.credentialConfigured
                  ? "The server environment contains a non-empty credential value. Its contents are never returned."
                  : "Add this variable in the Render service environment settings. Do not paste provider keys into this dashboard or chat."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="task-routing-title">
        <div className="admin-section-heading">
          <h2 id="task-routing-title">Task routing preferences</h2>
          <span>Saved in Cogniva's database</span>
        </div>

        <div className="admin-notice admin-config-boundary">
          <strong>Routing is not active yet</strong>
          <span>
            This page stores your intended provider and model for each AI task. Cogniva does not
            call Gemini, Groq, or Mistral yet. Provider adapters, live connection tests, model
            catalogues, and benchmark-based activation will be delivered separately.
          </span>
        </div>

        <div className="admin-task-grid">
          {configuration.tasks.map((task) => {
            const draft = drafts[task.id];
            const saved = task.route;
            const isDirty =
              (saved?.provider ?? "") !== draft.provider ||
              (saved?.model ?? "") !== draft.model.trim();

            return (
              <article className="admin-task-card" key={task.id}>
                <div className="admin-task-heading">
                  <div>
                    <h3>{task.label}</h3>
                    <p>{task.description}</p>
                  </div>
                  <span className="admin-runtime-state">Runtime not integrated</span>
                </div>

                <div className="admin-config-fields">
                  <label>
                    <span>Provider</span>
                    <select
                      value={draft.provider}
                      onChange={(event) =>
                        updateDraft(task.id, { provider: event.target.value as AiProviderId | "" })
                      }
                    >
                      <option value="">Choose provider</option>
                      {configuration.providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Exact model ID</span>
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={160}
                      placeholder="Enter the provider's exact model ID"
                      value={draft.model}
                      onChange={(event) =>
                        updateDraft(task.id, { model: event.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="admin-task-actions">
                  <span>
                    {saved
                      ? `Saved preference: ${saved.provider} / ${saved.model}`
                      : "No routing preference saved"}
                  </span>
                  <button
                    type="button"
                    disabled={
                      savingTask !== null ||
                      !draft.provider ||
                      !draft.model.trim() ||
                      !isDirty
                    }
                    onClick={() => void saveRoute(task.id)}
                  >
                    {savingTask === task.id ? "Saving…" : "Save preference"}
                  </button>
                </div>

                {feedback[task.id] ? (
                  <p
                    className={
                      feedback[task.id]?.kind === "success"
                        ? "admin-form-feedback is-success"
                        : "admin-form-feedback is-error"
                    }
                    role="status"
                  >
                    {feedback[task.id]?.message}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
