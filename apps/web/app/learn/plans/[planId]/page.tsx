import type { Metadata } from "next";
import { LearningPlanDetail } from "@/components/learning-plan-detail";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning plan",
  description: "View your saved personal learning plan."
};

type PageProps = {
  params: Promise<{ planId: string }>;
};

export default async function LearningPlanPage({ params }: PageProps) {
  await requireCompletedStudent();
  const { planId } = await params;

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="learn" />
      <main className="workspace-main">
        <header className="workspace-page-heading">
          <p className="workspace-eyebrow">COGNIVA / LEARN / PLAN</p>
          <h1>Your learning plan.</h1>
          <p>Review the saved topic and any generated study outline.</p>
        </header>
        <LearningPlanDetail planId={planId} />
      </main>
    </div>
  );
}
