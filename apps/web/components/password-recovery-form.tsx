"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: new URL("/reset-password", window.location.origin).toString()
      });

      if (result.error) {
        setError("We could not process that request. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Password recovery is temporarily unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="recovery-title">
      {submitted ? (
        <div className="auth-result" role="status">
          <span className="auth-result-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">COGNIVA ACCOUNT SECURITY</p>
          <h1 id="recovery-title">Check your email.</h1>
          <p>
            If an account exists for that address, and email delivery is
            available, Cogniva will send a password-reset link. Check your
            inbox and spam folder.
          </p>
          <Link className="auth-button" href="/login">Return to sign in</Link>
        </div>
      ) : (
        <>
          <p className="eyebrow">COGNIVA ACCOUNT SECURITY</p>
          <h1 id="recovery-title">Reset your password.</h1>
          <p className="auth-intro">
            Enter the email address associated with your Cogniva account.
            We will send a secure reset link when the account can be recovered.
          </p>
          <form className="auth-form" onSubmit={handleSubmit}>
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
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-button" disabled={submitting} type="submit">
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="auth-switch">
            Remember your password? <Link href="/login">Sign in</Link>
          </p>
        </>
      )}
    </section>
  );
}

export function ResetPasswordForm({
  token,
  invalidLink
}: {
  token: string;
  invalidLink: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token || invalidLink) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Use a password between 12 and 128 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token
      });

      if (result.error) {
        setError("This reset link could not be used. It may have expired or already been used. Request a new link.");
        return;
      }

      setComplete(true);
    } catch {
      setError("Password reset is temporarily unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (complete) {
    return (
      <section className="auth-card auth-result" role="status">
        <span className="auth-result-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">COGNIVA ACCOUNT SECURITY</p>
        <h1>Password updated.</h1>
        <p>Your password has been changed. Sign in with your new password.</p>
        <Link className="auth-button" href="/login">Continue to sign in</Link>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <p className="eyebrow">COGNIVA ACCOUNT SECURITY</p>
      <h1 id="reset-title">Choose a new password.</h1>
      <p className="auth-intro">
        Use at least 12 characters. Reset links expire after one hour and can
        be used only once.
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            maxLength={128}
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="auth-field">
          <span>Confirm new password</span>
          <input
            autoComplete="new-password"
            maxLength={128}
            minLength={12}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
        {(error || invalidLink) && (
          <p className="auth-error" role="alert">
            {error || "This reset link is invalid or has expired. Request a new one."}
          </p>
        )}
        <button className="auth-button" disabled={submitting || !token || invalidLink} type="submit">
          {submitting ? "Updating..." : "Update password"}
        </button>
      </form>
      <p className="auth-switch">
        Need another link? <Link href="/forgot-password">Request a new reset link</Link>
      </p>
    </section>
  );
}
