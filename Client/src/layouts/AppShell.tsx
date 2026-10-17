import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppNavbar from "@/components/navigation/AppNavbar";
import Sidebar from "@/components/navigation/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/shell.css"; // shell/navbar/page-typography styles, loaded after global.css so they win ties

/** Shared signed-in shell: top navbar + hidden-by-default sidebar drawer + routed content. */
export default function AppShell({ areaLabel }: { areaLabel: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); // sidebar is CLOSED by default
  const { pathname } = useLocation();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Close the drawer and jump to top on every route change (same behaviour as before).
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return null;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppNavbar areaLabel={areaLabel} menuOpen={open} onToggleMenu={toggle} />
      <Sidebar open={open} onClose={close} />
      <main className="app-main min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}