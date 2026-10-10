import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-5 sm:px-8">
        <Link to={ROUTES.home} className="flex items-center gap-2 text-xl font-bold text-forest" style={{ textDecoration: "none" }}>
          <img src="/logo.svg" alt="" width={32} height={32} />
          PRESTAR
        </Link>
        <Link to={ROUTES.home} className="link-btn">← Back to home</Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center">
        <div className="card w-full max-w-[520px]" style={{ padding: "28px 28px 24px" }}>
          <div style={{ marginBottom: 18, textAlign: "center" }}>
            <h1>{title}</h1>
            {subtitle && <p className="subtle" style={{ marginTop: 6 }}>{subtitle}</p>}
          </div>
          {children}
          {footer && <div style={{ marginTop: 18, textAlign: "center" }} className="subtle">{footer}</div>}
        </div>
      </main>
    </div>
  );
}