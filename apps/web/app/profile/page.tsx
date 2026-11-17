import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentOnboardingForm } from "@/components/student-onboarding-form";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { getSignedInStudent } from "@/lib/student-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your optional academic context."
};

export default async function ProfilePage() {
  const student = await getSignedInStudent();
  if (!student) redirect("/login");

  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active="profile" />
      <div className="workspace-main workspace-profile-main">
        <StudentOnboardingForm mode="profile" />
      </div>
    </div>
  );
}
