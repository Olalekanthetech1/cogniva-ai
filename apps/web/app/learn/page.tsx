import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { subjects } from "@cogniva/database";
import { LearningPlanLibrary } from "@/components/learning-plan-library";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { getStudentDatabase } from "@/lib/student-data";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn",
  description: "Manage your personal learning plans and explore available subjects."
};

export default async function LearnPage() {
  await requireCompletedStudent();
  const db = getStudentDatabase();
  const availableSubjects = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      description: subjects.description
    })
    .from(subjects)
    .orderBy(asc(subjects.name))
    .limit(100);

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="learn" />
      <main className="workspace-main">
        <header className="workspace-page-heading">
          <p className="workspace-eyebrow">COGNIVA / LEARN</p>
          <h1>Build your learning path.</h1>
          <p>
            Create a personal study plan from a topic, then explore the subject
            catalogue separately.
          </p>
        </header>

        <LearningPlanLibrary />

        <section className="workspace-learning-section" aria-labelledby="catalogue-subjects-title">
          <div className="workspace-section-heading">
            <div>
              <p className="workspace-section-kicker">CATALOGUE DISCOVERY</p>
              <h2 id="catalogue-subjects-title">Explore available subjects</h2>
            </div>
          </div>
          {availableSubjects.length > 0 ? (
            <section className="workspace-subject-grid" aria-label="Available subjects">
              {availableSubjects.map((subject) => (
                <article className="workspace-subject-card" key={subject.id}>
                  <span className="workspace-empty-icon" aria-hidden="true">▤</span>
                  <h3>{subject.name}</h3>
                  {subject.description && <p>{subject.description}</p>}
                </article>
              ))}
            </section>
          ) : (
            <section className="workspace-empty-card">
              <span className="workspace-empty-icon" aria-hidden="true">⌕</span>
              <div>
                <h3>No subjects are listed yet.</h3>
                <p>
                  The available catalogue currently has no subject records.
                  Cogniva will show real entries here when they are added; it
                  will not fill the list with sample subjects.
                </p>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
