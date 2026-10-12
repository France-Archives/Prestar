import { Link, NavLink, useLocation } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

const OUTLINE = {
  textDecoration: "none",
  background: "transparent",
  border: "1.5px solid var(--color-forest)",
  color: "var(--color-forest-deep)",
} as const;

export default function PublicNavbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onLanding = pathname === ROUTES.home;
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${isActive ? "text-forest underline" : "text-forest-deep hover:text-amber-ink"}`;

  return (
    <header
      className={
        onLanding
          ? "absolute inset-x-0 top-0 z-30"
          : "sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur"
      }
    >
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:h-20 sm:px-8 lg:px-12">
        <Link to={ROUTES.home} className="flex items-center" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
          <Logo height={40} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <NavLink to={ROUTES.contact} className={link} style={{ textDecoration: "none" }}>
            Contact
          </NavLink>
          {user ? (
            <Link to={homePathFor(user)} className="btn btn-primary whitespace-nowrap" style={{ textDecoration: "none" }}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to={ROUTES.login} className="btn whitespace-nowrap" style={OUTLINE}>
                Log in
              </Link>
              <Link to={ROUTES.signup} className="btn btn-primary whitespace-nowrap" style={{ textDecoration: "none", color: "#fff" }}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}