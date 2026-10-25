import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppNavbar from "@/components/navigation/AppNavbar";
import Sidebar from "@/components/navigation/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/shell.css";

export default function AppShell({ areaLabel }: { areaLabel: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

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