import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { studentProfiles } from "@cogniva/database";
import { StudentOnboardingForm } from "@/components/student-onboarding-form";
import { getSignedInStudent, getStudentDatabase } from "@/lib/student-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose your institution",
  description: "Optionally add your institution to personalise your Cogniva learning experience."
};

export default async function OnboardingPage() {
  const student = await getSignedInStudent();
  if (!student) redirect("/login");

  const db = getStudentDatabase();
  const [profile] = await db
    .select({ onboardingCompletedAt: studentProfiles.onboardingCompletedAt })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, student.id))
    .limit(1);

  if (profile?.onboardingCompletedAt) redirect("/dashboard");

  return <StudentOnboardingForm />;
}
