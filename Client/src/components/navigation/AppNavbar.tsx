import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import logoSrc from "@/assets/images/prestar-logo.png";
import SearchInput from "@/components/forms/SearchInput";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
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

  if (!user) return null;
  const isStudent = user.role === "STUDENT";

  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const livePlaceholder = isStudent ? LIVE_SEARCH[path] : undefined;
  const catalogSearch = isStudent && !livePlaceholder && (path === ROUTES.student.dashboard || path.startsWith(`${ROUTES.student.books}/`));

  const MenuIcon = !isDesktop ? Menu : collapsed ? PanelLeftOpen : PanelLeftClose;
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
            <MenuIcon size={20} strokeWidth={1.9} aria-hidden="true" />
          </button>
          {!isDesktop && (
            <Link to={homePathFor(user)} className="app-header__brand" aria-label="PRESTAR home">
              <span className="app-brand-art" style={{ "--h": "2.75rem" } as CSSProperties}>
                <img src={logoSrc} alt="" />
              </span>
            </Link>
          )}
          {!isStudent && <span className="badge badge-neutral hidden lg:inline-flex">{areaLabel}</span>}
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
          <UserMenu />
        </div>
      </div>
    </header>
  );
}