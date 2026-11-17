import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description: "Your Cogniva learning dashboard."
};

export default async function DashboardPage() {
  const { student, profile } = await requireCompletedStudent();
  const firstName = student.name?.trim().split(/\s+/)[0] || "learner";
  const institution = profile.institutionName ?? profile.selfReportedInstitution;
  const institutionIsSelfReported = Boolean(profile.selfReportedInstitution);

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
          <div className="workspace-composer" aria-describedby="tutor-availability">
            <span aria-hidden="true">◌</span>
            <input
              aria-label="Ask your AI tutor"
              disabled
              placeholder="The guided AI tutor is being prepared"
              type="text"
            />
            <button disabled type="button">Coming soon</button>
          </div>
          <p className="workspace-capability-note" id="tutor-availability">
            The tutoring session engine is not live yet. Your learning prompt will become available when session creation and persistence are ready.
          </p>
          <Link className="workspace-browse-link" href="/learn">
            Browse available learning areas <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="workspace-learning-section" aria-labelledby="your-learning-title">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-kicker">YOUR PERSONAL LEARNING SPACE</p>
              <h2 id="your-learning-title">Your learning</h2>
            </div>
            <Link href="/learn">Browse Learn →</Link>
          </div>
          <div className="workspace-empty-card">
            <span className="workspace-empty-icon" aria-hidden="true">▤</span>
            <div>
              <h3>Your courses and skills will appear here.</h3>
              <p>
                Cogniva will add learning areas from your actual study activity. No sample courses or skill progress are shown.
              </p>
            </div>
          </div>
        </section>

        <footer className="workspace-footer">
          <span>Understand More. Think Better.</span>
          <span>Learning progress will be based on recorded evidence.</span>
        </footer>
      </main>
    </div>
  );
}
