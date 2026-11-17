import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email verification",
  description: "Email verification status for your Cogniva account."
};

type VerifyEmailPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function VerifyEmailPage({
  searchParams
}: VerifyEmailPageProps) {
  const { error } = await searchParams;
  const invalidLink = Boolean(error);

  return (
    <main className="auth-shell">
      <header className="auth-topbar">
        <Link className="brand" href="/" aria-label="Cogniva home">
          <span className="brand-mark" aria-hidden="true">
            c
          </span>
          <span className="brand-name">cogniva</span>
        </Link>
        <Link className="auth-home-link" href="/">
          Back to home
        </Link>
      </header>

      <section className="auth-content">
        <div className="auth-card auth-result" role="status">
          <span className="auth-result-mark" aria-hidden="true">
            {invalidLink ? "!" : "✓"}
          </span>
          <p className="eyebrow">COGNIVA ACCOUNT SECURITY</p>
          <h1>
            {invalidLink
              ? "This verification link could not be used."
              : "Verification link accepted."}
          </h1>
          <p>
            {invalidLink
              ? "The link may have expired or already been used. Return to sign in and request another verification email."
              : "If you arrived here after opening a valid Cogniva verification link, your email address has been verified. You can now sign in."}
          </p>
          <Link className="auth-button" href="/login">
            Go to sign in
          </Link>
          <Link className="auth-secondary-link" href="/">
            Return to Cogniva
          </Link>
        </div>

        <p className="auth-footer">Understand More. Think Better.</p>
      </section>
    </main>
  );
}
