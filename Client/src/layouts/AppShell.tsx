import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { homePathFor } from "@/app/routeConfig";
import AppNavbar from "@/components/navigation/AppNavbar";
import BackButton from "@/components/navigation/BackButton";
import Sidebar from "@/components/navigation/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const COLLAPSED_KEY = "prestar:sidebar-collapsed";

/** Shared signed-in shell: sidebar rail + header + routed content. Student, Staff and Admin layouts use it. */
export default function AppShell({ areaLabel }: { areaLabel: string }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Remember the rail state between visits. Storage can be blocked, so both calls are guarded.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* the choice just will not survive a refresh */
    }
  }, [collapsed]);

  // Leaving a page or growing to desktop width closes the mobile drawer.
  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  // While the mobile drawer is open: Esc closes it and the page behind it does not scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  if (!user) return null;
  const home = homePathFor(user);

  return (
    <div className="app-shell" data-collapsed={collapsed} data-drawer={drawerOpen ? "open" : "closed"}>
      <Sidebar collapsed={collapsed} drawerOpen={drawerOpen} isDesktop={isDesktop} onCloseDrawer={() => setDrawerOpen(false)} />
      {drawerOpen && <div className="app-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="app-body">
        <AppNavbar
          areaLabel={areaLabel}
          collapsed={collapsed}
          drawerOpen={drawerOpen}
          isDesktop={isDesktop}
          onToggleMenu={() => (isDesktop ? setCollapsed((c) => !c) : setDrawerOpen((o) => !o))}
        />
        <main className="app-main">
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