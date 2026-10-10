import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import StatusBadge from "@/components/data-display/StatusBadge";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const initials = user.displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-mist"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-sm font-bold text-white" aria-hidden="true">
          {initials}
        </span>
        <span className="hidden text-left text-sm font-semibold text-forest sm:block">{user.displayName}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="card"
          style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 240, padding: 14, zIndex: 60, boxShadow: "var(--shadow-raised)" }}
        >
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{user.displayName}</div>
            <div className="subtle" style={{ wordBreak: "break-all" }}>{user.email}</div>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={user.role} />
            </div>
          </div>
          {user.role === "STUDENT" && (
            <Link role="menuitem" to={ROUTES.student.profile} className="link-btn" style={{ display: "block", padding: "6px 0" }} onClick={() => setOpen(false)}>
              My profile
            </Link>
          )}
          <button role="menuitem" type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}