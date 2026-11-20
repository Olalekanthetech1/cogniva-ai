"use client";

import { useState, type FormEvent } from "react";
import type { AiModelCapabilities } from "@cogniva/database";

type RegistryTask = { id: "learning_plan_generation" | "socratic_tutor_response"; label: string };
type RegistryModel = {
  id: string;
  provider: "gemini" | "groq" | "mistral";
  modelId: string;
  displayName: string;
  status: "pending" | "enabled" | "disabled";
  capabilities: AiModelCapabilities;
  capabilityEvidenceUrl: string | null;
  capabilitiesVerifiedAt: string | null;
  lastTestStatus: "connected" | "failed" | null;
  lastTestedAt: string | null;
  lastTestLatencyMs: number | null;
  lastTestErrorCode: string | null;
  candidates: Array<{ task: RegistryTask["id"]; isEnabled: boolean; priority: number }>;
};
type RegistrySnapshot = {
  providers: Array<{
    id: RegistryModel["provider"];
    label: string;
    credentialVariable: string;
    credentialConfigured: boolean;
  }>;
  tasks: RegistryTask[];
  models: RegistryModel[];
};
type Feedback = { kind: "success" | "error" | "warning"; text: string };
type DiscoveredModel = {
  provider: RegistryModel["provider"];
  modelId: string;
  displayName: string;
  capabilities: AiModelCapabilities;
  evidenceUrl: string;
  discoveryNotes: string[];
};

const EMPTY_CAPABILITIES = JSON.stringify({
  structuredOutput: "unknown",
  reasoning: { kind: "unknown", parameter: null, levels: [] },
  temperature: "unknown"
}, null, 2);

export function AiModelRegistryEditor({ initialRegistry }: { initialRegistry: RegistrySnapshot }) {
  const [registry, setRegistry] = useState(initialRegistry);
  const [provider, setProvider] = useState<RegistryModel["provider"]>("gemini");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [capabilitiesText, setCapabilitiesText] = useState(EMPTY_CAPABILITIES);
  const [initialTasks, setInitialTasks] = useState<RegistryTask["id"][]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [discovering, setDiscovering] = useState(false);

  async function discoverModels() {
    setDiscovering(true);
    setFeedback(null);
    setDiscoveredModels([]);
    try {
      const response = await fetch("/api/v1/admin/ai-models/discover?provider=" + encodeURIComponent(provider), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Provider model discovery failed.");
      setDiscoveredModels(payload.data.models as DiscoveredModel[]);
      setFeedback({
        kind: "warning",
        text: payload.data.models.length + " model entries discovered. Provider metadata is incomplete for some capabilities; inspect the evidence and test each exact model before enabling it."
      });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Provider model discovery failed." });
    } finally {
      setDiscovering(false);
    }
  }

  function selectDiscoveredModel(model: DiscoveredModel) {
    setModelId(model.modelId);
    setDisplayName(model.displayName);
    setEvidenceUrl(model.evidenceUrl);
    setCapabilitiesText(JSON.stringify(model.capabilities, null, 2));
    setFeedback({ kind: "warning", text: "Provider metadata copied into the registration form. Review it against the linked official documentation; it is not yet administrator-verified." });
  }

  async function reload() {
    const response = await fetch("/api/v1/admin/ai-models", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Model registry could not be refreshed.");
    setRegistry(payload.data as RegistrySnapshot);
  }

  async function registerModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let capabilities: unknown;
    try { capabilities = JSON.parse(capabilitiesText); }
    catch { setFeedback({ kind: "error", text: "Capabilities must be valid JSON." }); return; }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, modelId: modelId.trim(), displayName: displayName.trim(),
          capabilities, capabilityEvidenceUrl: evidenceUrl.trim() || null,
          initialTasks
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Model registration failed.");
      setRegistry(payload.data);
      setModelId("");
      setDisplayName("");
      setEvidenceUrl("");
      setCapabilitiesText(EMPTY_CAPABILITIES);
      setInitialTasks([]);
      setFeedback({ kind: "success", text: "Model registered as pending. Test it and review its documented capabilities before enabling it." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Model registration failed." });
    } finally { setSaving(false); }
  }

  async function testModel(model: RegistryModel) {
    setBusyId(model.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-models/" + encodeURIComponent(model.id) + "/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Model connection test failed.");
      await reload();
      setFeedback({
        kind: payload.data.instructionCheck === "passed" ? "success" : "warning",
        text: payload.data.instructionCheck === "passed"
          ? model.provider + " / " + payload.data.resolvedModel + " responded in " + payload.data.latencyMs + " ms. Connection only; capability and teaching quality still require review."
          : "The model returned usable text but did not match the exact connection token. Review its behaviour before enabling it."
      });
    } catch (error) {
      await reload().catch(() => undefined);
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Model connection test failed." });
    } finally { setBusyId(null); }
  }

  async function enableModel(model: RegistryModel) {
    if (!model.capabilityEvidenceUrl) {
      setFeedback({ kind: "error", text: "Add an HTTPS capability evidence URL before verifying this model." });
      return;
    }
    setBusyId(model.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-models/" + encodeURIComponent(model.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "enabled", verifyCapabilities: true })
      });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Model could not be enabled.");
      setRegistry(payload.data);
      setFeedback({ kind: "success", text: "Capabilities marked as administrator-reviewed and model enabled. It is not serving learner traffic yet." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Model could not be enabled." });
    } finally { setBusyId(null); }
  }

  async function setModelStatus(model: RegistryModel, status: "pending" | "disabled") {
    setBusyId(model.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-models/" + encodeURIComponent(model.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Model status could not be changed.");
      setRegistry(payload.data);
      setFeedback({ kind: "success", text: status === "disabled" ? "Model disabled and removed from all task candidate pools." : "Model returned to pending and removed from task candidate pools." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Model status could not be changed." });
    } finally { setBusyId(null); }
  }

  async function saveCapabilities(modelId: string, capabilitiesText: string, capabilityEvidenceUrl: string) {
    let capabilities: unknown;
    try { capabilities = JSON.parse(capabilitiesText); }
    catch { throw new Error("Capabilities must be valid JSON."); }
    const response = await fetch("/api/v1/admin/ai-models/" + encodeURIComponent(modelId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capabilities, capabilityEvidenceUrl })
    });
    const payload = await response.json();
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Capability details could not be saved.");
    setRegistry(payload.data);
    setFeedback({ kind: "warning", text: "Capability claims changed. The model returned to pending, its task eligibility was disabled, and fresh capability review plus a connection test are required." });
  }

  async function updateTaskEligibility(model: RegistryModel, taskId: RegistryTask["id"], isEnabled: boolean, priorityOverride?: number) {
    if (priorityOverride !== undefined && (!Number.isInteger(priorityOverride) || priorityOverride < 0 || priorityOverride > 10000)) {
      setFeedback({ kind: "error", text: "Model priority must be an integer from 0 to 10000." });
      return;
    }
    const assignments = registry.tasks.map((task) => {
      const existing = model.candidates.find((candidate) => candidate.task === task.id);
      return {
        task: task.id,
        isEnabled: task.id === taskId ? isEnabled : (existing?.isEnabled ?? false),
        priority: task.id === taskId && priorityOverride !== undefined ? priorityOverride : (existing?.priority ?? 100)
      };
    });
    setBusyId(model.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/ai-models/" + encodeURIComponent(model.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments })
      });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Task eligibility could not be updated.");
      setRegistry(payload.data);
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Task eligibility could not be updated." });
    } finally { setBusyId(null); }
  }

  return (
    <>
      <section className="admin-section" aria-labelledby="model-registry-title">
        <div className="admin-section-heading">
          <h2 id="model-registry-title">Model registry</h2>
          <span>{registry.models.length} registered model{registry.models.length === 1 ? "" : "s"}</span>
        </div>
        <div className="admin-notice admin-config-boundary">
          <strong>Registry first; adaptive routing remains disabled</strong>
          <span>Registered models do not change the models currently serving learners. Each model starts pending and each task assignment starts disabled. Connection testing, capability evidence review, and teaching-quality benchmarking are separate gates.</span>
        </div>

        <form className="admin-model-form" onSubmit={(event) => void registerModel(event)}>
          <div className="admin-section-heading"><h3>Register a model</h3><span>Exact provider model ID required</span></div>
          <div className="admin-config-fields">
            <label><span>Provider</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value as RegistryModel["provider"])}>
                {registry.providers.map((item) => <option value={item.id} key={item.id}>{item.label}{item.credentialConfigured ? "" : " (credential missing)"}</option>)}
              </select>
            </label>
            <label><span>Exact model ID</span>
              <input value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="Exact ID from provider documentation" required maxLength={160} autoComplete="off" spellCheck={false}/>
            </label>
            <label><span>Admin display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="A recognizable model label" required maxLength={160}/>
            </label>
            <label><span>Capability evidence URL (HTTPS)</span>
              <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Official model documentation" required/>
            </label>
          </div>
          <label className="admin-model-field">
            <span>Capability declaration (JSON)</span>
            <textarea value={capabilitiesText} onChange={(event) => setCapabilitiesText(event.target.value)} rows={8} spellCheck={false}/>
            <small>Unknown capability values are safe defaults. Do not declare a capability unless the exact model's documentation supports it.</small>
          </label>
          <fieldset className="admin-model-task-options">
            <legend>Initial task assignments (disabled until explicitly enabled)</legend>
            {registry.tasks.map((task) => (
              <label key={task.id}>
                <input type="checkbox" checked={initialTasks.includes(task.id)} onChange={(event) => setInitialTasks((current) => event.target.checked ? [...current, task.id] : current.filter((item) => item !== task.id))}/>
                {task.label}
              </label>
            ))}
          </fieldset>
          <div className="admin-task-actions">
            <span>New entries remain pending and cannot be selected by student requests.</span>
            <div className="admin-task-action-buttons">
              <button type="button" className="is-secondary" disabled={discovering || saving || !(registry.providers.find((item) => item.id === provider)?.credentialConfigured ?? false)} onClick={() => void discoverModels()}>{discovering ? "Discovering…" : "Discover provider models"}</button>
              <button type="submit" disabled={saving || !modelId.trim() || !displayName.trim()}>{saving ? "Registering…" : "Register model"}</button>
            </div>
          </div>
          {discoveredModels.length > 0 && (
            <div className="admin-discovered-models">
              <div className="admin-section-heading"><h3>Provider-discovered models</h3><span>{discoveredModels.length} returned</span></div>
              {discoveredModels.map((model) => (
                <article className="admin-discovered-model" key={model.provider + ":" + model.modelId}>
                  <div><strong>{model.displayName}</strong><code>{model.modelId}</code></div>
                  <small>{model.discoveryNotes.join(" ")}</small>
                  <button type="button" className="is-secondary" onClick={() => selectDiscoveredModel(model)}>Use this model</button>
                </article>
              ))}
            </div>
          )}
        </form>

        {feedback && <p className={"admin-form-feedback is-" + feedback.kind} role="status">{feedback.text}</p>}

        {registry.models.length === 0 ? (
          <div className="admin-notice"><strong>No models registered yet.</strong><span>Register exact model IDs above. Cogniva does not invent provider model inventory or populate sample models.</span></div>
        ) : (
          <div className="admin-model-list">
            {registry.models.map((model) => {
              const credential = registry.providers.find((item) => item.id === model.provider)?.credentialConfigured ?? false;
              return (
                <article className="admin-model-card" key={model.id}>
                  <div className="admin-model-card-heading">
                    <div><h3>{model.displayName}</h3><code>{model.provider} / {model.modelId}</code></div>
                    <span className={"admin-config-status " + (model.status === "enabled" ? "is-configured" : "is-missing")}>{model.status}</span>
                  </div>
                  <div className="admin-model-evidence">
                    <span>Credential: {credential ? "detected" : "missing"}</span>
                    <span>Connection: {model.lastTestStatus ?? "not tested"}</span>
                    <span>Capabilities: {model.capabilitiesVerifiedAt ? "reviewed" : "unverified"}</span>
                    {model.lastTestLatencyMs !== null && <span>Last latency: {model.lastTestLatencyMs} ms</span>}
                    {model.lastTestErrorCode && <span>Last error: {model.lastTestErrorCode}</span>}
                  </div>
                  {model.capabilityEvidenceUrl && <a className="admin-model-evidence-link" href={model.capabilityEvidenceUrl} target="_blank" rel="noreferrer">Capability evidence ↗</a>}
                  <ModelCapabilityEditor
                    key={model.id + ":" + (model.capabilitiesVerifiedAt ?? "unverified") + ":" + (model.capabilityEvidenceUrl ?? "no-evidence")}
                    model={model}
                    disabled={busyId !== null}
                    onSave={saveCapabilities}
                  />
                  <div className="admin-model-task-eligibility">
                    <strong>Task eligibility</strong>
                    {registry.tasks.map((task) => {
                      const candidate = model.candidates.find((item) => item.task === task.id);
                      return (
                        <label key={task.id}>
                          <input type="checkbox" checked={candidate?.isEnabled ?? false} disabled={model.status !== "enabled" || busyId === model.id} onChange={(event) => void updateTaskEligibility(model, task.id, event.target.checked)}/>
                          {task.label}
                          <small>{candidate ? "Priority " + candidate.priority : "Not assigned"}</small>
                          <input
                            className="admin-model-priority"
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            aria-label={task.label + " model priority"}
                            defaultValue={candidate?.priority ?? 100}
                            disabled={model.status !== "enabled" || busyId === model.id}
                            onBlur={(event) => {
                              const nextPriority = Number(event.currentTarget.value);
                              if (nextPriority !== (candidate?.priority ?? 100)) {
                                void updateTaskEligibility(model, task.id, candidate?.isEnabled ?? false, nextPriority);
                              }
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="admin-task-action-buttons">
                    <button type="button" className="is-secondary" disabled={busyId !== null || !credential} onClick={() => void testModel(model)}>{busyId === model.id ? "Working…" : "Test exact model"}</button>
                    {model.status !== "enabled" ? (
                      <button type="button" disabled={busyId !== null || model.lastTestStatus !== "connected" || !model.capabilityEvidenceUrl} onClick={() => void enableModel(model)}>Mark review & enable</button>
                    ) : (
                      <button type="button" className="is-secondary" disabled={busyId !== null} onClick={() => void setModelStatus(model, "disabled")}>Disable model</button>
                    )}
                  </div>
                  <small className="admin-model-footnote">A connection test validates availability only. Enabling confirms administrator review of the capability evidence; task checkboxes control eligibility, not live routing.</small>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}


function ModelCapabilityEditor({
  model,
  disabled,
  onSave
}: {
  model: RegistryModel;
  disabled: boolean;
  onSave: (modelId: string, capabilitiesText: string, evidenceUrl: string) => Promise<void>;
}) {
  const [capabilitiesText, setCapabilitiesText] = useState(
    JSON.stringify(model.capabilities, null, 2)
  );
  const [evidenceUrl, setEvidenceUrl] = useState(model.capabilityEvidenceUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(model.id, capabilitiesText, evidenceUrl.trim());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Capability details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="admin-model-capability-editor">
      <summary>Review or update capability declarations</summary>
      <label>
        <span>Capability evidence URL (HTTPS)</span>
        <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} disabled={disabled || saving} />
      </label>
      <label>
        <span>Capabilities JSON</span>
        <textarea rows={7} value={capabilitiesText} onChange={(event) => setCapabilitiesText(event.target.value)} disabled={disabled || saving} spellCheck={false}/>
      </label>
      <button type="button" className="is-secondary" disabled={disabled || saving || !evidenceUrl.trim()} onClick={() => void save()}>
        {saving ? "Saving…" : "Save capability claims"}
      </button>
      {error && <small className="admin-form-feedback is-error" role="alert">{error}</small>}
    </details>
  );
}
