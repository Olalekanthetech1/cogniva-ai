"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TutorSessionSummary = {
  id: string;
  intent: string;
  initialPrompt: string;
  state: string;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || !isRecord(payload.error)) return fallback;
  return typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

function formatIntent(intent: string): string {
  switch (intent) {
    case "understand_concept":
      return "Understand a concept";
    case "solve_problem":
      return "Work through a problem";
    case "learn_topic":
      return "Learn a topic";
    default:
      return "Tutor session";
  }
}

function formatState(state: string): string {
  return state.replaceAll("_", " ");
}

export function TutorSessionList() {
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadSessions() {
      try {
        const response = await fetch("/api/v1/tutor/sessions", {
          cache: "no-store"
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(readApiError(payload, "Your tutor sessions are unavailable right now."));
        }

        const data = isRecord(payload) && Array.isArray(payload.data)
          ? payload.data
          : [];

        const validSessions = data.filter((item): item is TutorSessionSummary => {
          if (!isRecord(item)) return false;
          return (
            typeof item.id === "string" &&
            typeof item.intent === "string" &&
            typeof item.initialPrompt === "string" &&
            typeof item.state === "string" &&
            typeof item.createdAt === "string" &&
            typeof item.updatedAt === "string"
          );
        });

        if (isCurrent) setSessions(validSessions);
      } catch (cause) {
        if (isCurrent) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Your tutor sessions are unavailable right now."
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadSessions();
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="tutor-history-section" aria-labelledby="tutor-history-title">
      <div className="workspace-section-heading">
        <div>
          <p className="workspace-section-kicker">YOUR SAVED CONVERSATIONS</p>
          <h2 id="tutor-history-title">Recent tutor sessions</h2>
        </div>
      </div>

      {isLoading ? (
        <p className="tutor-muted-state" role="status">Loading your sessions...</p>
      ) : error ? (
        <div className="tutor-empty-state">
          <p className="tutor-error" role="alert">{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="tutor-empty-state">
          <span className="workspace-empty-icon" aria-hidden="true">◌</span>
          <div>
            <h3>Your tutor history will appear here.</h3>
            <p>Start with a question or topic above. Cogniva will save the conversation to your account.</p>
          </div>
        </div>
      ) : (
        <div className="tutor-session-list">
          {sessions.map((session) => (
            <Link
              className="tutor-session-card"
              href={`/tutor/${session.id}`}
              key={session.id}
            >
              <span className="tutor-session-icon" aria-hidden="true">◌</span>
              <span className="tutor-session-copy">
                <strong>{session.initialPrompt}</strong>
                <small>
                  {formatIntent(session.intent)} · Updated{" "}
                  {new Date(session.updatedAt).toLocaleString()}
                </small>
              </span>
              <span className="tutor-session-state">{formatState(session.state)}</span>
              <span className="tutor-session-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
