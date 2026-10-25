import { Bell, BookOpen, CalendarClock, Check, CircleX, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { NotificationItem as Item, UserRole } from "@/types";
import { formatDate } from "@/utils/formatDate";

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return formatDate(value);
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 60) return seconds < 0 ? "in a few seconds" : "Just now";
  const units: [number, string, string][] = [
    [60, "sec", "secs"],
    [60 * 60, "min", "min"],
    [24 * 60 * 60, "hr", "hrs"],
    [7 * 24 * 60 * 60, "day", "days"],
  ];
  let amount = Math.abs(seconds);
  let unit = "sec";
  let plural = "secs";
  for (const [limit, nextUnit, nextPlural] of units) {
    if (absoluteSeconds < limit) break;
    amount = Math.round(absoluteSeconds / limit);
    unit = nextUnit;
    plural = nextPlural;
  }
  if (absoluteSeconds >= 7 * 24 * 60 * 60) return formatDate(value);
  const label = `${amount} ${amount === 1 ? unit.replace(/s$/, "") : plural}`;
  return seconds < 0 ? `in ${label}` : `${label} ago`;
}

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
  if (type.startsWith("COR_") || type.startsWith("RENEWAL_")) return type.endsWith("REJECTED") ? CircleX : BookOpen;
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
    <li className={`notification-item${unread ? " is-unread" : ""}`}>
      <span className="notification-item__icon" aria-hidden="true"><Icon size={20} /></span>
      <div className="notification-item__content">
        <div className="notification-item__heading">
          <h3 className="notification-item__title">
            {unread && <span className="notification-item__unread-dot" aria-label="Unread" />}
            {item.title}
          </h3>
          <time className="notification-item__time" dateTime={item.createdAt} title={formatDate(item.createdAt)}>
            {relativeTime(item.createdAt)}
          </time>
        </div>
        <p className="notification-item__message">{item.message}</p>
      </div>
      <div className="notification-item__actions">
        {link && (
          <Link to={link} className="btn btn-secondary btn-sm" onClick={() => unread && onRead(item.id)}>
            View
          </Link>
        )}
        {unread && (
          <button type="button" className="notification-item__read" onClick={() => onRead(item.id)} disabled={readBusy} aria-label="Mark notification as read" title={readBusy ? "Marking as read" : "Mark as read"}>
            <Check size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}