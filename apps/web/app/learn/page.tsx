import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { subjects } from "@cogniva/database";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { getStudentDatabase } from "@/lib/student-data";
import { requireCompletedStudent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn",
  description: "Explore available Cogniva learning areas."
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
          <h1>Explore learning.</h1>
          <p>Browse subject areas available in Cogniva's current catalogue.</p>
        </header>
        {availableSubjects.length > 0 ? (
          <section className="workspace-subject-grid" aria-label="Available subjects">
            {availableSubjects.map((subject) => (
              <article className="workspace-subject-card" key={subject.id}>
                <span className="workspace-empty-icon" aria-hidden="true">▤</span>
                <h2>{subject.name}</h2>
                {subject.description && <p>{subject.description}</p>}
              </article>
            ))}
          </section>
        ) : (
          <section className="workspace-empty-card">
            <span className="workspace-empty-icon" aria-hidden="true">⌕</span>
            <div>
              <h2>No subjects are listed yet.</h2>
              <p>
                The available catalogue currently has no subject records. Cogniva will show real entries here when they are added; it will not fill the list with sample subjects.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
