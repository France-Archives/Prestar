import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookCopy, Menu, Search } from "lucide-react";
import logoSrc from "@/assets/images/prestar-logo.png";
import SearchInput from "@/components/forms/SearchInput";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useBorrowList } from "@/context/BorrowListContext";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

interface AppNavbarProps {
  areaLabel: string;
  collapsed: boolean;
  drawerOpen: boolean;
  isDesktop: boolean;
  onToggleMenu: () => void; // desktop: collapse/expand the rail. mobile: open/close the drawer.
}

// Student pages whose own data the header search filters (live, via ?q=).
const LIVE_SEARCH: Record<string, string> = {
  [ROUTES.student.books]: "Search books by title, author or ISBN…",
  [ROUTES.student.borrowings]: "Search my borrowings…",
  [ROUTES.student.requests]: "Search my requests…",
  [ROUTES.student.reservations]: "Search my reservations…",
  [ROUTES.student.renewals]: "Search my renewals…",
  [ROUTES.student.history]: "Search my borrowing history…",
};

/** Filters the CURRENT page. The page itself reads ?q= and applies it to its own data. */
function LiveSearch({ placeholder }: { placeholder: string }) {
  const [term, setTerm] = useSearchTerm();
  return (
    <div className="app-search" role="search">
      <Search className="app-search-icon" aria-hidden="true" />
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
      <Search className="app-search-icon" aria-hidden="true" />
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books…" aria-label="Search books" />
    </form>
  );
}

export default function AppNavbar({ areaLabel, collapsed, drawerOpen, isDesktop, onToggleMenu }: AppNavbarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { items: borrowListItems } = useBorrowList();

  if (!user) return null;
  const isStudent = user.role === "STUDENT";

  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const livePlaceholder = isStudent ? LIVE_SEARCH[path] : undefined;
  const catalogSearch = isStudent && !livePlaceholder && (path === ROUTES.student.dashboard || path.startsWith(`${ROUTES.student.books}/`));
  const borrowListCount = borrowListItems.length;

  const menuLabel = !isDesktop ? (drawerOpen ? "Close menu" : "Open menu") : collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__lead">
          <button
            type="button"
            className="app-iconbtn"
            aria-label={menuLabel}
            aria-expanded={isDesktop ? !collapsed : drawerOpen}
            aria-controls="app-sidebar"
            onClick={onToggleMenu}
          >
            <Menu size={22} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <Link to={homePathFor(user)} className="app-header__brand" aria-label="PRESTAR home">
            <span className="app-brand-art" style={{ "--h": "3.25rem" } as CSSProperties}>
              <img src={logoSrc} alt="" />
            </span>
          </Link>
          {!isStudent && <span className="badge badge-neutral hidden xl:inline-flex">{areaLabel}</span>}
        </div>

        {/* key={path}: a fresh search box on every page, so text never leaks from one page to another. */}
        {livePlaceholder ? (
          <LiveSearch key={path} placeholder={livePlaceholder} />
        ) : catalogSearch ? (
          <CatalogSearch key={path} />
        ) : (
          <div />
        )}

        <div className="app-header__end">
          <NotificationBell />
          {isStudent && (
            <Link
              to={ROUTES.student.borrowList}
              aria-label={borrowListCount > 0 ? `My Borrow List, ${borrowListCount} item${borrowListCount === 1 ? "" : "s"}` : "My Borrow List"}
              title="My Borrow List"
              className="relative grid h-10 w-10 place-items-center rounded-lg text-forest hover:bg-mist"
              style={{ textDecoration: "none" }}
            >
              <BookCopy size={20} strokeWidth={1.8} aria-hidden="true" />
              {borrowListCount > 0 && (
                <b className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber px-1 text-[10px] font-bold leading-none text-forest-deep">
                  {borrowListCount > 99 ? "99+" : borrowListCount}
                </b>
              )}
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}