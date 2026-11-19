import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/password-recovery-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a secure password-reset link for your Cogniva account.",
  robots: { index: false, follow: false }
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <header className="auth-topbar">
        <Link className="brand" href="/" aria-label="Cogniva home">
          <span className="brand-mark" aria-hidden="true">c</span>
          <span className="brand-name">cogniva</span>
        </Link>
        <Link className="auth-home-link" href="/">Back to home</Link>
      </header>
      <section className="auth-content">
        <ForgotPasswordForm />
        <p className="auth-footer">Understand More. Think Better.</p>
      </section>
    </main>
  );
}
