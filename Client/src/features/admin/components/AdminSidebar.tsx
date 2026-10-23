import { useEffect, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface AdminNavGroup {
  id: string;
  title: string;
  items: {
    label: string;
    to: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[];
}

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape when mobile drawer is open
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!user) return null;

  const handleSignOut = async () => {
    onClose();
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  const navGroups: AdminNavGroup[] = [
    {
      id: "main",
      title: "Core",
      items: [
        {
          label: "Dashboard",
          to: ROUTES.admin.dashboard,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          ),
        },
        {
          label: "Circulation",
          to: ROUTES.admin.circulation,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          ),
        },
        {
          label: "Reports",
          to: ROUTES.admin.reports,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          ),
        },
        {
          label: "Audit Logs",
          to: ROUTES.admin.auditLogs,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          ),
        },
      ],
    },
    {
      id: "people",
      title: "People & Access",
      items: [
        {
          label: "Users & Students",
          to: ROUTES.admin.users,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          label: "Librarians",
          to: ROUTES.admin.librarians,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" />
              <path d="M12 3v18" />
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
          ),
        },
        {
          label: "COR Submissions",
          to: ROUTES.admin.cor,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
            </svg>
          ),
        },
      ],
    },
    {
      id: "catalog",
      title: "Library Management",
      items: [
        {
          label: "Book Catalog",
          to: ROUTES.admin.books,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          ),
        },
        {
          label: "Academic Terms",
          to: ROUTES.admin.terms,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
          ),
        },
        {
          label: "Borrowing Policies",
          to: ROUTES.admin.policies,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" x2="20" y1="9" y2="9" />
              <line x1="4" x2="20" y1="15" y2="15" />
              <line x1="10" x2="10" y1="3" y2="21" />
            </svg>
          ),
        },
        {
          label: "Fines & Payments",
          to: ROUTES.admin.finesAndPayments,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
          ),
        },
      ],
    },
    {
      id: "system",
      title: "System",
      items: [
        {
          label: "Notifications",
          to: ROUTES.admin.notifications,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          ),
        },
        {
          label: "System Settings",
          to: ROUTES.admin.settings,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ),
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#296148] text-emerald-50">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#214f3b] px-4">
        <Link to={ROUTES.admin.dashboard} className="flex items-center gap-2.5 text-white no-underline transition-opacity hover:opacity-90">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f4b37] text-white ring-1 ring-white/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white leading-none">PRESTAR</span>
            <span className="text-[10px] font-semibold tracking-wider text-emerald-200/80 uppercase mt-0.5">Admin Console</span>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          ref={closeBtnRef}
          type="button"
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-emerald-200 hover:bg-[#1f4b37] hover:text-white transition-colors"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav links list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Admin Navigation">
        {navGroups.map((group) => (
          <div key={group.id}>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-wider text-emerald-200/60 uppercase">
              {group.title}
            </p>
            <ul className="m-0 list-none p-0 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={({ isActive }) =>
                      `group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium no-underline transition-all ${
                        isActive
                          ? "bg-[#1f4b37] text-white font-semibold shadow-xs ring-1 ring-white/10"
                          : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 transition-colors group-hover:text-white">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center rounded-full bg-emerald-300/20 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Portal Switching Section */}
        <div className="pt-2 border-t border-[#214f3b]">
          <p className="px-3 mb-2 text-[10px] font-bold tracking-wider text-emerald-200/60 uppercase">
            Portals
          </p>
          <div className="space-y-1">
            <Link
              to={ROUTES.staff.dashboard}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>Librarian Portal</span>
            </Link>
            <Link
              to={ROUTES.student.books}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              </svg>
              <span>Student Catalog</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Admin User Footer */}
      <div className="shrink-0 border-t border-[#214f3b] p-3 bg-[#214f3b]">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1b4331] text-xs font-bold text-white ring-1 ring-white/20">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{user.displayName}</div>
              <div className="text-[10px] text-emerald-200 font-medium">Administrator</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-200/80 hover:bg-[#1b4331] hover:text-rose-200 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Drawer (Left) */}
      <aside
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out lg:hidden ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Persistent Docked Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#214f3b] sticky top-0 h-screen z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
