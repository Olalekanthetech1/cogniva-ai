"use client";

import { useCallback, useEffect, useState } from "react";

type CredentialStatus = {
  provider: "gemini" | "groq" | "mistral";
  credentialVariable: string;
  configured: boolean;
};

type BenchmarkResult = {
  id: string;
  blindLabel: string;
  task: string;
  caseId: string;
  caseTitle: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputText: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  estimatedCostUsd: string | null;
  latencyMs: number | null;
  finishReason: string | null;
  mechanicalCheck: { valid: boolean; issues: string[]; wordCount?: number } | null;
  failureCode: string | null;
  reviewCriteria: string[];
  reviewedByMe: boolean;
  myScores: Record<string, number> | null;
  myNotes: string | null;
  provider?: string;
  model?: string;
};

type BenchmarkSnapshot = {
  run: {
    id: string;
    suiteVersion: string;
    pricingSnapshotId: string;
    status: "running" | "completed" | "completed_with_failures";
    totalResults: number;
    completedResults: number;
    succeededResults: number;
    failedResults: number;
    reviewedResults: number;
    identitiesRevealed: boolean;
    createdAt: string;
    completedAt: string | null;
  };
  results: BenchmarkResult[];
  credentials: CredentialStatus[];
};

type SnapshotResponse = {
  data: BenchmarkSnapshot | null;
  credentials: CredentialStatus[];
  error?: { code?: string; message?: string; missingProviders?: string[] };
};

function formatCost(value: string | null) {
  if (value === null) return "Unavailable";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$${amount.toFixed(8)}`
    : "Unavailable";
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function ReviewForm({
  result,
  disabled,
  onSave
}: {
  result: BenchmarkResult;
  disabled: boolean;
  onSave: (resultId: string, scores: Record<string, number>, notes: string) => Promise<void>;
}) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      result.reviewCriteria.map((_, index) => [
        `criterion_${index + 1}`,
        result.myScores?.[`criterion_${index + 1}`]?.toString() ?? ""
      ])
    )
  );
  const [notes, setNotes] = useState(result.myNotes ?? "");
  const [saving, setSaving] = useState(false);
  const complete = result.reviewCriteria.length > 0 &&
    result.reviewCriteria.every((_, index) => {
      const value = Number(scores[`criterion_${index + 1}`]);
      return Number.isInteger(value) && value >= 1 && value <= 5;
    });

  async function submit() {
    if (!complete || saving || disabled) return;
    setSaving(true);
    try {
      await onSave(
        result.id,
        Object.fromEntries(
          Object.entries(scores).map(([key, value]) => [key, Number(value)])
        ),
        notes
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="benchmark-review">
      <div className="benchmark-review-heading">
        <strong>{result.reviewedByMe ? "Your saved review" : "Blind human review"}</strong>
        <span>1 = poor · 3 = adequate · 5 = excellent</span>
      </div>
      {result.reviewCriteria.map((criterion, index) => {
        const key = `criterion_${index + 1}`;
        return (
          <label className="benchmark-score-row" key={key}>
            <span>{index + 1}. {criterion}</span>
            <select
              value={scores[key] ?? ""}
              disabled={disabled || saving}
              onChange={(event) =>
                setScores((current) => ({ ...current, [key]: event.target.value }))
              }
            >
              <option value="">Score</option>
              <option value="1">1 — Poor</option>
              <option value="2">2 — Weak</option>
              <option value="3">3 — Adequate</option>
              <option value="4">4 — Good</option>
              <option value="5">5 — Excellent</option>
            </select>
          </label>
        );
      })}
      <label className="benchmark-notes">
        <span>Reviewer notes (optional)</span>
        <textarea
          value={notes}
          maxLength={2000}
          rows={3}
          disabled={disabled || saving}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Record factual issues, strengths, or rubric justification."
        />
      </label>
      {!disabled ? (
        <button
          type="button"
          disabled={!complete || saving}
          onClick={() => void submit()}
        >
          {saving ? "Saving review…" : result.reviewedByMe ? "Update review" : "Save review"}
        </button>
      ) : (
        <p className="benchmark-review-saved">Review saved. Provider identity is now revealed after all successful outputs have been scored.</p>
      )}
    </div>
  );
}

export function AiBenchmarkWorkspace() {
  const [snapshot, setSnapshot] = useState<BenchmarkSnapshot | null>(null);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/v1/admin/ai-benchmarks/runs", {
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as SnapshotResponse | null;
    if (!response.ok || !payload) {
      throw new Error(payload?.error?.message ?? "Benchmark status could not be loaded.");
    }
    setSnapshot(payload.data);
    setCredentials(payload.credentials ?? payload.data?.credentials ?? []);
    return payload.data;
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/admin/ai-benchmarks/runs", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SnapshotResponse | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error?.message ?? "Benchmark status could not be loaded.");
        }
        if (active) {
          setSnapshot(payload.data);
          setCredentials(payload.credentials ?? payload.data?.credentials ?? []);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Benchmark status could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function executeRun(runId: string) {
    setExecuting(true);
    setError(null);
    setNotice("Benchmark execution is running. Each provider request is saved separately, so this run can be resumed if the page closes.");
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const response = await fetch(`/api/v1/admin/ai-benchmarks/runs/${runId}/next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const payload = await response.json().catch(() => null) as
          | { data?: { done?: boolean; busy?: boolean }; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "A benchmark case could not be executed. Completed results remain saved.");
        }

        await loadSnapshot();
        if (payload.data.done) {
          setNotice("All benchmark requests have finished. Review every successful output while provider identities remain hidden.");
          return;
        }
        if (!payload.data.busy && !payload.data.done) {
          // One case was processed; immediately request the next fixed case.
          continue;
        }
        await wait(800);
      }
      setNotice("The run is still active. Resume it to process the remaining cases.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Benchmark execution stopped. Completed results remain saved.");
    } finally {
      setExecuting(false);
      try { await loadSnapshot(); } catch { /* Preserve the last visible snapshot. */ }
    }
  }

  async function startRun() {
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/admin/ai-benchmarks/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const payload = await response.json().catch(() => null) as SnapshotResponse | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "Benchmark run could not be started.");
      }
      setSnapshot(payload.data);
      setCredentials(payload.credentials ?? payload.data.credentials ?? []);
      await executeRun(payload.data.run.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Benchmark run could not be started.");
    } finally {
      setStarting(false);
    }
  }

  async function saveReview(
    resultId: string,
    scores: Record<string, number>,
    notes: string
  ) {
    const response = await fetch(`/api/v1/admin/ai-benchmarks/results/${resultId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, notes })
    });
    const payload = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;
    if (!response.ok) throw new Error(payload?.error?.message ?? "Review could not be saved.");
    await loadSnapshot();
  }

  const missingCredentials = credentials.filter((item) => !item.configured);
  const run = snapshot?.run;
  const canStartNew =
    !starting &&
    !executing &&
    missingCredentials.length === 0 &&
    (!run ||
      run.status !== "running" &&
      (run.succeededResults === 0 || run.identitiesRevealed));
  const runActive = run?.status === "running";

  return (
    <>
      <section className="admin-section" aria-labelledby="benchmark-boundary-title">
        <div className="admin-section-heading">
          <h2 id="benchmark-boundary-title">Evaluation boundary</h2>
          <span>Administrator-only · no learner traffic</span>
        </div>
        <div className="admin-notice benchmark-boundary">
          <strong>Blinded comparative evaluation</strong>
          <span>
            Cogniva runs six fixed learning cases against three provider candidates.
            Each request is persisted independently. Provider identity stays hidden
            until you have scored every successful output. These runs do not create
            learner plans, tutor sessions, mastery records, or production routes.
          </span>
          <span>
            Pricing is an estimate from the dated token-price snapshot and provider-reported
            token usage. It is not an invoice or a guarantee of billed cost.
          </span>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="benchmark-credentials-title">
        <div className="admin-section-heading">
          <h2 id="benchmark-credentials-title">Provider readiness</h2>
          <span>Server-side credential presence only</span>
        </div>
        <div className="admin-provider-grid">
          {credentials.map((credential) => (
            <article className="admin-provider-card" key={credential.provider}>
              <div>
                <h3>{credential.provider === "gemini" ? "Google Gemini" : credential.provider === "groq" ? "Groq" : "Mistral"}</h3>
                <span className={credential.configured ? "admin-config-status is-configured" : "admin-config-status is-missing"}>
                  {credential.configured ? "Credential detected" : "Credential missing"}
                </span>
              </div>
              <code>{credential.credentialVariable}</code>
              <p>{credential.configured ? "Credential value is present on the server. Its contents are never returned." : "Add this variable in Render service environment settings. Never paste API keys into chat or the dashboard."}</p>
            </article>
          ))}
        </div>
        {missingCredentials.length > 0 ? (
          <div className="admin-notice is-warning benchmark-missing">
            <strong>Benchmark cannot start yet</strong>
            <span>All three provider credentials are required for a fair comparison. Add the missing variables in Render, then refresh this page.</span>
          </div>
        ) : null}
      </section>

      <section className="admin-section" aria-labelledby="benchmark-run-title">
        <div className="admin-section-heading">
          <h2 id="benchmark-run-title">Benchmark run</h2>
          <span>18 real provider requests per run</span>
        </div>
        <div className="benchmark-run-panel">
          {loading ? <p>Loading saved benchmark status…</p> : null}
          {!loading && !run ? <p>No benchmark run has been recorded yet.</p> : null}
          {run ? (
            <>
              <div className="benchmark-run-top">
                <div>
                  <strong>{run.status === "running" ? "Run in progress" : run.status === "completed" ? "Run completed" : "Run completed with failures"}</strong>
                  <span>Run {run.id}</span>
                </div>
                <span className="admin-runtime-state">{run.completedResults} / {run.totalResults} requests completed</span>
              </div>
              <div className="benchmark-progress" role="progressbar" aria-valuenow={run.completedResults} aria-valuemin={0} aria-valuemax={run.totalResults}>
                <span style={{ width: `${run.totalResults ? (run.completedResults / run.totalResults) * 100 : 0}%` }} />
              </div>
              <div className="benchmark-run-metrics">
                <span>{run.succeededResults} successful outputs</span>
                <span>{run.failedResults} failed requests</span>
                <span>{run.reviewedResults} / {run.succeededResults} reviewed by you</span>
              </div>
              <p className="benchmark-version">Suite: {run.suiteVersion} · Pricing: {run.pricingSnapshotId}</p>
            </>
          ) : null}
          <div className="benchmark-run-actions">
            {runActive ? (
              <button type="button" disabled={executing} onClick={() => void executeRun(run!.id)}>
                {executing ? "Processing benchmark…" : "Resume benchmark"}
              </button>
            ) : null}
            {canStartNew ? (
              <button type="button" disabled={starting || loading} onClick={() => void startRun()}>
                {starting || executing ? "Starting…" : run ? "Start new benchmark run" : "Start benchmark"}
              </button>
            ) : null}
            {run && run.status !== "running" && run.succeededResults > 0 && !run.identitiesRevealed ? (
              <span className="benchmark-review-reminder">Score all successful outputs to reveal provider identities.</span>
            ) : null}
            {run?.identitiesRevealed ? (
              <span className="benchmark-review-reminder">All successful outputs have been reviewed. Provider identities are now revealed.</span>
            ) : null}
          </div>
          {notice ? <p className="benchmark-notice" role="status">{notice}</p> : null}
          {error ? <p className="admin-form-feedback is-error" role="alert">{error}</p> : null}
        </div>
      </section>

      {snapshot && snapshot.results.length > 0 ? (
        <section className="admin-section" aria-labelledby="benchmark-results-title">
          <div className="admin-section-heading">
            <h2 id="benchmark-results-title">Blind evaluation outputs</h2>
            <span>{run?.identitiesRevealed ? "Provider identities revealed after review" : "Provider and model identities concealed"}</span>
          </div>
          <div className="benchmark-results">
            {snapshot.results.map((result) => (
              <article className="benchmark-result-card" key={result.id}>
                <div className="benchmark-result-header">
                  <div>
                    <span className="benchmark-candidate-label">
                      {result.provider && result.model
                        ? `Candidate ${result.blindLabel} · ${result.provider} / ${result.model}`
                        : `Candidate ${result.blindLabel}`}
                    </span>
                    <h3>{result.caseTitle}</h3>
                    <p>{result.task === "learning_plan_generation" ? "Learning plan generation" : "Socratic tutor response"}</p>
                  </div>
                  <span className={result.status === "succeeded" ? "admin-config-status is-configured" : result.status === "failed" ? "admin-config-status is-missing" : "admin-runtime-state"}>
                    {result.status}
                  </span>
                </div>

                {result.status === "succeeded" ? (
                  <>
                    <div className="benchmark-evidence">
                      <span>Latency: {result.latencyMs === null ? "Unavailable" : `${result.latencyMs} ms`}</span>
                      <span>Input: {result.usage.inputTokens ?? "Unavailable"} tokens</span>
                      <span>Output: {result.usage.outputTokens ?? "Unavailable"} tokens</span>
                      <span>Estimated cost: {formatCost(result.estimatedCostUsd)}</span>
                    </div>
                    {result.mechanicalCheck ? (
                      <p className={result.mechanicalCheck.valid ? "benchmark-check is-valid" : "benchmark-check is-invalid"}>
                        Mechanical format check: {result.mechanicalCheck.valid ? "passed" : "needs human attention"}
                        {result.mechanicalCheck.issues.length ? ` — ${result.mechanicalCheck.issues.join(" ")}` : ""}
                      </p>
                    ) : null}
                    <pre className="benchmark-output">{result.outputText}</pre>
                    <ReviewForm
                      result={result}
                      disabled={Boolean(run?.identitiesRevealed)}
                      onSave={saveReview}
                    />
                  </>
                ) : result.status === "failed" ? (
                  <p className="benchmark-failure">
                    Request failed ({result.failureCode ?? "unknown"}). This failure remains part of the benchmark evidence and is not scored as a successful output.
                  </p>
                ) : (
                  <p className="benchmark-pending">This case has not completed yet.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
