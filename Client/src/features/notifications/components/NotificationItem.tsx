import { Bell, BookOpen, CalendarClock, CircleCheck, CircleX, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { NotificationItem as Item, UserRole } from "@/types";
import { formatDate } from "@/utils/formatDate";

/** Where a notification leads, when its related record has a matching page. */
export function notificationLink(n: Item, role: UserRole): string | null {
  const type = n.relatedEntityType as string | null;
  if (role === "STUDENT") {
    if (["FINE_ASSESSED", "FINE_RECORDED", "FINE_PAYMENT_RECORDED", "FINE_WAIVED"].includes(n.type)) {
      return ROUTES.student.penalties;
    }
    switch (type) {
      case "BORROWING_REQUEST": return ROUTES.student.requests;
      case "LOAN": return ROUTES.student.borrowings;
      case "RESERVATION": return `${ROUTES.student.reservations}?reservationId=${encodeURIComponent(n.relatedEntityId ?? "")}`;
      case "STUDENT_VERIFICATION": return ROUTES.student.cor;
      case "USER": return ROUTES.student.profile;
      default: return null;
    }
  }
  return type === "STUDENT_VERIFICATION" ? ROUTES.staff.corReview : null;
}

function notificationIcon(type: Item["type"]) {
  if (type.startsWith("COR_") || type.startsWith("RENEWAL_")) return type.endsWith("REJECTED") ? CircleX : CircleCheck;
  if (type.startsWith("FINE_")) return WalletCards;
  if (type.startsWith("RESERVATION_")) return CalendarClock;
  if (type.startsWith("BORROW_REQUEST_") || type.startsWith("LOAN_") || type === "DUE_SOON" || type === "PICKUP_REMINDER") return BookOpen;
  return Bell;
}

interface NotificationItemProps {
  item: Item;
  role: UserRole;
  onRead: (id: string) => void;
  readBusy?: boolean;
}

export default function NotificationItem({ item, role, onRead, readBusy = false }: NotificationItemProps) {
  const unread = item.readAt === null;
  const link = notificationLink(item, role);
  const Icon = notificationIcon(item.type);
  return (
    <li
      className="card"
      style={{ padding: "12px 16px", borderLeft: `4px solid ${unread ? "var(--color-amber)" : "var(--color-line)"}`, listStyle: "none" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--color-forest)" }}>
          <Icon size={16} aria-hidden="true" style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
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
          <button type="button" className="link-btn" onClick={() => onRead(item.id)} disabled={readBusy}>
            {readBusy ? "Marking read..." : "Mark as read"}
          </button>
        )}
      </div>
    </li>
  );
}