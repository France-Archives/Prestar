import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import { useNotifications } from "../../hooks/useNotifications";
import type { AppNotification } from "../../types";
import { fmtDateTime } from "../../utils/dates";

export default function Notifications() {
  const { items, unread, isRead, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    markRead(n.id);
    navigate(n.to);
  };

  return (
    <>
      <span className="eyebrow">LIBRARY</span>
      <h1 className="page-title">Notifications</h1>
      <div className="toolbar">
        <span className="muted">{unread} unread</span>
        <button className="btn ghost sm" disabled={!unread} onClick={markAllRead}>Mark all read</button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="You are all caught up" text="New updates about your requests and loans appear here." />
      ) : (
        <div className="notif-list">
          {items.map((n) => (
            <button key={n.id} className={`notif ${isRead(n.id) ? "" : "unread"}`} onClick={() => open(n)}>
              <b>{n.title}</b>
              <span>{n.text}</span>
              <small className="muted">{fmtDateTime(n.date)}</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}