import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import NotificationBell from "@/components/navigation/NotificationBell";
import UserMenu from "@/components/navigation/UserMenu";

interface AdminNavbarProps {
  onToggleMenu: () => void;
}

// Quick searchable list of admin pages for the command search bar
const ADMIN_SEARCH_INDEX = [
  { label: "Dashboard", to: ROUTES.admin.dashboard, category: "Core" },
  { label: "Circulation Overview", to: ROUTES.admin.circulation, category: "Core" },
  { label: "System Reports", to: ROUTES.admin.reports, category: "Core" },
  { label: "Audit Logs", to: ROUTES.admin.auditLogs, category: "Core" },
  { label: "User Management", to: ROUTES.admin.users, category: "People" },
  { label: "Librarian Management", to: ROUTES.admin.librarians, category: "People" },
  { label: "COR Administration", to: ROUTES.admin.cor, category: "People" },
  { label: "Book Management", to: ROUTES.admin.books, category: "Catalog" },
  { label: "Academic Terms", to: ROUTES.admin.terms, category: "Policies" },
  { label: "Borrowing Policies", to: ROUTES.admin.policies, category: "Policies" },
  { label: "Fines & Payments", to: ROUTES.admin.finesAndPayments, category: "Policies" },
  { label: "Notifications Management", to: ROUTES.admin.notifications, category: "System" },
  { label: "System Settings", to: ROUTES.admin.settings, category: "System" },
];

export default function AdminNavbar({ onToggleMenu }: AdminNavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Determine current section title from pathname
  const getCurrentTitle = () => {
    if (pathname.includes("/admin/users/students/")) return "Student Profile";
    if (pathname.includes("/admin/users")) return "Users";
    if (pathname.includes("/admin/librarians")) return "Librarians";
    if (pathname.includes("/admin/books")) return "Books";
    if (pathname.includes("/admin/circulation")) return "Circulation";
    if (pathname.includes("/admin/cor")) return "COR Administration";
    if (pathname.includes("/admin/terms")) return "Academic Terms";
    if (pathname.includes("/admin/policies")) return "Borrowing Policies";
    if (pathname.includes("/admin/fines")) return "Fines & Payments";
    if (pathname.includes("/admin/reports")) return "Reports";
    if (pathname.includes("/admin/audit-logs")) return "Audit Logs";
    if (pathname.includes("/admin/notifications")) return "Notifications";
    if (pathname.includes("/admin/settings")) return "Settings";
    return "Dashboard";
  };

  // Keyboard shortcut Ctrl+K / Cmd+K to open search jump
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredLinks = searchTerm.trim()
    ? ADMIN_SEARCH_INDEX.filter((item) =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : ADMIN_SEARCH_INDEX;

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile hamburger + Breadcrumbs + Live status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Toggle navigation menu"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-400">Admin</span>
          <span className="hidden sm:inline-block text-slate-300">/</span>
          <h1 className="text-sm font-semibold tracking-tight text-slate-900 m-0 leading-none">
            {getCurrentTitle()}
          </h1>
        </div>

        {/* Live operational badge */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/10 ml-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Online</span>
        </div>
      </div>

      {/* Center: Command jump bar */}
      <div className="relative hidden md:block max-w-sm w-full mx-4">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-400 shadow-2xs hover:border-slate-300 hover:bg-white transition-all text-left"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>Jump to page or tool...</span>
          </div>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-2xs">
            Ctrl K
          </kbd>
        </button>

        {/* Quick jump popup */}
        {searchOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} aria-hidden="true" />
            <div className="absolute top-11 left-0 z-50 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 pb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type a section or tool..."
                  className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto pt-1 space-y-0.5">
                {filteredLinks.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      navigate(item.to);
                      setSearchOpen(false);
                      setSearchTerm("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-[#296148]/10 hover:text-[#296148] text-left transition-colors"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[10px] text-slate-400">{item.category}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: Quick actions + Notifications + User Avatar Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to={ROUTES.admin.librarians}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#296148]/25 bg-[#296148]/8 px-3 py-1.5 text-xs font-semibold text-[#296148] shadow-2xs hover:bg-[#296148] hover:text-white transition-colors no-underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Invite Librarian</span>
        </Link>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
