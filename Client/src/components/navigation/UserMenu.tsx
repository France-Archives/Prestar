import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import StatusBadge from "@/components/data-display/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

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
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        id="profile-drawer"
        aria-label="Profile"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[22rem] max-w-[90vw] flex-col bg-paper shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 style={{ fontSize: "1.05rem" }}>My profile</h2>
          <button ref={closeBtn} type="button" className="app-iconbtn" aria-label="Close profile" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-forest text-lg font-bold text-white" aria-hidden="true">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate font-bold text-forest">{user.displayName}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <StatusBadge status={user.role} />
                <StatusBadge status={user.accountStatus} />
              </div>
            </div>
          </div>

          <dl className="grid gap-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{k}</dt>
                <dd className="m-0 break-words text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Existing account action: students keep the link to the full profile page. */}
        {user.role === "STUDENT" && (
          <div className="shrink-0 border-t border-line p-3">
            <Link to={ROUTES.student.profile} className="btn btn-ghost btn-block" style={{ textDecoration: "none" }} onClick={close}>
              Open full profile
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
        className="grid h-10 w-10 place-items-center rounded-full bg-forest text-sm font-bold text-white transition-shadow hover:shadow-[0_0_0_3px_rgba(45,106,79,0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
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