import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

export default function PublicNavbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "text-forest underline" : "text-ink hover:text-forest"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link to={ROUTES.home} className="flex items-center" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
          <Logo />
        </Link>
        <button type="button" className="lg:hidden btn btn-ghost btn-sm" aria-expanded={open} aria-controls="public-nav" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
        <nav
          id="public-nav"
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-16 flex-col gap-1 border-b border-line bg-paper p-4 lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0`}
        >
          <NavLink to={ROUTES.home} end className={link} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>Home</NavLink>
          <NavLink to={ROUTES.contact} className={link} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>Contact</NavLink>
          {user ? (
            <Link to={homePathFor(user)} className="btn btn-primary" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to={ROUTES.login} className="btn btn-ghost" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>Log in</Link>
              <Link to={ROUTES.signup} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }} onClick={() => setOpen(false)}>Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}