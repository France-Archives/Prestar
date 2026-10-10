import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { ROUTES } from "@/app/routeConfig";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card used by every auth page (login, signup, verify, forgot/reset password, invitation). */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-4 sm:px-8">
        <Link to={ROUTES.home} className="flex items-center" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
          <Logo size="lg" />
        </Link>
        <Link to={ROUTES.home} className="link-btn">← Back to home</Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center">
        <div className="card w-full max-w-[520px]" style={{ padding: "24px 26px 22px" }}>
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <h1>{title}</h1>
            {subtitle && <p className="subtle" style={{ marginTop: 6 }}>{subtitle}</p>}
          </div>
          {children}
          {footer && <div style={{ marginTop: 16, textAlign: "center" }} className="subtle">{footer}</div>}
        </div>
      </main>
    </div>
  );
}