import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { homePathFor } from "@/app/routeConfig";
import Alert from "@/components/feedback/Alert";
import AppNavbar from "@/components/navigation/AppNavbar";
import BackButton from "@/components/navigation/BackButton";
import Sidebar from "@/components/navigation/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const COLLAPSED_KEY = "prestar:sidebar-rail";

const getCollapsedKey = (userId?: string) => `${COLLAPSED_KEY}:${userId ?? "guest"}`;

/** Shared signed-in shell: header on top, sidebar and content below in one grid. Student, Staff and Admin layouts use it. */
export default function AppShell({ areaLabel }: { areaLabel: string }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // true = icon rail, false = full sidebar. Storage can be blocked, so both calls are guarded.
  const [collapsed, setCollapsed] = useState(() => {
    const key = getCollapsedKey(user?.id);
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = getCollapsedKey(user.id);
    try {
      const stored = localStorage.getItem(key);
      setCollapsed(stored === null ? true : stored === "1");
    } catch {
      setCollapsed(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(getCollapsedKey(user.id), collapsed ? "1" : "0");
    } catch {
      /* the choice just will not survive a refresh */
    }
  }, [collapsed, user?.id]);

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
      <AppNavbar
        areaLabel={areaLabel}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        isDesktop={isDesktop}
        onToggleMenu={() => (isDesktop ? setCollapsed((c) => !c) : setDrawerOpen((o) => !o))}
      />
      <Sidebar collapsed={collapsed} drawerOpen={drawerOpen} isDesktop={isDesktop} onCloseDrawer={() => setDrawerOpen(false)} />
      {drawerOpen && <div className="app-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <main className="app-main">
        {user.role === "STUDENT" && !user.emailVerified && (
          <Alert kind="warn">
            Your email address is not verified. Borrowing is unavailable until verification is complete.
          </Alert>
        )}
        {pathname !== home && (
          <div className="backbar">
            <BackButton fallback={home} />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}