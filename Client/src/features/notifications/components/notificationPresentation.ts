import {
  Bell,
  BookOpen,
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock3,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/app/routeConfig";
import type { NotificationItem, UserRole } from "@/types";

export type NotificationTone = "success" | "info" | "warning" | "danger";

interface NotificationPresentation {
  icon: LucideIcon;
  tone: NotificationTone;
  badge?: string;
}

const PRESENTATION: Record<string, NotificationPresentation> = {
  COR_SUBMITTED: { icon: BookOpen, tone: "info" },
  COR_APPROVED: { icon: CircleCheck, tone: "success" },
  COR_REJECTED: { icon: CircleX, tone: "danger" },
  BORROW_REQUEST_APPROVED: { icon: BookOpen, tone: "success", badge: "Ready to pick up" },
  BORROW_REQUEST_REJECTED: { icon: CircleX, tone: "danger" },
  BORROW_REQUEST_ON_HOLD: { icon: Clock3, tone: "warning" },
  BORROW_REQUEST_EXPIRED: { icon: Clock3, tone: "warning" },
  HANDOVER_REJECTED: { icon: CircleX, tone: "danger" },
  RESERVATION_CONFIRMED: { icon: CalendarClock, tone: "info" },
  RESERVATION_OFFERED: { icon: CalendarClock, tone: "success", badge: "Ready to pick up" },
  RESERVATION_REMINDER: { icon: CalendarClock, tone: "warning" },
  RESERVATION_EXPIRED: { icon: CalendarClock, tone: "danger" },
  LOAN_ISSUED: { icon: BookOpen, tone: "success" },
  DUE_SOON: { icon: CalendarClock, tone: "warning" },
  PICKUP_REMINDER: { icon: CalendarClock, tone: "warning" },
  OVERDUE_RESTRICTION: { icon: CircleX, tone: "danger" },
  LOAN_RETURNED: { icon: CircleCheck, tone: "success" },
  RENEWAL_APPROVED: { icon: CircleCheck, tone: "success" },
  RENEWAL_REJECTED: { icon: CircleX, tone: "danger" },
  FINE_RECORDED: { icon: WalletCards, tone: "warning" },
  FINE_ASSESSED: { icon: WalletCards, tone: "warning" },
  FINE_PAYMENT_RECORDED: { icon: WalletCards, tone: "success" },
  FINE_WAIVED: { icon: WalletCards, tone: "info" },
  ACCOUNT_SUSPENDED: { icon: CircleX, tone: "danger" },
  ACCOUNT_REACTIVATED: { icon: CircleCheck, tone: "success" },
  EMAIL_VERIFICATION_REQUIRED: { icon: Bell, tone: "warning" },
  EMAIL_VERIFIED: { icon: CircleCheck, tone: "success" },
  GENERAL: { icon: Bell, tone: "info" },
};

export function getNotificationPresentation(type: string): NotificationPresentation {
  return PRESENTATION[type] ?? { icon: Bell, tone: "info" };
}

export function getNotificationLink(item: Pick<NotificationItem, "type" | "relatedEntityType" | "relatedEntityId">, role: UserRole): string | null {
  if (role !== "STUDENT") {
    return item.relatedEntityType === "STUDENT_VERIFICATION" ? ROUTES.staff.corReview : null;
  }

  switch (item.type) {
    case "BORROW_REQUEST_APPROVED":
    case "BORROW_REQUEST_REJECTED":
    case "BORROW_REQUEST_ON_HOLD":
    case "BORROW_REQUEST_EXPIRED":
    case "HANDOVER_REJECTED":
      return ROUTES.student.requests;
    case "LOAN_ISSUED":
      return ROUTES.student.borrowings;
    case "RESERVATION_CONFIRMED":
    case "RESERVATION_OFFERED":
    case "RESERVATION_REMINDER":
    case "RESERVATION_EXPIRED":
      return item.relatedEntityId
        ? `${ROUTES.student.reservations}?reservationId=${encodeURIComponent(item.relatedEntityId)}`
        : ROUTES.student.reservations;
    case "FINE_ASSESSED":
    case "FINE_RECORDED":
    case "FINE_PAYMENT_RECORDED":
    case "FINE_WAIVED":
      return ROUTES.student.penalties;
    case "COR_SUBMITTED":
    case "COR_APPROVED":
    case "COR_REJECTED":
      return ROUTES.student.cor;
    case "RENEWAL_APPROVED":
    case "RENEWAL_REJECTED":
    case "DUE_SOON":
    case "PICKUP_REMINDER":
    case "OVERDUE_RESTRICTION":
    case "LOAN_RETURNED":
      return ROUTES.student.borrowings;
    case "EMAIL_VERIFIED":
    case "EMAIL_VERIFICATION_REQUIRED":
    case "ACCOUNT_SUSPENDED":
    case "ACCOUNT_REACTIVATED":
      return ROUTES.student.profile;
    default:
      if (item.relatedEntityType === "BORROWING_REQUEST") return ROUTES.student.requests;
      if (item.relatedEntityType === "LOAN") return ROUTES.student.borrowings;
      if (item.relatedEntityType === "RESERVATION") {
        return item.relatedEntityId
          ? `${ROUTES.student.reservations}?reservationId=${encodeURIComponent(item.relatedEntityId)}`
          : ROUTES.student.reservations;
      }
      if (item.relatedEntityType === "STUDENT_VERIFICATION") return ROUTES.student.cor;
      if (item.relatedEntityType === "USER") return ROUTES.student.profile;
      return null;
  }
}
