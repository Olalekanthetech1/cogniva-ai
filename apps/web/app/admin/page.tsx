import type { Metadata } from "next";
import Link from "next/link";
import { AdminNavigation } from "@/lib/admin-navigation";
import { redirect } from "next/navigation";
import {
  getAdminAccess,
  getAdminDashboardMetrics
} from "@/lib/admin-data";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  description: "Cogniva platform administration."
};

function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="admin-metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

export default async function AdminPage() {
  let access;
  try {
    access = await getAdminAccess();
  } catch {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          <p className="admin-eyebrow">COGNIVA / ADMIN</p>
          <h1>Administration is unavailable</h1>
          <p>Authentication could not be verified. No administrative data was loaded.</p>
          <Link href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  if (access.kind === "unauthenticated") redirect("/login");

  if (access.kind === "forbidden") {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          <p className="admin-eyebrow">COGNIVA / ADMIN</p>
          <h1>Administrator access required</h1>
          <p>This account does not have permission to access platform administration.</p>
          <Link href="/dashboard">Return to your learning workspace</Link>
        </section>
      </main>
    );
  }

  let metrics: Awaited<ReturnType<typeof getAdminDashboardMetrics>> | null = null;
  try {
    metrics = await getAdminDashboardMetrics();
  } catch {
    metrics = null;
  }

  const number = (value: number) =>
    new Intl.NumberFormat("en").format(value);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark">c</span>
          <span>cogniva <small>ADMIN</small></span>
        </Link>
        <AdminNavigation active="overview" />
        <div className="admin-sidebar-footer">
          <span>{access.admin.name}</span>
          <small>{access.admin.email}</small>
          <Link href="/dashboard">Open student workspace →</Link>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">PLATFORM CONTROL CENTRE</p>
            <h1>Overview</h1>
            <p>Monitor the records currently stored by Cogniva.</p>
          </div>
          <span className="admin-role-pill">Administrator</span>
        </header>

        <section className="admin-section" aria-labelledby="platform-data-title">
          <div className="admin-section-heading">
            <h2 id="platform-data-title">Platform data</h2>
            <span>Live database counts</span>
          </div>

          {metrics ? (
            <div className="admin-metrics-grid">
              <MetricCard
                label="Registered accounts"
                value={number(metrics.users)}
                detail="Accounts stored in Cogniva"
              />
              <MetricCard
                label="Learning plans"
                value={number(metrics.learningPlans)}
                detail="Persisted learner plans"
              />
              <MetricCard
                label="Tutor sessions"
                value={number(metrics.tutorSessions)}
                detail="Persisted tutoring sessions"
              />
              <MetricCard
                label="Database"
                value="Available"
                detail="Live read queries succeeded"
              />
            </div>
          ) : (
            <div className="admin-notice is-warning" role="status">
              <strong>Metrics unavailable</strong>
              <span>The database could not be queried. Counts are not being estimated or substituted.</span>
            </div>
          )}
        </section>

        <section className="admin-section" aria-labelledby="admin-modules-title">
          <div className="admin-section-heading">
            <h2 id="admin-modules-title">Administration modules</h2>
            <span>Available modules will be enabled as their backend controls are implemented</span>
          </div>
          <div className="admin-notice">
            <strong>AI configuration foundation is available</strong>
            <span>
              Gemini, Groq and Mistral credential presence can be checked without exposing secrets,
              and task-routing preferences can be saved. Provider execution and benchmarking are
              still separate implementation work.
            </span>
            <Link href="/admin/ai-configuration">Open AI configuration →</Link>
          </div>
        </section>

        <footer className="admin-footer">
          <span>Signed in as {access.admin.email}</span>
          <span>Understand More. Think Better.</span>
        </footer>
      </section>
    </main>
  );
}
