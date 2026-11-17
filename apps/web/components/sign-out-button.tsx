"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setBusy(true);
    setError("");

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Cogniva could not sign you out. Please try again.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Cogniva could not sign you out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-signout">
      <button
        className="onboarding-signout-button"
        disabled={busy}
        onClick={handleSignOut}
        type="button"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span className="onboarding-signout-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
