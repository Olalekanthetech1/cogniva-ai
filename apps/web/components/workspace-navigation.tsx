import Link from "next/link";

type ActiveDestination = "home" | "learn" | "tutor" | "profile";

const destinations = [
  { key: "home", label: "Home", href: "/dashboard", icon: "⌂" },
  { key: "learn", label: "Learn", href: "/learn", icon: "▤" },
  { key: "tutor", label: "Tutor", href: "/tutor", icon: "◌" },
  { key: "progress", label: "Progress", href: null, icon: "▥" },
  { key: "profile", label: "Profile", href: "/profile", icon: "♙" }
] as const;

export function WorkspaceNavigation({
  active
}: {
  active: ActiveDestination;
}) {
  return (
    <>
      <aside className="workspace-sidebar">
        <Link className="brand" href="/dashboard" aria-label="Cogniva home">
          <span className="brand-mark" aria-hidden="true">c</span>
          <span className="brand-name">cogniva</span>
        </Link>
        <nav className="workspace-nav" aria-label="Primary navigation">
          {destinations.map((item) =>
            item.href ? (
              <Link
                aria-current={active === item.key ? "page" : undefined}
                className={`workspace-nav-item ${active === item.key ? "is-active" : ""}`}
                href={item.href}
                key={item.key}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="workspace-nav-item is-disabled"
                key={item.key}
                title={`${item.label} will be available in a later Cogniva phase`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                <small>Coming later</small>
              </span>
            )
          )}
        </nav>
      </aside>

      <nav className="workspace-bottom-nav" aria-label="Primary navigation">
        {destinations.map((item) =>
          item.href ? (
            <Link
              aria-current={active === item.key ? "page" : undefined}
              className={`workspace-bottom-item ${active === item.key ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{item.label}</small>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="workspace-bottom-item is-disabled"
              key={item.key}
              title={`${item.label} will be available in a later Cogniva phase`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{item.label}</small>
            </span>
          )
        )}
      </nav>
    </>
  );
}
