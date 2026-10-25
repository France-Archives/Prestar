import { type CSSProperties, useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import logoSrc from "@/assets/images/prestar-logo.png";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useScrollHide } from "@/hooks/useScrollHide";

export default function PublicNavbar() {
  const { user, status } = useAuth();
  const { visible, scrolled } = useScrollHide(60);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !hamburgerRef.current?.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, closeMenu]);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `pub-nav-link${isActive ? " pub-nav-link--active" : ""}`;

  const mobileLink = ({ isActive }: { isActive: boolean }) =>
    `pub-mobile-link${isActive ? " pub-mobile-link--active" : ""}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          className={`pub-navbar${scrolled ? " pub-navbar--scrolled" : ""}`}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="pub-navbar__inner">
            {/* Logo */}
            <Link
              to={ROUTES.home}
              className="pub-navbar__brand"
              aria-label="PRESTAR home"
              style={{ textDecoration: "none" }}
            >
              <span className="app-brand-art" style={{ "--h": "2.875rem" } as CSSProperties}>
                <img src={logoSrc} alt="" />
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="pub-navbar__links" aria-label="Site navigation">
              <NavLink to={ROUTES.home} end className={link} style={{ textDecoration: "none" }}>
                Home
              </NavLink>
              <NavLink to={ROUTES.contact} className={link} style={{ textDecoration: "none" }}>
                Contact
              </NavLink>
            </nav>

            {/* Desktop auth buttons */}
            <div className="pub-navbar__actions pub-navbar__actions--desktop">
              {status === "loading" ? null : user ? (
                <Link
                  to={homePathFor(user)}
                  className="btn btn-primary pub-navbar__cta"
                  style={{ textDecoration: "none" }}
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to={ROUTES.login}
                    className="btn btn-ghost pub-navbar__btn"
                    style={{ textDecoration: "none" }}
                  >
                    Log in
                  </Link>
                  <Link
                    to={ROUTES.signup}
                    className="btn btn-primary pub-navbar__cta"
                    style={{ textDecoration: "none", color: "#fff" }}
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger — mobile/tablet only */}
            <button
              ref={hamburgerRef}
              type="button"
              className="pub-hamburger"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="pub-mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                id="pub-mobile-menu"
                ref={menuRef}
                className="pub-mobile-menu"
                role="dialog"
                aria-label="Mobile navigation"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <nav aria-label="Mobile site navigation">
                  <NavLink
                    to={ROUTES.home}
                    end
                    className={mobileLink}
                    style={{ textDecoration: "none" }}
                    onClick={closeMenu}
                  >
                    Home
                  </NavLink>
                  <NavLink
                    to={ROUTES.contact}
                    className={mobileLink}
                    style={{ textDecoration: "none" }}
                    onClick={closeMenu}
                  >
                    Contact
                  </NavLink>
                </nav>
                <div className="pub-mobile-menu__divider" />
                <div className="pub-mobile-menu__actions">
                  {status === "loading" ? null : user ? (
                    <Link
                      to={homePathFor(user)}
                      className="btn btn-primary"
                      style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}
                      onClick={closeMenu}
                    >
                      Go to dashboard
                    </Link>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.login}
                        className="btn btn-ghost"
                        style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}
                        onClick={closeMenu}
                      >
                        Log in
                      </Link>
                      <Link
                        to={ROUTES.signup}
                        className="btn btn-primary"
                        style={{ textDecoration: "none", width: "100%", justifyContent: "center", color: "#fff" }}
                        onClick={closeMenu}
                      >
                        Create account
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
