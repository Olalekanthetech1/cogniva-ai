import Link from "next/link";

type AdminNavigationProps = {
  active: "overview" | "ai-configuration";
};

export function AdminNavigation({ active }: AdminNavigationProps) {
  return (
    <nav className="admin-navigation" aria-label="Administration">
      <Link
        className={`admin-nav-item${active === "overview" ? " is-active" : ""}`}
        href="/admin"
        aria-current={active === "overview" ? "page" : undefined}
      >
        <span aria-hidden="true">▦</span> Overview
      </Link>
      <Link
        className={`admin-nav-item${active === "ai-configuration" ? " is-active" : ""}`}
        href="/admin/ai-configuration"
        aria-current={active === "ai-configuration" ? "page" : undefined}
      >
        <span aria-hidden="true">◈</span> AI configuration
      </Link>
      <span className="admin-nav-item is-unavailable" aria-disabled="true">
        <span aria-hidden="true">✎</span> Prompt management
        <small>Not available yet</small>
      </span>
      <span className="admin-nav-item is-unavailable" aria-disabled="true">
        <span aria-hidden="true">♙</span> User management
        <small>Not available yet</small>
      </span>
      <span className="admin-nav-item is-unavailable" aria-disabled="true">
        <span aria-hidden="true">◷</span> Audit logs
        <small>Not available yet</small>
      </span>
    </nav>
  );
}
