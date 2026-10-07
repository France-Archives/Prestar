import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import Drawer from "./Drawer";
import Logo from "./Logo";
import { useAuthedLibrary } from "../context/LibraryContext";
import { useLive } from "../hooks/useLive";
import { useNotifications } from "../hooks/useNotifications";
import * as api from "../services/api";
import type { EligibilityCode } from "../types";
import { HOME_BY_ROLE } from "../utils/constants";

// Student header bell with the unread count (derived notifications).
function Bell() {
  const { unread } = useNotifications();
  const navigate = useNavigate();
  return (
    <button className="icon-btn bell" onClick={() => navigate("/student/notifications")} aria-label={`Notifications, ${unread} unread`}>
      🔔{unread > 0 && <b>{unread}</b>}
    </button>
  );
}

// Global restriction banner under the header: names the reason and links to where it is resolved.
const FIX_LINK: Partial<Record<EligibilityCode, string>> = { B: "/student/profile", C: "/student/profile", D: "/student/borrowing", E: "/student/borrowing" };

function RestrictionBanner() {
  const { user } = useAuthedLibrary();
  const reasons = useLive(() => api.checkEligibility(user.user_id, "promote"));
  if (!reasons.length) return null;
  const first = reasons[0];
  const link = FIX_LINK[first.code];
  return (
    <div className="banner">
      {first.message} {link && <Link to={link}>See details</Link>}
    </div>
  );
}

// Shared shell for all roles: header + sidebar (Drawer) + page content.
export default function AppLayout() {
  const { user, logout } = useAuthedLibrary();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const student = user.role === "Student";

  // Close the menu when the route changes (state adjusted during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenu(false);
  }
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
        <Logo onClick={() => navigate(HOME_BY_ROLE[user.role])} />
        <div className="topbar-spacer" />
        {student && <Bell />}
        <button className="text-btn topbar-user" onClick={() => navigate(`/${user.role.toLowerCase()}/profile`)}>
          {user.first_name} · {user.role}
        </button>
        <button className="btn ghost sm" onClick={signOut}>Sign Out</button>
      </header>
      {student && <div className="banner-wrap"><RestrictionBanner /></div>}
      <Drawer open={menu} onClose={() => setMenu(false)} onSignOut={signOut} />
      <main className="content"><Outlet /></main>
    </div>
  );
}