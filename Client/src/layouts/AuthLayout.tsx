import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import Logo from "@/components/common/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const SPINES: [number, string][] = [
  [96, "#2d6a4f"], [128, "#335c67"], [84, "#9e2a2b"], [118, "#e09f3e"], [140, "#2d6a4f"],
  [100, "#335c67"], [124, "#f2e8cf"], [90, "#9e2a2b"], [132, "#2d6a4f"], [108, "#e09f3e"],
];

/** Auth pages: a forest editorial panel on large screens, and a centered card for the form. */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-split">
      <aside className="auth-aside">
        <span className="eyebrow" style={{ color: "var(--color-amber)" }}>University library</span>
        <h2>Find it. Request it. Pick it up.</h2>
        <p>Browse the catalog, request books, reserve what is out, and collect them at the library.</p>
        <div className="auth-spines" aria-hidden="true">
          {SPINES.map(([h, c], i) => (
            <span key={i} style={{ height: h, background: c }} />
          ))}
        </div>
      </aside>
      <div className="auth-main">
        <header className="auth-top">
          <Link to={ROUTES.home} aria-label="PRESTAR home" className="flex items-center">
            <Logo height={56} />
          </Link>
          <Link to={ROUTES.home} className="link-btn">← Back to home</Link>
        </header>
        <main className="auth-body">
          <div className="card auth-card">
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <h1>{title}</h1>
              {subtitle && <p className="subtle" style={{ marginTop: 6 }}>{subtitle}</p>}
            </div>
            {children}
            {footer && <div style={{ marginTop: 16, textAlign: "center" }} className="subtle">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}