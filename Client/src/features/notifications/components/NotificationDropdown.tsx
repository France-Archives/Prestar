import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { notificationsPathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate } from "@/utils/formatDate";

// Optional popover version of the bell: shows the latest items. The header currently uses NotificationBell (a link to the page).
export default function NotificationDropdown() {
  const { user } = useAuth();
  const { recent, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 320, maxWidth: "90vw", padding: 12, zIndex: 60, boxShadow: "var(--shadow-raised)" }}>
          {recent.length === 0 ? (
            <p className="subtle">You're all caught up.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
              {recent.map((n) => (
                <li key={n.id}>
                  <button type="button" style={{ textAlign: "left", width: "100%" }} onClick={() => n.readAt === null && void markRead(n.id)}>
                    <b style={{ color: "var(--color-forest)" }}>{n.readAt === null ? "● " : ""}{n.title}</b>
                    <span className="subtle" style={{ display: "block" }}>{n.message}</span>
                    <span className="subtle">{formatDate(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="row-actions" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <Link to={notificationsPathFor(user)} className="link-btn" onClick={() => setOpen(false)}>View all</Link>
            <button type="button" className="link-btn" disabled={unreadCount === 0} onClick={() => void markAllRead()}>Mark all read</button>
          </div>
        </div>
      )}
    </div>
  );
}