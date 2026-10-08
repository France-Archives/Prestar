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
    <button
      className="icon-btn bell relative h-10 w-10 shrink-0 rounded-[10px] text-[17px] text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
      onClick={() => navigate("/student/notifications")}
      aria-label={`Notifications, ${unread} unread`}
    >
      🔔
      {unread > 0 && (
        <b className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#B98A4A] px-1 font-sans text-[10px] font-bold leading-none text-white">
          {unread}
        </b>
      )}
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
    <div className="banner mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] border border-[#D9C19A] bg-[#F1DDD6] px-4 py-2.5 font-sans text-[13px] leading-snug text-[#8A3B35]">
      <span>{first.message}</span>
      {link && (
        <Link to={link} className="font-bold text-[#0B3D32] underline underline-offset-2 transition-colors duration-200 hover:text-[#B98A4A]">
          See details
        </Link>
      )}
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
    <div className="app flex min-h-screen flex-col bg-[#F5F3EA] font-sans text-[#1F2A27]">
      <header className="topbar sticky top-0 z-40 border-b border-[#D9DDD7] bg-[#FBFAF5]/95 shadow-[0_4px_14px_rgba(11,61,50,0.05)] backdrop-blur supports-[backdrop-filter]:bg-[#FBFAF5]/85">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-2 px-4 sm:h-[72px] sm:gap-4 sm:px-6 lg:px-12">
          <button
            className="icon-btn h-10 w-10 shrink-0 rounded-[10px] text-[18px] text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0 shrink-0 font-serif text-[#0B3D32]">
            <Logo onClick={() => navigate(HOME_BY_ROLE[user.role])} />
          </div>
          <div className="topbar-spacer flex-1" />
          {student && <Bell />}
          <button
            className="text-btn topbar-user hidden max-w-[240px] truncate rounded-[10px] px-3 py-2 font-sans text-[12px] font-bold tracking-[0.02em] text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] hover:text-[#07352C] sm:block"
            onClick={() => navigate(`/${user.role.toLowerCase()}/profile`)}
          >
            {user.first_name} · {user.role}
          </button>
          <button
            className="btn ghost sm inline-flex h-9 w-auto shrink-0 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-3.5 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:px-4"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      </header>
      {student && (
        <div className="banner-wrap px-4 pt-4 sm:px-6 lg:px-12">
          <RestrictionBanner />
        </div>
      )}
      <Drawer open={menu} onClose={() => setMenu(false)} onSignOut={signOut} />
      <main className="content w-full flex-1">
        <Outlet />
      </main>
    </div>
  );
}