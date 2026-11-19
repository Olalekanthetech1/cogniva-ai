import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/password-recovery-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your Cogniva account.",
  robots: { index: false, follow: false }
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams
}: ResetPasswordPageProps) {
  const { token, error } = await searchParams;

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
        <ResetPasswordForm token={token ?? ""} invalidLink={Boolean(error)} />
        <p className="auth-footer">Understand More. Think Better.</p>
      </section>
    </main>
  );
}
