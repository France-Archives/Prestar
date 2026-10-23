import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminNavbar from "@/features/admin/components/AdminNavbar";
import AdminSidebar from "@/features/admin/components/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/admin.css";

/**
 * Dedicated Professional & Minimal Admin Layout.
 * Features a persistent dark-slate navigation console, sleek minimal header with
 * breadcrumbs, command quick-jump, and clean high-density workspace.
 */
export default function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Jump to top and close mobile drawer on route changes
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return null;

  return (
    <div className="admin-theme flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar open={open} onClose={close} />
      <div className="flex flex-1 flex-col min-w-0">
        <AdminNavbar onToggleMenu={toggle} />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}