import { isOverdue } from "../services/api";
import type { BorrowedBook, BorrowRequest, RequestStatus, Reservation, ReservationStatus } from "../types";
import { CONFIG } from "./constants";
import { todayStr } from "./dates";

const isPast = (iso: string | null) => iso !== null && new Date(iso).getTime() < Date.now();

// Expiry is applied lazily in the backend, so the UI shows the effective status right away.
export const requestStatus = (r: BorrowRequest): RequestStatus =>
  r.status === "Approved" && isPast(r.pickup_deadline) ? "Expired" : r.status;
export const reservationStatus = (r: Reservation): ReservationStatus =>
  r.status === "Ready" && isPast(r.expires_at) ? "Expired" : r.status;

// Overdue and Due soon are derived from due_date, never stored.
export const loanStatus = (l: BorrowedBook): string => {
  if (l.status !== "Borrowed") return l.status;
  if (isOverdue(l)) return "Overdue";
  return l.due_date <= todayStr(CONFIG.DUE_SOON_DAYS) ? "Due soon" : "Borrowed";
};