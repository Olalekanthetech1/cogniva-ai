"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type TutorIntent = "learn_topic" | "understand_concept" | "solve_problem";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || !isRecord(payload.error)) return fallback;
  return typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

export function TutorStartForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [intent, setIntent] = useState<TutorIntent>(
    compact ? "understand_concept" : "learn_topic"
  );
  const [prompt, setPrompt] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isStarting) return;

    setIsStarting(true);
    setError("");

    try {
      const response = await fetch("/api/v1/tutor/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, prompt: normalizedPrompt })
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readApiError(payload, "Cogniva could not start this session. Please try again."));
      }

      const data = isRecord(payload) && isRecord(payload.data)
        ? payload.data
        : null;
      const createdSession = data && isRecord(data.session)
        ? data.session
        : null;
      const sessionId = createdSession && typeof createdSession.id === "string"
        ? createdSession.id
        : null;

      if (!sessionId) {
        throw new Error("The session was created, but Cogniva could not open it. Refresh your Tutor page to find it.");
      }

      // The learner's first message is already persisted by session creation.
      // A failed provider response remains retryable from the session screen.
      try {
        await fetch(`/api/v1/tutor/sessions/${sessionId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
      } catch {
        // Keep the saved session; the session screen exposes a retry action.
      }

      router.push(`/tutor/${sessionId}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cogniva could not start this session. Please try again."
      );
      setIsStarting(false);
    }
  }

  return (
    <form
      className={`tutor-start-form ${compact ? "is-compact" : ""}`}
      onSubmit={handleSubmit}
    >
      <label className="tutor-form-field">
        <span>What do you want to do?</span>
        <select
          value={intent}
          onChange={(event) => setIntent(event.target.value as TutorIntent)}
          disabled={isStarting}
        >
          <option value="understand_concept">Understand a concept</option>
          <option value="learn_topic">Learn a topic</option>
          <option value="solve_problem">Work through a problem</option>
        </select>
      </label>

      <label className="tutor-form-field">
        <span>Your question or learning topic</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe what you want to understand..."
          minLength={1}
          maxLength={4000}
          rows={compact ? 3 : 5}
          required
          disabled={isStarting}
        />
        <small>{prompt.trim().length.toLocaleString()} / 4,000 characters</small>
      </label>

      {error && <p className="tutor-error" role="alert">{error}</p>}

      <button
        className="tutor-primary-button"
        type="submit"
        disabled={isStarting || !prompt.trim()}
      >
        {isStarting ? "Starting your session..." : "Start learning"}
      </button>
      <p className="tutor-form-note">
        Cogniva saves your message and guides you one step at a time. Your progress is not marked as mastered from conversation alone.
      </p>
    </form>
  );
}
