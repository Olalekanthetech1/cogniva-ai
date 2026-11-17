"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

type CatalogueOption = {
  id: string;
  name: string;
};

type StudentProfile = {
  id: string;
  institutionId: string | null;
  facultyId: string | null;
  departmentId: string | null;
  programme: string | null;
  yearOfStudy: number | null;
};

type ListResponse = { data: CatalogueOption[] };
type ProfileResponse = { data: StudentProfile | null };

async function readList(url: string): Promise<CatalogueOption[]> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("The academic catalogue could not be loaded.");
  }

  const result = (await response.json()) as ListResponse;
  return result.data;
}

export function StudentOnboardingForm() {
  const router = useRouter();

  const [institutions, setInstitutions] = useState<CatalogueOption[]>([]);
  const [faculties, setFaculties] = useState<CatalogueOption[]>([]);
  const [departments, setDepartments] = useState<CatalogueOption[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programme, setProgramme] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [catalogueError, setCatalogueError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoading(true);
      setPageError("");

      try {
        const [institutionResponse, profileResponse] = await Promise.all([
          fetch("/api/v1/academic/institutions", {
            credentials: "same-origin",
            cache: "no-store"
          }),
          fetch("/api/v1/student/profile", {
            credentials: "same-origin",
            cache: "no-store"
          })
        ]);

        if (
          institutionResponse.status === 401 ||
          profileResponse.status === 401
        ) {
          router.replace("/login");
          return;
        }

        if (!institutionResponse.ok || !profileResponse.ok) {
          throw new Error("Cogniva could not load your academic profile.");
        }

        const [institutionResult, profileResult] = (await Promise.all([
          institutionResponse.json(),
          profileResponse.json()
        ])) as [ListResponse, ProfileResponse];

        if (!active) return;

        setInstitutions(institutionResult.data);
        const profile = profileResult.data;

        if (profile) {
          setInstitutionId(profile.institutionId ?? "");
          setFacultyId(profile.facultyId ?? "");
          setDepartmentId(profile.departmentId ?? "");
          setProgramme(profile.programme ?? "");
          setYearOfStudy(
            profile.yearOfStudy === null ? "" : String(profile.yearOfStudy)
          );

          if (profile.institutionId) {
            const facultyOptions = await readList(
              `/api/v1/academic/faculties?institutionId=${encodeURIComponent(profile.institutionId)}`
            );
            if (!active) return;
            setFaculties(facultyOptions);

            if (profile.facultyId) {
              const departmentOptions = await readList(
                `/api/v1/academic/departments?facultyId=${encodeURIComponent(profile.facultyId)}`
              );
              if (!active) return;
              setDepartments(departmentOptions);
            }
          }
        }
      } catch (error) {
        if (active) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Cogniva could not load your academic profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleInstitutionChange(nextId: string) {
    setInstitutionId(nextId);
    setFacultyId("");
    setDepartmentId("");
    setFaculties([]);
    setDepartments([]);
    setCatalogueError("");
    setSaved(false);

    if (!nextId) return;

    setLoadingFaculties(true);
    try {
      const options = await readList(
        `/api/v1/academic/faculties?institutionId=${encodeURIComponent(nextId)}`
      );
      setFaculties(options);
    } catch (error) {
      setCatalogueError(
        error instanceof Error
          ? error.message
          : "Faculties could not be loaded."
      );
    } finally {
      setLoadingFaculties(false);
    }
  }

  async function handleFacultyChange(nextId: string) {
    setFacultyId(nextId);
    setDepartmentId("");
    setDepartments([]);
    setCatalogueError("");
    setSaved(false);

    if (!nextId) return;

    setLoadingDepartments(true);
    try {
      const options = await readList(
        `/api/v1/academic/departments?facultyId=${encodeURIComponent(nextId)}`
      );
      setDepartments(options);
    } catch (error) {
      setCatalogueError(
        error instanceof Error
          ? error.message
          : "Departments could not be loaded."
      );
    } finally {
      setLoadingDepartments(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSaved(false);

    if (
      !institutionId &&
      !programme.trim() &&
      !yearOfStudy
    ) {
      setFormError("Add at least one academic detail before saving.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/v1/student/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: institutionId || null,
          facultyId: facultyId || null,
          departmentId: departmentId || null,
          programme: programme.trim() || null,
          yearOfStudy: yearOfStudy ? Number(yearOfStudy) : null
        })
      });

      const result = (await response.json()) as {
        data?: StudentProfile;
        error?: { message?: string };
      };

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error?.message || "Your academic profile could not be saved."
        );
      }

      setSaved(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Your academic profile could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-topbar">
        <Link className="brand" href="/" aria-label="Cogniva home">
          <span className="brand-mark" aria-hidden="true">
            c
          </span>
          <span className="brand-name">cogniva</span>
        </Link>
        <div className="onboarding-topbar-actions">
          <span className="onboarding-step">STUDENT SETUP · 1 OF 1</span>
          <SignOutButton />
        </div>
      </header>

      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <div className="onboarding-heading">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            YOUR ACADEMIC CONTEXT
          </p>
          <h1 id="onboarding-title">Let&apos;s set up your learning profile.</h1>
          <p>
            Add your academic details so Cogniva can organise learning around
            your programme. You can update this information later.
          </p>
        </div>

        <section className="onboarding-card" aria-label="Academic profile">
          {loading ? (
            <p className="onboarding-state" role="status">
              Loading your academic profile…
            </p>
          ) : pageError ? (
            <div className="onboarding-error" role="alert">
              <p>{pageError}</p>
              <button
                className="onboarding-secondary-button"
                onClick={() => window.location.reload()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : (
            <form className="onboarding-form" onSubmit={handleSubmit}>
              <div className="onboarding-form-heading">
                <h2>Academic information</h2>
                <p>These details are optional. Add what is currently available.</p>
              </div>

              <label className="onboarding-field">
                <span>University or institution</span>
                <select
                  onChange={(event) =>
                    void handleInstitutionChange(event.target.value)
                  }
                  value={institutionId}
                >
                  <option value="">Select an institution</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
                {institutions.length === 0 && (
                  <small>
                    No institutions have been added to the academic catalogue
                    yet. You can save your programme and study level now, then
                    add your institution when it becomes available.
                  </small>
                )}
              </label>

              <label className="onboarding-field">
                <span>Faculty</span>
                <select
                  disabled={!institutionId || loadingFaculties}
                  onChange={(event) =>
                    void handleFacultyChange(event.target.value)
                  }
                  value={facultyId}
                >
                  <option value="">
                    {loadingFaculties ? "Loading faculties…" : "Select a faculty"}
                  </option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="onboarding-field">
                <span>Department</span>
                <select
                  disabled={!facultyId || loadingDepartments}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setSaved(false);
                  }}
                  value={departmentId}
                >
                  <option value="">
                    {loadingDepartments
                      ? "Loading departments…"
                      : "Select a department"}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="onboarding-field">
                <span>Programme or degree</span>
                <input
                  maxLength={160}
                  onChange={(event) => {
                    setProgramme(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Materials Science and Engineering"
                  value={programme}
                />
              </label>

              <label className="onboarding-field">
                <span>Current year of study</span>
                <select
                  onChange={(event) => {
                    setYearOfStudy(event.target.value);
                    setSaved(false);
                  }}
                  value={yearOfStudy}
                >
                  <option value="">Select your current level</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year} level
                      </option>
                    )
                  )}
                </select>
              </label>

              {catalogueError && (
                <p className="onboarding-error" role="alert">
                  {catalogueError}
                </p>
              )}
              {formError && (
                <p className="onboarding-error" role="alert">
                  {formError}
                </p>
              )}
              {saved && (
                <p className="onboarding-success" role="status">
                  Your academic profile has been saved.
                </p>
              )}

              <div className="onboarding-actions">
                <button
                  className="onboarding-primary-button"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving profile…" : "Save academic profile"}
                </button>
                <Link className="onboarding-skip" href="/">
                  Skip for now
                </Link>
              </div>
            </form>
          )}
        </section>

        <p className="onboarding-footer">
          Your academic profile belongs to your Cogniva account.
          <span> Understand More. Think Better.</span>
        </p>
      </section>
    </main>
  );
}
