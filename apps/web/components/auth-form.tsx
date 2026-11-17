"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthFormProps = {
  mode: "register" | "login";
};

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (isRegister && password !== confirmPassword) {
      setFormError("Your passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        const { error } = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password,
          callbackURL: "/verify-email"
        });

        if (error) {
          setFormError(
            error.message || "We could not process your registration."
          );
          return;
        }

        setRegistrationSubmitted(true);
        return;
      }

      const { error } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        callbackURL: "/"
      });

      if (error) {
        setFormError(
          error.status === 403
            ? "This account needs email verification before sign-in. Check your inbox for a Cogniva verification message."
            : error.message || "We could not sign you in. Check your details and try again."
        );
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFormError(
        "Authentication is temporarily unavailable. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

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

      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-card">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            {isRegister ? "START LEARNING WITH COGNIVA" : "WELCOME BACK"}
          </p>

          {registrationSubmitted ? (
            <div className="auth-result" role="status">
              <span className="auth-result-mark" aria-hidden="true">
                ✓
              </span>
              <h1 id="auth-title">Check your email</h1>
              <p>
                Your registration request was accepted. Cogniva requires email
                verification before sign-in. Check your inbox and spam folder
                for a verification link.
              </p>
              <p className="auth-result-note">
                During this early test, Resend's shared sender can deliver only
                to the email address associated with your Resend account.
                Other recipients require a verified sending domain.
              </p>
              <Link className="auth-button" href="/login">
                Continue to sign in
              </Link>
              <Link className="auth-secondary-link" href="/">
                Return to Cogniva
              </Link>
            </div>
          ) : (
            <>
              <h1 id="auth-title">
                {isRegister ? "Create your account." : "Continue learning."}
              </h1>
              <p className="auth-intro">
                {isRegister
                  ? "Create a secure account to prepare for your guided learning experience."
                  : "Sign in to continue to your Cogniva learning space."}
              </p>

              <form className="auth-form" onSubmit={handleSubmit}>
                {isRegister && (
                  <label className="auth-field">
                    <span>Full name</span>
                    <input
                      autoComplete="name"
                      maxLength={100}
                      name="name"
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your full name"
                      required
                      value={name}
                    />
                  </label>
                )}

                <label className="auth-field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    maxLength={254}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <input
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    maxLength={128}
                    minLength={12}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 12 characters"
                    required
                    type="password"
                    value={password}
                  />
                  {isRegister && (
                    <small>
                      Use at least 12 characters. Avoid reusing another
                      account's password.
                    </small>
                  )}
                </label>

                {isRegister && (
                  <label className="auth-field">
                    <span>Confirm password</span>
                    <input
                      autoComplete="new-password"
                      maxLength={128}
                      minLength={12}
                      name="confirmPassword"
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Enter your password again"
                      required
                      type="password"
                      value={confirmPassword}
                    />
                  </label>
                )}

                {formError && (
                  <p className="auth-error" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  className="auth-button"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting
                    ? "Please wait..."
                    : isRegister
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>

              {isRegister && (
                <p className="auth-test-note">
                  <strong>Early testing note:</strong> Until Cogniva has a
                  verified sending domain, use the email address associated
                  with your Resend account to receive the verification link.
                </p>
              )}

              <p className="auth-switch">
                {isRegister ? "Already have an account?" : "New to Cogniva?"}{" "}
                <Link href={isRegister ? "/login" : "/register"}>
                  {isRegister ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="auth-footer">
          Understand More. Think Better.
        </p>
      </section>
    </main>
  );
}
