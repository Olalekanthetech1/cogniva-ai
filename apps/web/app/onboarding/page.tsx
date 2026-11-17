import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StudentOnboardingForm } from "@/components/student-onboarding-form";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Academic profile",
  description: "Set up the academic context for your Cogniva learning profile."
};

export default async function OnboardingPage() {
  const session = await getAuth().api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <StudentOnboardingForm />;
}
