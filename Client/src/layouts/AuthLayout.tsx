import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import logoSrc from "@/assets/images/prestar-logo.png";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

type Variant = "login" | "signup" | "plain";

/** Auth pages: one compact rounded card. The form is white; a soft panel sits beside it on large screens. */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { pathname } = useLocation();
  const variant: Variant = pathname === ROUTES.login ? "login" : pathname === ROUTES.signup ? "signup" : "plain";

  return (
    <div className="auth-split">
      <header className="auth-top">
        <Link to={ROUTES.home} aria-label="PRESTAR home" className="auth-top__brand">
          <span className="app-brand-art" style={{ "--h": "3rem" } as CSSProperties}>
            <img src={logoSrc} alt="" />
          </span>
        </Link>
        <Link to={ROUTES.home} className="link-btn">← Back to home</Link>
      </header>

      <main className="auth-body">
        <div className="auth-shell" data-variant={variant}>
          <section className="auth-card">
            <div className="auth-card__head">
              <h1>{title}</h1>
              {subtitle && <p className="subtle">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="auth-card__foot subtle">{footer}</div>}
          </section>

          <aside className="auth-aside">
            <div className="auth-aside__inner">
              {variant === "login" && (
                <>
                  <span className="auth-aside__eyebrow">New here?</span>
                  <h2>Hello, Reader!</h2>
                  <p>Create a student account and start your library journey with us.</p>
                  <Link to={ROUTES.signup} className="auth-aside__cta">Create account</Link>
                </>
              )}
              {variant === "signup" && (
                <>
                  <span className="auth-aside__eyebrow">Already a member?</span>
                  <h2>Welcome back!</h2>
                  <p>Log in to see your requests, reservations and recommendations.</p>
                  <Link to={ROUTES.login} className="auth-aside__cta">Log in</Link>
                </>
              )}
              {variant === "plain" && (
                <>
                  <span className="auth-aside__eyebrow">University library</span>
                  <h2>Find it. Request it. Pick it up.</h2>
                  <p>Browse the catalog, request books, reserve what is out, and collect them at the library.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}