import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/lib/admin-navigation";
import { getAdminAiConfiguration } from "@/lib/admin-ai-config";
import { getAdminAiModelRegistry } from "@/lib/admin-ai-model-registry";
import { AiModelRegistryEditor } from "./model-registry-editor";
import { getAdminAccess } from "@/lib/admin-data";
import { AiConfigurationEditor } from "./configuration-editor";
import "../admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Configuration",
  description: "Configure Cogniva's AI provider routing preferences."
};

export default async function AdminAiConfigurationPage() {
  let access;
  try {
    access = await getAdminAccess();
  } catch {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          <p className="admin-eyebrow">COGNIVA / ADMIN</p>
          <h1>AI configuration is unavailable</h1>
          <p>Authentication could not be verified. No administrative settings were loaded.</p>
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
          <p>This account does not have permission to configure platform AI settings.</p>
          <Link href="/dashboard">Return to your learning workspace</Link>
        </section>
      </main>
    );
  }

  let configuration: Awaited<ReturnType<typeof getAdminAiConfiguration>> | null = null;
  let modelRegistry: Awaited<ReturnType<typeof getAdminAiModelRegistry>> | null = null;
  try {
    configuration = await getAdminAiConfiguration();
  } catch {
    // The editor is not rendered with invented defaults when storage is down.
  }
  try {
    modelRegistry = await getAdminAiModelRegistry();
  } catch {
    // Keep provider configuration visible without inventing registry state.
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark">c</span>
          <span>cogniva <small>ADMIN</small></span>
        </Link>
        <AdminNavigation active="ai-configuration" />
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
            <h1>AI configuration</h1>
            <p>Manage provider credentials, the model registry and saved task-routing preferences.</p>
          </div>
          <span className="admin-role-pill">Administrator</span>
        </header>

        {configuration ? (
          <AiConfigurationEditor initialConfiguration={configuration} />
        ) : (
          <div className="admin-notice is-warning" role="status">
            <strong>Configuration storage unavailable</strong>
            <span>
              Cogniva could not load the saved routing preferences. No defaults or sample
              provider statuses are being displayed. Refresh after database connectivity is restored.
            </span>
          </div>
        )}

        {modelRegistry ? (
          <AiModelRegistryEditor initialRegistry={modelRegistry} />
        ) : (
          <div className="admin-notice is-warning" role="status">
            <strong>Model registry unavailable</strong>
            <span>Registry data could not be loaded. No sample models or eligibility states are displayed.</span>
          </div>
        )}

        <footer className="admin-footer">
          <span>Signed in as {access.admin.email}</span>
          <span>Understand More. Think Better.</span>
        </footer>
      </section>
    </main>
  );
}
