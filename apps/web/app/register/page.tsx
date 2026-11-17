import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a Cogniva account to prepare for guided learning."
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
