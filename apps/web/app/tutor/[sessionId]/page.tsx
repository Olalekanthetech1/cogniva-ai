import type { Metadata } from "next";
import Link from "next/link";
import { TutorSessionConversation } from "@/components/tutor-session-conversation";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tutor session",
  description: "A saved, guided Socratic tutoring conversation."
};

type TutorSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function TutorSessionPage({ params }: TutorSessionPageProps) {
  await requireCompletedStudent();
  const { sessionId } = await params;

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="tutor" />
      <main className="workspace-main">
        <header className="workspace-page-heading tutor-session-page-heading">
          <p className="workspace-eyebrow">COGNIVA / TUTOR SESSION</p>
          <h1>Let&apos;s work through it.</h1>
          <p>Think aloud, share your attempt and ask follow-up questions. Your conversation is saved to your account.</p>
          <Link className="workspace-browse-link" href="/tutor">
            <span aria-hidden="true">←</span> All tutor sessions
          </Link>
        </header>

        <TutorSessionConversation sessionId={sessionId} />
      </main>
    </div>
  );
}
