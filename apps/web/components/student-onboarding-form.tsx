"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

type InstitutionOption = {
  id: string;
  name: string;
  countryCode: string | null;
};

type StudentProfile = {
  institutionId: string | null;
  institutionName: string | null;
  countryCode: string | null;
  selfReportedInstitution: string | null;
  onboardingCompletedAt: string | null;
};

type Mode = "onboarding" | "profile";

function countryLabel(countryCode: string | null): string | null {
  if (!countryCode) return null;
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ??
      countryCode.toUpperCase()
    );
  } catch {
    return countryCode.toUpperCase();
  }
}

export function StudentOnboardingForm({ mode = "onboarding" }: { mode?: Mode }) {
  const router = useRouter();
  const isProfile = mode === "profile";
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<InstitutionOption[]>([]);
  const [selected, setSelected] = useState<InstitutionOption | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [selfReportedName, setSelfReportedName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoadingProfile(true);
      setError("");
      try {
        const response = await fetch("/api/v1/student/profile", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Your profile could not be loaded. Please try again.");
        }

        const result = (await response.json()) as { data: StudentProfile | null };
        const profile = result.data;
        if (!profile) return;

        if (profile.institutionId && profile.institutionName) {
          const institution = {
            id: profile.institutionId,
            name: profile.institutionName,
            countryCode: profile.countryCode
          };
          setSelected(institution);
          setSearch(profile.institutionName);
        } else if (profile.selfReportedInstitution) {
          setNotListed(true);
          setSelfReportedName(profile.selfReportedInstitution);
        }
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Your profile could not be loaded. Please try again."
        );
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    const query = search.trim();
    if (selected || notListed || query.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(
          `/api/v1/academic/institutions?q=${encodeURIComponent(query)}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Institution search is temporarily unavailable.");
        }

        const result = (await response.json()) as {
          data: InstitutionOption[];
        };
        setResults(result.data);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setSearchError(
          cause instanceof Error
            ? cause.message
            : "Institution search is temporarily unavailable."
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, selected, notListed, router]);

  function chooseInstitution(institution: InstitutionOption) {
    setSelected(institution);
    setSearch(institution.name);
    setNotListed(false);
    setSelfReportedName("");
    setResults([]);
    setError("");
  }

  function startNotListed() {
    setSelected(null);
    setNotListed(true);
    setSelfReportedName(search.trim());
    setResults([]);
    setError("");
  }

  async function complete(choice: "catalogue" | "not_listed" | "skip") {
    setSaving(true);
    setError("");

    const payload =
      choice === "catalogue" && selected
        ? { choice, institutionId: selected.id }
        : choice === "not_listed"
          ? { choice, institutionName: selfReportedName.trim() }
          : { choice: "skip" as const };

    try {
      const response = await fetch("/api/v1/student/onboarding", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };

      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "Your choice could not be saved. Please try again."
        );
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your choice could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) {
      void complete("catalogue");
      return;
    }
    if (notListed) {
      if (selfReportedName.trim().length < 2) {
        setError("Enter your institution's name, or choose Skip for now.");
        return;
      }
      void complete("not_listed");
      return;
    }
    setError("Select an institution, report one not listed, or skip for now.");
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-topbar">
        <Link className="brand" href="/dashboard" aria-label="Cogniva dashboard">
          <span className="brand-mark" aria-hidden="true">c</span>
          <span className="brand-name">cogniva</span>
        </Link>
        <div className="onboarding-topbar-actions">
          <span className="onboarding-step">{isProfile ? "YOUR PROFILE" : "QUICK SETUP"}</span>
          <SignOutButton />
        </div>
      </header>

      <section className="institution-setup" aria-labelledby="institution-title">
        <p className="eyebrow">
          <span className="status-dot" aria-hidden="true" />
          {isProfile ? "PERSONALISE YOUR LEARNING" : "WELCOME TO COGNIVA"}
        </p>
        <h1 id="institution-title">
          {isProfile ? "Your learning context." : "Which institution do you attend?"}
        </h1>
        <p className="institution-intro">
          {isProfile
            ? "Your institution is optional. You can change it, report one that is not listed, or continue independently."
            : "We can use this to personalise your learning. You can skip this and start learning immediately."}
        </p>

        <section className="institution-card" aria-label="Institution selection">
          {loadingProfile ? (
            <p className="onboarding-state" role="status">Loading your profile…</p>
          ) : (
            <form className="institution-form" onSubmit={handleSubmit}>
              {!notListed && !selected && (
                <>
                  <label className="onboarding-field" htmlFor="institution-search">
                    <span>Search institutions worldwide</span>
                    <input
                      id="institution-search"
                      autoComplete="off"
                      maxLength={80}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setError("");
                      }}
                      placeholder="Type your university or college name"
                      value={search}
                    />
                  </label>
                  <div className="institution-results" aria-live="polite">
                    {search.length > 0 && search.trim().length < 2 && (
                      <p className="institution-hint">Enter at least two characters to search.</p>
                    )}
                    {searching && <p className="institution-hint">Searching the available catalogue…</p>}
                    {searchError && <p className="onboarding-error" role="alert">{searchError}</p>}
                    {!searching && search.trim().length >= 2 && results.length === 0 && !searchError && (
                      <p className="institution-hint">No matching institution was found in the current catalogue.</p>
                    )}
                    {results.map((institution) => (
                      <button
                        className="institution-result"
                        key={institution.id}
                        onClick={() => chooseInstitution(institution)}
                        type="button"
                      >
                        <span className="institution-result-mark" aria-hidden="true">⌂</span>
                        <span className="institution-result-copy">
                          <strong>{institution.name}</strong>
                          <small>{countryLabel(institution.countryCode) ?? "Country not specified by source"}</small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                  <button className="institution-text-button" onClick={startNotListed} type="button">
                    My institution isn&apos;t listed
                  </button>
                </>
              )}

              {selected && (
                <div className="institution-selected">
                  <div>
                    <small>SELECTED INSTITUTION</small>
                    <strong>{selected.name}</strong>
                    <span>{countryLabel(selected.countryCode) ?? "Country not specified by source"}</span>
                  </div>
                  <button className="institution-text-button" onClick={() => {
                    setSelected(null);
                    setSearch("");
                  }} type="button">Change</button>
                </div>
              )}

              {notListed && (
                <div className="institution-not-listed">
                  <label className="onboarding-field" htmlFor="self-reported-institution">
                    <span>Enter your institution's name</span>
                    <input
                      id="self-reported-institution"
                      autoComplete="organization"
                      maxLength={200}
                      onChange={(event) => setSelfReportedName(event.target.value)}
                      placeholder="Institution name"
                      value={selfReportedName}
                    />
                    <small>This is saved as self-reported information. It will not be added to Cogniva's verified catalogue automatically.</small>
                  </label>
                  <button className="institution-text-button" onClick={() => {
                    setNotListed(false);
                    setSelfReportedName("");
                  }} type="button">Back to search</button>
                </div>
              )}

              {error && <p className="onboarding-error" role="alert">{error}</p>}

              <div className="institution-actions">
                <button
                  className="onboarding-primary-button"
                  disabled={saving || (!selected && !notListed)}
                  type="submit"
                >
                  {saving ? "Saving…" : isProfile ? "Save changes" : "Continue"}
                </button>
                <button
                  className="institution-skip"
                  disabled={saving}
                  onClick={() => void complete("skip")}
                  type="button"
                >
                  Skip for now
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="onboarding-footer">
          Your institution helps personalise Cogniva. It never limits who can learn.
          <span>Understand More. Think Better.</span>
        </p>
      </section>
    </main>
  );
}
