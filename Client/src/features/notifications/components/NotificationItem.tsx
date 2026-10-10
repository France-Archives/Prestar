import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { NotificationItem as Item, UserRole } from "@/types";
import { formatDate } from "@/utils/formatDate";

/** Where a notification leads. Students have no Fines page: fine notices stay informational. */
export function notificationLink(n: Item, role: UserRole): string | null {
  const type = n.relatedEntityType as string | null;
  if (role === "STUDENT") {
    switch (type) {
      case "BORROWING_REQUEST": return ROUTES.student.requests;
      case "LOAN": return ROUTES.student.borrowings;
      case "RESERVATION": return ROUTES.student.reservations;
      case "STUDENT_VERIFICATION": return ROUTES.student.cor;
      case "USER": return ROUTES.student.profile;
      default: return null;
    }
  }
  return type === "STUDENT_VERIFICATION" ? ROUTES.staff.corReview : null;
}

interface NotificationItemProps {
  item: Item;
  role: UserRole;
  onRead: (id: string) => void;
}

export default function NotificationItem({ item, role, onRead }: NotificationItemProps) {
  const unread = item.readAt === null;
  const link = notificationLink(item, role);
  return (
    <li
      className="card"
      style={{ padding: "12px 16px", borderLeft: `4px solid ${unread ? "var(--color-amber)" : "var(--color-line)"}`, listStyle: "none" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--color-forest)" }}>
          {unread && <span aria-label="Unread">● </span>}
          {item.title}
        </strong>
        <span className="subtle">{formatDate(item.createdAt)}</span>
      </div>
      <p style={{ margin: "4px 0 8px" }}>{item.message}</p>
      <div className="row-actions">
        {link && (
          <Link to={link} className="link-btn" onClick={() => unread && onRead(item.id)}>
            View
          </Link>
        )}
        {unread && (
          <button type="button" className="link-btn" onClick={() => onRead(item.id)}>
            Mark as read
          </button>
        )}
      </div>
    </li>
  );
}