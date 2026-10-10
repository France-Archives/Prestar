import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { homePathFor } from "@/app/routeConfig";
import Logo from "@/components/common/Logo";
import BackButton from "@/components/navigation/BackButton";
import NotificationBell from "@/components/navigation/NotificationBell";
import Sidebar from "@/components/navigation/Sidebar";
import UserMenu from "@/components/navigation/UserMenu";
import { useAuth } from "@/hooks/useAuth";

/** Shared signed-in shell: top bar + role-based sidebar + routed content. Student, Staff and Admin layouts use it. */
export default function AppShell({ areaLabel }: { areaLabel: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return null;

  const home = homePathFor(user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 h-16 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          <button type="button" className="btn btn-ghost btn-sm lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            ☰
          </button>
          <Link to={home} aria-label="PRESTAR home" className="flex items-center">
            <Logo height={44} />
          </Link>
          <span className="badge badge-neutral hidden sm:inline-flex">{areaLabel}</span>
          <div className="flex-1" />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <div className="flex flex-1">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <main className="min-w-0 flex-1">
          {pathname !== home && (
            <div className="backbar">
              <BackButton fallback={home} />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}