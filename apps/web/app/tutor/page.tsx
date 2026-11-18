import type { Metadata } from "next";
import Link from "next/link";
import { TutorSessionList } from "@/components/tutor-session-list";
import { TutorStartForm } from "@/components/tutor-start-form";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tutor",
  description: "Start or resume a guided Cogniva tutoring session."
};

export default async function TutorPage() {
  await requireCompletedStudent();

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="tutor" />
      <main className="workspace-main">
        <header className="workspace-page-heading">
          <p className="workspace-eyebrow">COGNIVA / TUTOR</p>
          <h1>Learn by working it through.</h1>
          <p>Bring a question, topic or problem. Cogniva will guide your reasoning one step at a time.</p>
        </header>

        <section className="workspace-primary-card" aria-labelledby="tutor-start-title">
          <p className="workspace-section-kicker">START A LEARNING SESSION</p>
          <h2 id="tutor-start-title">What would you like to understand?</h2>
          <TutorStartForm />
          <Link className="workspace-browse-link" href="/learn">
            Browse available learning areas <span aria-hidden="true">→</span>
          </Link>
        </section>

        <TutorSessionList />
      </main>
    </div>
  );
}
