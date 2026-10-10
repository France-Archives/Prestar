import { useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import SearchInput from "@/components/forms/SearchInput";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import type { UserRole } from "@/types";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

interface AppNavbarProps {
  areaLabel: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

// Quick links shown on the right (md and up). They only point at EXISTING routes.
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

// Student pages whose own data the navbar search filters (live, via ?q=).
// Each of these pages reads the same ?q= with useSearchTerm().
const LIVE_SEARCH: Record<string, string> = {
  [ROUTES.student.books]: "Search books by title, author or ISBN…",
  [ROUTES.student.borrowings]: "Search my loans…",
  [ROUTES.student.requests]: "Search my requests…",
  [ROUTES.student.reservations]: "Search my reservations…",
  [ROUTES.student.renewals]: "Search my renewals…",
  [ROUTES.student.history]: "Search my borrowing history…",
};

function SearchIcon() {
  return (
    <svg className="app-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Filters the CURRENT page. The page itself reads ?q= and applies it to its own data. */
function LiveSearch({ placeholder }: { placeholder: string }) {
  const [term, setTerm] = useSearchTerm();
  return (
    <div className="app-search" role="search">
      <SearchIcon />
      <SearchInput value={term} onChange={setTerm} placeholder={placeholder} label={placeholder} />
    </div>
  );
}

/** Dashboard / book details: there is no list to filter here, so search the catalog. */
function CatalogSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${ROUTES.student.books}?q=${encodeURIComponent(q)}` : ROUTES.student.books);
  };
  return (
    <form className="app-search" role="search" onSubmit={submit}>
      <SearchIcon />
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books…" aria-label="Search books" />
    </form>
  );
}

export default function AppNavbar({ areaLabel, menuOpen, onToggleMenu }: AppNavbarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return null;
  const isStudent = user.role === "STUDENT";

  // Ignore a trailing slash so "/app/books/" still matches "/app/books".
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const livePlaceholder = isStudent ? LIVE_SEARCH[path] : undefined;
  const catalogSearch = isStudent && !livePlaceholder && (path === ROUTES.student.dashboard || path.startsWith(`${ROUTES.student.books}/`));

  return (
    <header className="app-header sticky top-0 z-30 h-16">
      {/* 3 columns: [menu + logo] [search, truly centered on md+] [links + bell + profile] */}
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

          <Link to={homePathFor(user)} className="flex shrink-0 items-center" aria-label="PRESTAR home">
            <Logo />
          </Link>

          {/* Staff/Admin area badge (students see none, like the mockup) */}
          {!isStudent && <span className="badge badge-neutral hidden lg:inline-flex">{areaLabel}</span>}
        </div>

        {/* key={path}: a fresh search box on every page, so text never leaks from one page to another. */}
        {livePlaceholder ? (
          <LiveSearch key={path} placeholder={livePlaceholder} />
        ) : catalogSearch ? (
          <CatalogSearch key={path} />
        ) : (
          <div /> /* no search on this page; keeps the grid columns aligned. Staff/Admin pages have their own in-page search. */
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