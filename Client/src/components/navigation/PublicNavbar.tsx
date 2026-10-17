import type { CSSProperties } from "react";
import { Link, NavLink } from "react-router-dom";
import logoSrc from "@/assets/images/prestar-logo.png";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

export default function PublicNavbar() {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "text-forest underline" : "text-ink hover:text-forest"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link to={ROUTES.home} className="flex items-center" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
          {/* Same logo and size as the login and signup pages. */}
          <span className="app-brand-art" style={{ "--h": "3rem" } as CSSProperties}>
            <img src={logoSrc} alt="" />
          </span>
        </Link>
        <nav
          id="public-nav"
          className="flex flex-row items-center gap-2 sm:gap-4"
        >
          <NavLink to={ROUTES.home} end className={link} style={{ textDecoration: "none" }}>Home</NavLink>
          <NavLink to={ROUTES.contact} className={link} style={{ textDecoration: "none" }}>Contact</NavLink>
          {user ? (
            <Link to={homePathFor(user)} className="btn btn-primary" style={{ textDecoration: "none" }}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to={ROUTES.login} className="btn btn-ghost" style={{ textDecoration: "none" }}>Log in</Link>
              <Link to={ROUTES.signup} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}