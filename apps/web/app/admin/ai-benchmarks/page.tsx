import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/lib/admin-navigation";
import { getAdminAccess } from "@/lib/admin-data";
import { AiBenchmarkWorkspace } from "./benchmark-workspace";
import "../admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI benchmarking",
  description: "Run and review Cogniva's blinded AI provider benchmark."
};

export default async function AiBenchmarksPage() {
  let access;
  try {
    access = await getAdminAccess();
  } catch {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          <p className="admin-eyebrow">COGNIVA / ADMIN</p>
          <h1>Benchmarking is unavailable</h1>
          <p>Authentication could not be verified. No benchmark data was loaded.</p>
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
          <p>This account does not have permission to run provider benchmarks.</p>
          <Link href="/dashboard">Return to your learning workspace</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark">c</span>
          <span>cogniva <small>ADMIN</small></span>
        </Link>
        <AdminNavigation active="ai-benchmarks" />
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
            <h1>AI benchmarking</h1>
            <p>Compare provider outputs with fixed cases and blinded human review.</p>
          </div>
          <span className="admin-role-pill">Administrator</span>
        </header>

        <AiBenchmarkWorkspace />

        <footer className="admin-footer">
          <span>Signed in as {access.admin.email}</span>
          <span>Understand More. Think Better.</span>
        </footer>
      </section>
    </main>
  );
}
