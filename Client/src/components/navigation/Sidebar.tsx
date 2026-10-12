import { useState, type MouseEvent, type FocusEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { ROUTES, getNavSections } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { iconFor } from "./navIcons";

interface SidebarProps {
  collapsed: boolean; // desktop: icon rail
  drawerOpen: boolean; // mobile: off-canvas drawer
  isDesktop: boolean;
  onCloseDrawer: () => void;
}

interface Tip {
  label: string;
  top: number;
  left: number;
}

export default function Sidebar({ collapsed, drawerOpen, isDesktop, onCloseDrawer }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tip, setTip] = useState<Tip | null>(null);

  if (!user) return null;

  // "Profile" stays out of the sidebar: the avatar in the header opens it.
  const sections = getNavSections(user)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.to !== ROUTES.student.profile) }))
    .filter((s) => s.items.length > 0);

  // Tooltip only while the rail is collapsed on desktop. It is position: fixed, so the scrolling nav cannot clip it.
  const showTip = (label: string, el: HTMLElement) => {
    if (!collapsed || !isDesktop) return;
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);
  const tipHandlers = (label: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => showTip(label, e.currentTarget),
    onFocus: (e: FocusEvent<HTMLElement>) => showTip(label, e.currentTarget),
    onMouseLeave: hideTip,
    onBlur: hideTip,
  });

  const signOut = async () => {
    onCloseDrawer();
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <>
      {/* `inert` takes the closed mobile drawer out of the tab order. On desktop the sidebar is always live. */}
      <aside id="app-sidebar" aria-label="Sidebar" className="app-sidebar" inert={!isDesktop && !drawerOpen}>
        <nav className="app-sidebar__nav" aria-label="Main navigation" onScroll={hideTip}>
          {sections.map((section) => (
            <div key={section.id} className="app-nav-group">
              <p className="app-nav-title">{section.title}</p>
              <ul className="app-nav-list">
                {section.items.map((item) => {
                  const Icon = iconFor(item.to);
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `app-nav-item${isActive ? " is-active" : ""}`}
                        {...tipHandlers(item.label)}
                      >
                        <Icon className="app-nav-icon" strokeWidth={1.9} aria-hidden="true" />
                        <span className="app-nav-label">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="app-sidebar__foot">
          <button type="button" className="app-nav-item app-nav-item--danger" onClick={signOut} {...tipHandlers("Sign out")}>
            <LogOut className="app-nav-icon" strokeWidth={1.9} aria-hidden="true" />
            <span className="app-nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      {tip && (
        <div className="app-tooltip" role="tooltip" style={{ top: tip.top, left: tip.left, transform: "translateY(-50%)" }}>
          {tip.label}
        </div>
      )}
    </>
  );
}