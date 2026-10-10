import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "@/assets/images/prestar-logo.png"; // <-- your logo file
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

interface AppNavbarProps {
  areaLabel: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

// Quick links shown on the right (md and up). They only point at EXISTING routes.
// Everything else stays reachable from the sidebar drawer.
const QUICK_LINKS: Record<UserRole, { label: string; to: string }[]> = {
  STUDENT: [
    { label: "Books", to: ROUTES.student.books },
    { label: "List", to: ROUTES.student.borrowings }, // "List" = My loans
  ],
  LIBRARIAN: [
    { label: "Release", to: ROUTES.staff.booksToRelease },
    { label: "Returns", to: ROUTES.staff.returns },
  ],
  ADMIN: [
    { label: "Circulation", to: ROUTES.admin.circulation },
    { label: "Reports", to: ROUTES.admin.reports },
  ],
};

export default function AppNavbar({ areaLabel, menuOpen, onToggleMenu }: AppNavbarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  if (!user) return null;
  const isStudent = user.role === "STUDENT";

  // Search is a student feature: it opens the catalog with ?search=.
  // NOTE: BookCatalogPage keeps its own filter state, so it does not read ?search= yet (see notes below).
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${ROUTES.student.books}?search=${encodeURIComponent(q)}` : ROUTES.student.books);
  };

  return (
    <header className="app-header sticky top-0 z-30 h-16">
      {/* 3 columns: [menu + logo] [search, truly centered on md+] [links + bell + user] */}
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 md:grid-cols-[1fr_minmax(0,36rem)_1fr]">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="app-iconbtn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            onClick={onToggleMenu}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {/* Logo: fixed height, auto width, never stretched; vertically centered by the flex row. */}
          <Link to={homePathFor(user)} className="flex shrink-0 items-center" aria-label="PRESTAR home">
            <img src={logo} alt="PRESTAR" className="block h-8 w-auto max-w-[150px] object-contain md:h-9" decoding="async" />
          </Link>

          {/* Staff/Admin area badge (students see none, like the mockup) */}
          {!isStudent && <span className="badge badge-neutral hidden lg:inline-flex">{areaLabel}</span>}
        </div>

        {isStudent ? (
          <form className="app-search" role="search" onSubmit={submitSearch}>
            <svg className="app-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books..." aria-label="Search books" />
          </form>
        ) : (
          <div /> /* keeps the grid columns aligned when there is no search */
        )}

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Quick links">
            {QUICK_LINKS[user.role].map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `app-navlink${isActive ? " is-active" : ""}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}