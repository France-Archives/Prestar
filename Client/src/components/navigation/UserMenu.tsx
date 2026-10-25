import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, Barcode, CheckCircle2, GraduationCap, Layers3, Mail, X } from "lucide-react";
import { ROUTES } from "@/app/routeConfig";
import StatusBadge from "@/components/data-display/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import "@/styles/profile.css";

/** Top-right profile icon. Opens a right-side drawer with the account info. Sign out lives in the sidebar. */
export default function UserMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // While open: Esc closes, page scroll is locked, focus moves into the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!user) return null;

  const close = () => setOpen(false);
  const initials = user.displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Label/value rows. Student and Librarian details come from the session user.
  const rows: [string, string][] = [["Email", user.email]];
  rows.push(["Email verified", user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "Not yet"]);
  if (user.student) {
    rows.push(["Student number", user.student.studentNumber]);
    rows.push(["Program", user.student.program ?? "—"]);
    rows.push(["Year level", user.student.yearLevel ? String(user.student.yearLevel) : "—"]);
  }
  if (user.librarian) {
    rows.push(["Employee number", user.librarian.employeeNumber ?? "—"]);
    rows.push(["Extra permissions", user.librarian.permissions.length ? user.librarian.permissions.map(statusLabel).join(", ") : "Circulation only"]);
  }

  // Portal to <body>: the navbar has backdrop-filter, which would trap a position:fixed child inside the header.
  const drawer = createPortal(
    <>
      <div
        className={`profile-drawer-backdrop ${open ? "is-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        id="profile-drawer"
        aria-label="Profile"
        inert={!open}
        className={`profile-drawer ${open ? "is-open" : ""}`}
      >
        <header className="profile-drawer__header">
          <div>
            <span className="profile-eyebrow">Account</span>
            <h2>My profile</h2>
          </div>
          <button ref={closeBtn} type="button" className="profile-close" aria-label="Close profile" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="profile-drawer__content">
          <section className="profile-identity" aria-label="Account identity">
            <div className="profile-identity__top">
              <span className="profile-avatar" aria-hidden="true">{initials}</span>
              <div className="profile-identity__name">
                <p className="profile-identity__fullname">{user.displayName}</p>
                <div className="profile-pills">
                  <StatusBadge status={user.role} />
                  <StatusBadge status={user.accountStatus} />
                </div>
              </div>
            </div>
            {user.student && (
              <div className="profile-identity__number">
                <div>
                  <span className="profile-eyebrow">Student number</span>
                  <strong>{user.student.studentNumber}</strong>
                </div>
                <Barcode size={24} aria-hidden="true" />
              </div>
            )}
          </section>

          {user.student ? (
            <>
              <section className="profile-drawer__section">
                <h3 className="profile-section-label">Contact</h3>
                <div className="profile-detail-card">
                  <div className="profile-contact-row">
                    <span className="profile-detail-icon"><Mail size={19} aria-hidden="true" /></span>
                    <div className="profile-detail-copy">
                      <span className="profile-detail-label">Email</span>
                      <strong>{user.email}</strong>
                    </div>
                  </div>
                  <span className={`profile-verification ${user.emailVerifiedAt ? "is-verified" : "is-unverified"}`}>
                    {user.emailVerifiedAt ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
                    {user.emailVerifiedAt ? "Verified" : "Not yet verified"}
                  </span>
                </div>
              </section>
              <section className="profile-drawer__section">
                <h3 className="profile-section-label">Academic</h3>
                <div className="profile-detail-card profile-academic-card">
                  <div className="profile-academic-row">
                    <span className="profile-detail-icon"><GraduationCap size={19} aria-hidden="true" /></span>
                    <div className="profile-detail-copy">
                      <span className="profile-detail-label">Program</span>
                      <strong>{user.student.program ?? "—"}</strong>
                    </div>
                  </div>
                  <div className="profile-academic-row">
                    <span className="profile-detail-icon"><Layers3 size={19} aria-hidden="true" /></span>
                    <div className="profile-detail-copy">
                      <span className="profile-detail-label">Year level</span>
                      <strong>{user.student.yearLevel ? String(user.student.yearLevel) : "—"}</strong>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <dl className="profile-detail-card profile-generic-details">
              {rows.map(([k, v]) => (
                <div key={k} className="profile-generic-row">
                  <dt className="profile-detail-label">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Existing account action: students keep the link to the full profile page. */}
        {user.role === "STUDENT" && (
          <div className="profile-drawer__footer">
            <Link to={ROUTES.student.profile} className="profile-open-link" onClick={close}>
              Open full profile
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );

  return (
    <>
      <button
        type="button"
        className="profile-menu-trigger"
        aria-label="Open profile"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="profile-drawer"
        onClick={() => setOpen(true)}
      >
        {initials}
      </button>
      {drawer}
    </>
  );
}