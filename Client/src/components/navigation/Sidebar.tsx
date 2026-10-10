import { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { ROUTES, getNavSections } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Off-canvas drawer at every screen size. Hidden by default; the navbar hamburger toggles it. */
export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const closeBtn = useRef<HTMLButtonElement>(null);

  // While open: Esc closes, page scroll is locked, focus moves into the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!user) return null;

  // Same role-based sections as before. "Profile" is hidden here because the top-right
  // profile icon now opens the profile drawer (the /app/profile route itself still exists).
  const sections = getNavSections(user)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.to !== ROUTES.student.profile) }))
    .filter((s) => s.items.length > 0);

  // Same sign-out logic the old user menu used.
  const signOut = async () => {
    onClose();
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <>
      {/* Backdrop: click to close. Not focusable, hidden from screen readers. */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* `inert` removes the closed drawer from tab order and the accessibility tree. */}
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-paper shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <Logo />
          <button ref={closeBtn} type="button" className="app-iconbtn" aria-label="Close menu" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Sections">
          {sections.map((section) => (
            <div key={section.id} className="mb-4">
              <p className="eyebrow mb-1 px-3" style={{ margin: 0 }}>
                {section.title}
              </p>
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
                          isActive ? "bg-forest text-white" : "text-forest hover:bg-mist"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Pinned to the bottom (the nav above scrolls, this never does). */}
        <div className="shrink-0 border-t border-line p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brick transition-colors hover:bg-brick-soft"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}