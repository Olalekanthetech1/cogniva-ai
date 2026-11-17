import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { institutions, studentProfiles } from "@cogniva/database";
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
