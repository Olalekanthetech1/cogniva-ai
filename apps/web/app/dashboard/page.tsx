import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { TutorStartForm } from "@/components/tutor-start-form";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import {
  getStudentHomeActivity,
  requireCompletedStudent
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description: "Your Cogniva learning dashboard."
};

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

function formatDate(value: Date): string {
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default async function DashboardPage() {
  const { student, profile } = await requireCompletedStudent();
  const firstName = student.name?.trim().split(/\s+/)[0] || "learner";
  const institution = profile.institutionName ?? profile.selfReportedInstitution;
  const institutionIsSelfReported = Boolean(profile.selfReportedInstitution);

  let homeActivity: Awaited<ReturnType<typeof getStudentHomeActivity>> | null = null;
  try {
    homeActivity = await getStudentHomeActivity(student.id);
  } catch {
    // Keep the learning entry point available, but never turn a query failure
    // into a false empty state or substitute sample activity.
    homeActivity = null;
  }

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="home" />
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="workspace-eyebrow">COGNIVA / HOME</p>
            <h1>Good to see you, {firstName}.</h1>
            <p>Ready to understand something new?</p>
          </div>
          <div className="workspace-account">
            {institution && (
              <span className="workspace-institution">
                {institution}
                {institutionIsSelfReported && <small>Self-reported</small>}
              </span>
            )}
            <Link className="workspace-profile-link" href="/profile" aria-label="Open profile">
              {firstName.charAt(0).toUpperCase()}
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section className="workspace-primary-card" aria-labelledby="learning-entry-title">
          <p className="workspace-section-kicker">YOUR LEARNING STARTS HERE</p>
          <h2 id="learning-entry-title">What would you like to learn?</h2>
          <p>Ask a question, work through a problem or explore a topic.</p>
          <TutorStartForm compact />
          <Link className="workspace-browse-link" href="/learn">
            Browse available learning areas <span aria-hidden="true">→</span>
          </Link>
        </section>

        {homeActivity && homeActivity.sessions.length > 0 && (
          <section className="workspace-learning-section" aria-labelledby="continue-learning-title">
            <div className="workspace-section-heading">
              <div>
                <p className="workspace-section-kicker">PICK UP WHERE YOU LEFT OFF</p>
                <h2 id="continue-learning-title">Continue learning</h2>
              </div>
              <Link href="/tutor">All tutor sessions</Link>
            </div>
            <div className="tutor-session-list">
              {homeActivity.sessions.map((session) => (
                <Link
                  className="tutor-session-card"
                  href={"/tutor/" + encodeURIComponent(session.id)}
                  key={session.id}
                >
                  <span className="tutor-session-icon" aria-hidden="true">◌</span>
                  <span className="tutor-session-copy">
                    <strong>{session.initialPrompt}</strong>
                    <small>
                      {formatIntent(session.intent)} · Updated {formatDate(session.updatedAt)}
                    </small>
                  </span>
                  <span className="tutor-session-state">
                    {session.state.replaceAll("_", " ")}
                  </span>
                  <span className="tutor-session-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="workspace-learning-section" aria-labelledby="your-learning-title">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-kicker">YOUR PERSONAL LEARNING SPACE</p>
              <h2 id="your-learning-title">Your learning plans</h2>
            </div>
            <Link href="/learn">Open Learn →</Link>
          </div>

          {homeActivity === null ? (
            <div className="workspace-empty-card" role="status">
              <span className="workspace-empty-icon" aria-hidden="true">!</span>
              <div>
                <h3>Your learning activity is temporarily unavailable.</h3>
                <p>Refresh Home to try loading your saved sessions and approved plans again. Your learning entry point remains available above.</p>
              </div>
            </div>
          ) : homeActivity.activePlans.length > 0 ? (
            <div className="learning-plan-grid">
              {homeActivity.activePlans.map((plan) => (
                <Link
                  className="learning-plan-card"
                  href={"/learn/plans/" + encodeURIComponent(plan.id)}
                  key={plan.id}
                >
                  <div className="learning-plan-card-topline">
                    <span className="learning-plan-card-icon" aria-hidden="true">▤</span>
                    <span className="learning-plan-status">Learner-approved</span>
                  </div>
                  <h3>{plan.title}</h3>
                  <p>{plan.summary ?? plan.initialInput}</p>
                  <span className="learning-plan-card-meta">
                    Revision {plan.revisionNumber} · Updated {formatDate(plan.updatedAt)}
                  </span>
                  <span className="learning-plan-card-link">
                    Review plan <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="workspace-empty-card">
              <span className="workspace-empty-icon" aria-hidden="true">▤</span>
              <div>
                <h3>No approved learning plans yet.</h3>
                <p>Plans appear here after you review and approve a generated outline. Start or review a topic-based plan in Learn.</p>
                <Link className="workspace-browse-link" href="/learn">
                  Explore your learning library <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        <footer className="workspace-footer">
          <span>Understand More. Think Better.</span>
          <span>Learning progress will be based on recorded evidence.</span>
        </footer>
      </main>
    </div>
  );
}
