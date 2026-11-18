"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { TutorMessageMarkdown } from "./tutor-message-markdown";

type TutorMessage = {
  id: string;
  role: "student" | "tutor";
  content: string;
  sequenceNumber: number;
  createdAt: string;
};

type TutorAttempt = {
  id: string;
  messageId: string;
  attemptNumber: number;
  evaluationStatus: string;
  submittedAt: string;
};

type TutorSession = {
  id: string;
  intent: string;
  initialPrompt: string;
  state: string;
  currentStepIndex: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  messages: TutorMessage[];
  attempts: TutorAttempt[];
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

function parseTutorSession(value: unknown): TutorSession | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.attempts)
  ) return null;

  const messages = value.messages.filter((item): item is TutorMessage => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      (item.role === "student" || item.role === "tutor") &&
      typeof item.content === "string" &&
      typeof item.sequenceNumber === "number" &&
      typeof item.createdAt === "string"
    );
  });

  if (messages.length !== value.messages.length) return null;

  const attempts = value.attempts.filter((item): item is TutorAttempt => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.messageId === "string" &&
      typeof item.attemptNumber === "number" &&
      typeof item.evaluationStatus === "string" &&
      typeof item.submittedAt === "string"
    );
  });

  if (attempts.length !== value.attempts.length) return null;

  if (
    typeof value.id !== "string" ||
    typeof value.intent !== "string" ||
    typeof value.initialPrompt !== "string" ||
    typeof value.state !== "string" ||
    typeof value.currentStepIndex !== "number" ||
    typeof value.version !== "number" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    intent: value.intent,
    initialPrompt: value.initialPrompt,
    state: value.state,
    currentStepIndex: value.currentStepIndex,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    messages,
    attempts
  };
}

async function fetchTutorSession(sessionId: string): Promise<TutorSession> {
  const response = await fetch("/api/v1/tutor/sessions/" + sessionId, {
    cache: "no-store"
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readApiError(payload, "This tutor session could not be loaded."));
  }

  const data = isRecord(payload) ? parseTutorSession(payload.data) : null;
  if (!data) {
    throw new Error("Cogniva received an incomplete tutor session record.");
  }
  return data;
}

function formatAttemptStatus(status: string): string {
  switch (status) {
    case "not_evaluated":
      return "Not evaluated yet";
    case "pending":
      return "Evaluation pending";
    case "evaluated":
      return "Evaluated";
    case "unavailable":
      return "Evaluation unavailable";
    case "failed":
      return "Evaluation failed";
    default:
      return "Evaluation status unknown";
  }
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

export function TutorSessionConversation({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<TutorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageType, setMessageType] = useState<"attempt" | "question">("attempt");
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      try {
        const data = await fetchTutorSession(sessionId);
        if (isCurrent) setSession(data);
      } catch (cause) {
        if (isCurrent) {
          setError(
            cause instanceof Error
              ? cause.message
              : "This tutor session could not be loaded."
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, [sessionId]);

  async function submitTutorTurn(message?: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/v1/tutor/sessions/" + sessionId + "/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message ? { message, messageType } : {})
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readApiError(payload, "Cogniva could not generate a response. Please try again."));
      }

      if (message) setDraft("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cogniva could not generate a response. Please try again."
      );
    } finally {
      try {
        const updated = await fetchTutorSession(sessionId);
        setSession(updated);

        if (message) {
          const latest = updated.messages[updated.messages.length - 1];
          if (
            latest?.role === "student" &&
            latest.content.trim() === message.trim()
          ) {
            setDraft("");
          }
        }
      } catch (cause) {
        if (!error) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The latest conversation could not be refreshed."
          );
        }
      }
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSubmitting) return;
    void submitTutorTurn(message);
  }

  if (isLoading) {
    return <p className="tutor-muted-state" role="status">Loading your conversation...</p>;
  }

  if (!session) {
    return (
      <div className="tutor-empty-state">
        <p className="tutor-error" role="alert">{error || "This tutor session is not available."}</p>
        <Link className="workspace-browse-link" href="/tutor">Return to Tutor</Link>
      </div>
    );
  }

  const latestMessage = session.messages[session.messages.length - 1];
  const isTerminal = ["completed", "failed", "cancelled"].includes(session.state);
  const needsTutorResponse = latestMessage?.role === "student" && !isTerminal;
  const canSendMessage = latestMessage?.role === "tutor" && !isTerminal;

  return (
    <section className="tutor-conversation" aria-label="Tutor conversation">
      <header className="tutor-conversation-header">
        <div>
          <p className="workspace-section-kicker">{formatIntent(session.intent)}</p>
          <h2>{session.initialPrompt}</h2>
        </div>
        <span className={"tutor-state-chip " + (isTerminal ? "is-terminal" : "")}>
          {session.state.replaceAll("_", " ")}
        </span>
      </header>

      <div className="tutor-message-list" aria-live="polite">
        {session.messages.map((message) => {
          const attempt = session.attempts.find((item) => item.messageId === message.id);
          return (
          <article
            className={"tutor-message " + (message.role === "student" ? "is-student" : "is-tutor")}
            key={message.id}
          >
            <p className="tutor-message-author">
              {message.role === "student" ? "You" : "Cogniva"}
            </p>
            <TutorMessageMarkdown content={message.content} />
            {attempt && (
              <p className="tutor-attempt-status">
                Attempt #{attempt.attemptNumber} · {formatAttemptStatus(attempt.evaluationStatus)}
              </p>
            )}
            <time dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
              })}
            </time>
          </article>
          );
        })}
      </div>

      {error && <p className="tutor-error" role="alert">{error}</p>}

      {needsTutorResponse ? (
        <div className="tutor-pending-turn">
          <div>
            <strong>Your message is saved.</strong>
            <p>Cogniva has not saved a reply for this turn yet. You can request or retry the tutor response.</p>
          </div>
          <button
            className="tutor-primary-button"
            type="button"
            onClick={() => void submitTutorTurn()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cogniva is thinking..." : "Get tutor response"}
          </button>
        </div>
      ) : canSendMessage ? (
        <form className="tutor-reply-form" onSubmit={handleSubmit}>
          <label className="tutor-form-field">
            <span>What are you sending?</span>
            <select
              value={messageType}
              onChange={(event) => setMessageType(event.target.value as "attempt" | "question")}
              disabled={isSubmitting}
            >
              <option value="attempt">My answer or working (attempt)</option>
              <option value="question">A follow-up question</option>
            </select>
          </label>
          <label className="tutor-form-field">
            <span>Your turn</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={messageType === "attempt"
                ? "Show your answer, working or reasoning..."
                : "Ask your follow-up question..."}
              maxLength={4000}
              rows={3}
              required
              disabled={isSubmitting}
            />
          </label>
          <button
            className="tutor-primary-button"
            type="submit"
            disabled={isSubmitting || !draft.trim()}
          >
            {isSubmitting
              ? "Sending..."
              : messageType === "attempt"
                ? "Submit attempt"
                : "Send follow-up"}
          </button>
        </form>
      ) : (
        <p className="tutor-muted-state">
          This session is closed. Start a new tutor session to continue learning.
        </p>
      )}

      <p className="tutor-form-note">
        Cogniva&apos;s replies guide your reasoning. A conversation by itself does not establish demonstrated mastery.
      </p>
    </section>
  );
}
