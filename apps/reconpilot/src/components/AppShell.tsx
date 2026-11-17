import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { store } from "../lib/store";
import { Icon, Logo } from "./ui";

const NAV = [
  { to: "/app", label: "Overview", icon: "overview", end: true },
  { to: "/app/runs", label: "Reconciliations", icon: "runs" },
  { to: "/app/exceptions", label: "Exceptions", icon: "exceptions" },
  { to: "/app/accounts", label: "Bank accounts", icon: "accounts" },
  { to: "/app/audit", label: "Audit log", icon: "audit" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Main">
        <div className="side-top">
          <Link to="/app" className="side-logo"><Logo /></Link>
          <button type="button" className="icon-btn only-mobile" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
        <div className="workspace">
          <span className="ws-mark" aria-hidden>{(user?.workspace ?? "W").slice(0, 1)}</span>
          <span className="ws-name">{user?.workspace}</span>
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <Link to="/app/runs/new" className="btn primary side-cta">
          <Icon name="plus" size={16} /> New reconciliation
        </Link>
        <div className="side-foot">
          <span className={`mode ${store.mode}`} title={store.mode === "supabase" ? "Data is stored in Supabase Postgres with row-level security" : "Supabase is not configured: data stays in this browser"}>
            <i aria-hidden /> {store.mode === "supabase" ? "Supabase · RLS on" : "Local workspace"}
          </span>
          <div className="me">
            <span className="avatar" aria-hidden>{initials}</span>
            <span className="me-mail">{user?.email}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                await signOut();
                nav("/");
              }}
            >
              <Icon name="out" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
