import { and, desc, eq, inArray } from "drizzle-orm";
import {
  institutions,
  learningPlanRevisions,
  learningPlans,
  studentProfiles,
  tutorSessions
} from "@cogniva/database";
import { redirect } from "next/navigation";
import { getSignedInStudent, getStudentDatabase } from "@/lib/student-data";

export async function requireCompletedStudent() {
  const student = await getSignedInStudent();
  if (!student) redirect("/login");

  const db = getStudentDatabase();
  const [profile] = await db
    .select({
      onboardingCompletedAt: studentProfiles.onboardingCompletedAt,
      institutionId: studentProfiles.institutionId,
      selfReportedInstitution: studentProfiles.selfReportedInstitution,
      institutionName: institutions.name,
      countryCode: institutions.countryCode
    })
    .from(studentProfiles)
    .leftJoin(institutions, eq(studentProfiles.institutionId, institutions.id))
    .where(eq(studentProfiles.userId, student.id))
    .limit(1);

  if (!profile?.onboardingCompletedAt) redirect("/onboarding");
  return { student, profile };
}

type TutorSessionState = (typeof tutorSessions.$inferSelect)["state"];

const resumableTutorSessionStates: TutorSessionState[] = [
  "created",
  "interpreting",
  "needs_confirmation",
  "ready",
  "guiding",
  "awaiting_attempt",
  "explaining_why",
  "evaluating_attempt",
  "correcting_misconception"
];

export async function getStudentHomeActivity(studentId: string) {
  const db = getStudentDatabase();

  const [sessions, approvedPlanRows] = await Promise.all([
    db
      .select({
        id: tutorSessions.id,
        intent: tutorSessions.intent,
        initialPrompt: tutorSessions.initialPrompt,
        state: tutorSessions.state,
        updatedAt: tutorSessions.updatedAt
      })
      .from(tutorSessions)
      .where(
        and(
          eq(tutorSessions.studentId, studentId),
          inArray(tutorSessions.state, resumableTutorSessionStates)
        )
      )
      .orderBy(desc(tutorSessions.updatedAt))
      .limit(5),
    db
      .select({
        id: learningPlans.id,
        initialInput: learningPlans.initialInput,
        updatedAt: learningPlans.updatedAt,
        revisionId: learningPlanRevisions.id,
        revisionNumber: learningPlanRevisions.revisionNumber,
        title: learningPlanRevisions.title,
        summary: learningPlanRevisions.summary
      })
      .from(learningPlans)
      .innerJoin(
        learningPlanRevisions,
        eq(learningPlanRevisions.learningPlanId, learningPlans.id)
      )
      .where(
        and(
          eq(learningPlans.studentId, studentId),
          eq(learningPlans.status, "active"),
          eq(learningPlanRevisions.status, "approved")
        )
      )
      .orderBy(
        desc(learningPlans.updatedAt),
        desc(learningPlanRevisions.revisionNumber)
      )
      .limit(50)
  ]);

  // A plan may retain earlier approved revisions while a newer proposal is
  // awaiting review. Show only its newest approved revision on Home.
  const seenPlanIds = new Set<string>();
  const activePlans = approvedPlanRows
    .filter((plan) => {
      if (seenPlanIds.has(plan.id)) return false;
      seenPlanIds.add(plan.id);
      return true;
    })
    .slice(0, 4);

  return { sessions, activePlans };
}
